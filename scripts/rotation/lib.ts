import {
  Contract,
  ContractTransaction,
  Signer,
  providers,
  utils,
} from 'ethers';

import {
  DEFAULT_ROLE_TARGET,
  ROLE_ROUTING,
  RoleTargetKind,
  RotationPhase,
} from './config';

/** ERC1967 admin slot: bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1) */
export const ERC1967_ADMIN_SLOT =
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

export const DEFAULT_ADMIN_ROLE_NAME = 'DEFAULT_ADMIN_ROLE';

export interface RoleInfo {
  name: string;
  hash: string;
}

export interface RotationTargets {
  owner: string;
  operator: string;
  signer: string;
}

export interface RoleAction {
  kind: 'grantRole' | 'revokeRole';
  contractLabel: string;
  contractAddress: string;
  roleName: string;
  roleHash: string;
  account: string;
}

export interface OwnershipAction {
  kind: 'transferOwnership';
  contractLabel: string;
  contractAddress: string;
  account: string;
}

export type RotationAction = RoleAction | OwnershipAction;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AbiFragment = any;

/**
 * Union of every `*_ROLE()` getter declared across the given ABIs.
 *
 * Reading the roles out of the ABIs instead of hardcoding them means a role
 * added to a contract later is picked up without touching this script. The
 * `_ROLE` suffix filter keeps other bytes32 getters (DOMAIN_SEPARATOR,
 * typehashes) out of the list.
 */
export const collectRoleGetterNames = (abis: AbiFragment[][]): string[] => {
  const names = new Set<string>([DEFAULT_ADMIN_ROLE_NAME]);

  for (const abi of abis) {
    for (const fragment of abi ?? []) {
      if (fragment?.type !== 'function') continue;
      if (!['view', 'pure'].includes(fragment.stateMutability)) continue;
      if ((fragment.inputs ?? []).length !== 0) continue;

      const outputs = fragment.outputs ?? [];
      if (outputs.length !== 1 || outputs[0]?.type !== 'bytes32') continue;
      if (!String(fragment.name).endsWith('_ROLE')) continue;

      names.add(fragment.name);
    }
  }

  return [...names].sort();
};

/**
 * Minimal ABI covering every role getter plus AccessControl and Ownable.
 *
 * Built by hand rather than taken from an artifact because the contract
 * deployed behind a proxy is not always the variant this repo would compile
 * today (Pyramid vs PyramidEscrowLatest vs PyramidV4Escrow).
 */
export const buildProbeAbi = (roleGetterNames: string[]): string[] => [
  ...roleGetterNames.map((name) => `function ${name}() view returns (bytes32)`),
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function getRoleAdmin(bytes32 role) view returns (bytes32)',
  'function grantRole(bytes32 role, address account)',
  'function revokeRole(bytes32 role, address account)',
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
];

export const getProbeContract = (
  address: string,
  roleGetterNames: string[],
  signerOrProvider: Signer | providers.Provider,
): Contract =>
  new Contract(address, buildProbeAbi(roleGetterNames), signerOrProvider);

/**
 * Calls every role getter and keeps the ones the contract actually implements.
 */
export const probeRoles = async (
  contract: Contract,
  roleGetterNames: string[],
): Promise<RoleInfo[]> => {
  const roles: RoleInfo[] = [];

  for (const name of roleGetterNames) {
    try {
      const hash: string = await contract.callStatic[name]();
      if (typeof hash === 'string' && utils.isHexString(hash, 32)) {
        roles.push({ name, hash });
      }
    } catch {
      // Not implemented by this contract.
    }
  }

  return roles;
};

export interface RoleAuthority {
  /** Role that governs grant/revoke of the role in question. */
  adminRole: string;
  /** Whether the account running the script may grant or revoke it. */
  canExecute: boolean;
}

/**
 * Whether `executor` is allowed to grant or revoke `roleHash` here.
 *
 * AccessControl gates every grant behind the role's admin role, which is not
 * always held by whoever deployed the contract. Checking up front turns a
 * mid-run revert into a line in the plan naming the account that must sign.
 */
export const checkRoleAuthority = async (
  contract: Contract,
  roleHash: string,
  executor: string,
): Promise<RoleAuthority> => {
  const adminRole: string = await contract.getRoleAdmin(roleHash);
  return {
    adminRole,
    canExecute: await contract.hasRole(adminRole, executor),
  };
};

export const resolveRoleTarget = (
  roleName: string,
  targets: RotationTargets,
  routing: Record<string, RoleTargetKind> = ROLE_ROUTING,
  fallback: RoleTargetKind = DEFAULT_ROLE_TARGET,
): string => {
  const kind = routing[roleName] ?? fallback;
  const target = targets[kind];
  // An unset hot wallet falls back to the owner so a role is never dropped.
  return target && target !== '' ? target : targets.owner;
};

const dedupeAddresses = (addresses: string[]): string[] => {
  const seen = new Map<string, string>();
  for (const address of addresses) {
    if (!address || !utils.isAddress(address)) continue;
    const checksummed = utils.getAddress(address);
    seen.set(checksummed.toLowerCase(), checksummed);
  }
  return [...seen.values()];
};

/**
 * First block where `address` has code.
 *
 * Scanning role events from block 0 is what makes the log query too large to
 * serve on a busy chain. Binary search finds the deployment block in ~25 calls
 * and turns an impossible range into a workable one.
 */
export const findDeploymentBlock = async (
  provider: providers.Provider,
  address: string,
  latestBlock?: number,
): Promise<number> => {
  let high = latestBlock ?? (await provider.getBlockNumber());
  if ((await provider.getCode(address, high)) === '0x') {
    throw new Error(`no contract at ${address} as of block ${high}`);
  }

  let low = 0;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((await provider.getCode(address, middle)) === '0x') {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
};

export interface ScanOptions {
  fromBlock?: number;
  toBlock?: number;
  maxRequests?: number;
  onProgress?: (requests: number, block: number, toBlock: number) => void;
}

interface ScanState {
  requests: number;
  maxRequests: number;
  /** Widest range the RPC has accepted so far, once one is known. */
  window?: number;
  onProgress?: ScanOptions['onProgress'];
  toBlock: number;
  reached?: number;
}

export interface ScanResult {
  /** Accounts ever granted each role, keyed by lowercased role hash. */
  byRole: Map<string, string[]>;
  complete: boolean;
  requests: number;
  error?: string;
}

/**
 * Widest log query the RPC will actually serve.
 *
 * Public RPCs cap eth_getLogs differently and none of them say by how much up
 * front, so the range is not pre-divided into fixed chunks: it is tried whole,
 * and every refusal halves it. The first width that succeeds is remembered and
 * reused as a fixed window for the rest of the range - without that, every
 * branch would rediscover the same limit and roughly double the request count.
 */
const queryFilterAdaptive = async (
  contract: Contract,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: any,
  fromBlock: number,
  toBlock: number,
  state: ScanState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> => {
  const width = toBlock - fromBlock + 1;

  // A known-good window: sweep instead of rediscovering the limit by halving.
  if (state.window && width > state.window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = [];
    for (let start = fromBlock; start <= toBlock; start += state.window) {
      const end = Math.min(start + state.window - 1, toBlock);
      events.push(
        ...(await queryFilterAdaptive(contract, filter, start, end, state)),
      );
    }
    return events;
  }

  if (state.requests >= state.maxRequests) {
    throw new Error(
      `gave up after ${state.maxRequests} requests - raise SCAN_MAX_REQUESTS ` +
        'or point the network at an archive RPC',
    );
  }
  state.requests += 1;

  try {
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    if (state.window === undefined) state.window = width;
    // Halving finishes sub-ranges out of order, so report the furthest block
    // reached - otherwise the percentage appears to walk backwards.
    state.reached = Math.max(state.reached ?? 0, toBlock);
    if (state.onProgress) {
      state.onProgress(state.requests, state.reached, state.toBlock);
    }
    return events;
  } catch (error) {
    // A single block that still fails is a real error, not a range problem.
    if (fromBlock >= toBlock) throw error;

    // Narrow the window for everything that follows. Without this the sweep
    // keeps handing back a width already known to fail, and every branch pays
    // the same cascade of refusals over again.
    const halved = Math.max(1, Math.floor(width / 2));
    state.window = Math.min(state.window ?? halved, halved);

    const middle = Math.floor((fromBlock + toBlock) / 2);
    return [
      ...(await queryFilterAdaptive(
        contract,
        filter,
        fromBlock,
        middle,
        state,
      )),
      ...(await queryFilterAdaptive(
        contract,
        filter,
        middle + 1,
        toBlock,
        state,
      )),
    ];
  }
};

/**
 * Every account ever granted any role on this contract, in one pass.
 *
 * Scanned once per contract rather than once per role: the block range is the
 * expensive part and it is identical for every role, so filtering per role
 * would multiply the request count by the number of roles for nothing.
 *
 * `complete: false` means the RPC could not serve the range - the caller must
 * say so rather than present the result as the full holder set.
 */
export const scanRoleGrantedAccounts = async (
  contract: Contract,
  options: ScanOptions = {},
): Promise<ScanResult> => {
  const byRole = new Map<string, string[]>();
  const fromBlock = options.fromBlock ?? 0;
  const toBlock = options.toBlock ?? (await contract.provider.getBlockNumber());
  const state: ScanState = {
    requests: 0,
    maxRequests: options.maxRequests ?? 2000,
    onProgress: options.onProgress,
    toBlock,
  };

  try {
    const events = await queryFilterAdaptive(
      contract,
      contract.filters.RoleGranted(),
      fromBlock,
      toBlock,
      state,
    );

    for (const event of events) {
      const role = event.args?.role;
      const account = event.args?.account;
      if (!role || !account) continue;

      const key = String(role).toLowerCase();
      const accounts = byRole.get(key) ?? [];
      accounts.push(utils.getAddress(account));
      byRole.set(key, accounts);
    }

    return { byRole, complete: true, requests: state.requests };
  } catch (error) {
    return {
      byRole,
      complete: false,
      requests: state.requests,
      error: (error as Error).message,
    };
  }
};

/** Of the accounts given, the ones that still hold the role right now. */
export const verifyHolders = async (
  contract: Contract,
  roleHash: string,
  accounts: string[],
): Promise<string[]> => {
  const holders: string[] = [];
  for (const account of dedupeAddresses(accounts)) {
    if (await contract.hasRole(roleHash, account)) holders.push(account);
  }
  return holders;
};

/**
 * Splits holders into wallets and contracts.
 *
 * A role held by a contract is an integration, not a leaked key: Pyramid holds
 * OPERATOR_ROLE on ArkadaRewarder and DISTRIBUTOR_ROLE on GlobalEscrow, and
 * revoking those would stop rewards from being paid out. Only wallets are
 * rotated; contracts are reported and left alone.
 */
export const partitionHoldersByCode = async (
  provider: providers.Provider,
  holders: string[],
): Promise<{ wallets: string[]; contracts: string[] }> => {
  const wallets: string[] = [];
  const contracts: string[] = [];

  for (const holder of holders) {
    const code = await provider.getCode(holder);
    if (code && code !== '0x') {
      contracts.push(holder);
    } else {
      wallets.push(holder);
    }
  }

  return { wallets, contracts };
};

export interface RolePlanInput {
  contractLabel: string;
  contractAddress: string;
  role: RoleInfo;
  holders: string[];
  desired: string;
  phase: RotationPhase;
}

/**
 * Actions needed to move one role on one contract.
 *
 * `revoke` refuses to run before `grant` landed: stripping the old holders
 * while the new address has nothing would leave the contract without an admin.
 */
export const planRoleActions = (
  input: RolePlanInput,
): { actions: RoleAction[]; skipped?: string } => {
  const { contractLabel, contractAddress, role, holders, desired, phase } =
    input;
  const desiredAddress = utils.getAddress(desired);
  const holderSet = dedupeAddresses(holders);
  const desiredHasRole = holderSet.some((h) => h === desiredAddress);

  if (phase === 'grant') {
    if (desiredHasRole) return { actions: [] };
    return {
      actions: [
        {
          kind: 'grantRole',
          contractLabel,
          contractAddress,
          roleName: role.name,
          roleHash: role.hash,
          account: desiredAddress,
        },
      ],
    };
  }

  if (phase === 'revoke') {
    const stale = holderSet.filter((holder) => holder !== desiredAddress);
    if (stale.length === 0) return { actions: [] };
    if (!desiredHasRole) {
      return {
        actions: [],
        skipped:
          `${desiredAddress} does not hold ${role.name} yet - run the grant ` +
          `phase first, otherwise the role would be left with no holder`,
      };
    }
    return {
      actions: stale.map((holder) => ({
        kind: 'revokeRole' as const,
        contractLabel,
        contractAddress,
        roleName: role.name,
        roleHash: role.hash,
        account: holder,
      })),
    };
  }

  return { actions: [] };
};

/**
 * Revocations that can lock the executor out are sent last: other roles first,
 * then DEFAULT_ADMIN_ROLE of everyone else, then the executor's own.
 */
export const orderActions = (
  actions: RotationAction[],
  executor: string,
): RotationAction[] => {
  const executorAddress = utils.isAddress(executor)
    ? utils.getAddress(executor)
    : executor;

  const weigh = (action: RotationAction): number => {
    if (action.kind !== 'revokeRole') return 0;
    if (action.roleName !== DEFAULT_ADMIN_ROLE_NAME) return 1;
    return action.account === executorAddress ? 3 : 2;
  };

  return [...actions]
    .map((action, index) => ({ action, index }))
    .sort((a, b) => weigh(a.action) - weigh(b.action) || a.index - b.index)
    .map(({ action }) => action);
};

/** Reads the ProxyAdmin of a transparent proxy straight from its ERC1967 slot. */
export const readProxyAdmin = async (
  provider: providers.Provider,
  proxyAddress: string,
): Promise<string | undefined> => {
  const raw = await provider.getStorageAt(proxyAddress, ERC1967_ADMIN_SLOT);
  const admin = utils.getAddress(utils.hexDataSlice(raw, 12));
  return admin === utils.getAddress(utils.hexZeroPad('0x0', 20))
    ? undefined
    : admin;
};

export const describeAction = (action: RotationAction): string => {
  if (action.kind === 'transferOwnership') {
    return `${action.contractLabel} (${action.contractAddress}): transferOwnership -> ${action.account}`;
  }
  const verb = action.kind === 'grantRole' ? 'grant' : 'revoke';
  const preposition = action.kind === 'grantRole' ? 'to' : 'from';
  return `${action.contractLabel} (${action.contractAddress}): ${verb} ${action.roleName} ${preposition} ${action.account}`;
};

export interface ExecutionResult {
  action: RotationAction;
  /**
   * `unconfirmed` means the transaction was broadcast but the receipt could
   * not be read - it may well have landed. Never report it as a failure.
   */
  status: 'sent' | 'dry-run' | 'failed' | 'unconfirmed';
  txHash?: string;
  error?: string;
}

/** Infrastructure hiccups, as opposed to a contract refusing the call. */
const TRANSIENT_RPC_PATTERNS = [
  'rate limit',
  'too many requests',
  '429',
  'timeout',
  'timed out',
  'socket hang up',
  'econnreset',
  'econnrefused',
  'bad gateway',
  'service unavailable',
  'archived blocks',
  'header not found',
  'nonce too low',
];

export const isTransientRpcError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return TRANSIENT_RPC_PATTERNS.some((pattern) => lower.includes(pattern));
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries only what is worth retrying.
 *
 * A revert means the chain said no and will say no again; an RPC rate limit
 * means the provider said no for now. Retrying the first would be noise,
 * retrying the second is what keeps a 19-network run from dying on a hiccup.
 */
export const withRetry = async <T>(
  send: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; log?: (m: string) => void },
): Promise<T> => {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 2000;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      const message = (error as Error).message;
      if (attempt >= attempts || !isTransientRpcError(message)) throw error;

      const wait = delayMs * 2 ** (attempt - 1);
      if (options.log) {
        options.log(
          `  RPC problem (${message.split('\n')[0]}), retry ${attempt}/${
            attempts - 1
          } in ${wait / 1000}s`,
        );
      }
      await sleep(wait);
    }
  }
};

export const executeActions = async (
  actions: RotationAction[],
  contractFor: (address: string) => Contract,
  options: {
    dryRun: boolean;
    log?: (message: string) => void;
    retry?: { attempts?: number; delayMs?: number };
  },
): Promise<ExecutionResult[]> => {
  const log = options.log ?? console.log;
  const retry = { ...options.retry, log };
  const results: ExecutionResult[] = [];

  for (const action of actions) {
    if (options.dryRun) {
      log(`[dry-run] ${describeAction(action)}`);
      results.push({ action, status: 'dry-run' });
      continue;
    }

    // Broadcasting and confirming are separated on purpose: if the receipt
    // cannot be read, the transaction is still out there and calling that a
    // failure would send the operator to re-send something already mined.
    let tx: ContractTransaction;
    try {
      const contract = contractFor(action.contractAddress);
      tx = await withRetry<ContractTransaction>(
        () =>
          action.kind === 'transferOwnership'
            ? contract.transferOwnership(action.account)
            : contract[action.kind](action.roleHash, action.account),
        retry,
      );
    } catch (error) {
      const message = (error as Error).message;
      log(`[FAILED] ${describeAction(action)}: ${message}`);
      results.push({ action, status: 'failed', error: message });
      break;
    }

    try {
      await withRetry(() => tx.wait(), retry);
      log(`[sent ${tx.hash}] ${describeAction(action)}`);
      results.push({ action, status: 'sent', txHash: tx.hash });
    } catch (error) {
      const message = (error as Error).message;
      log(
        `[UNCONFIRMED ${tx.hash}] ${describeAction(action)}: ${message}\n` +
          '  The transaction was broadcast. Check the hash before re-running.',
      );
      results.push({
        action,
        status: 'unconfirmed',
        txHash: tx.hash,
        error: message,
      });
      break;
    }
  }

  return results;
};
