import { Contract, utils } from 'ethers';
import * as hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import fs from 'fs';
import path from 'path';

import {
  COMPROMISED_DEPLOYER,
  DRY_RUN,
  EXTRA_HOLDER_CANDIDATES,
  KNOWN_HOLDER_CANDIDATES,
  NEW_OPERATOR,
  NEW_OWNER,
  NEW_SIGNER,
  PHASE,
  SCAN_EVENTS,
  SCAN_MAX_REQUESTS,
} from './config';
import {
  RotationAction,
  RotationTargets,
  checkRoleAuthority,
  collectRoleGetterNames,
  describeAction,
  executeActions,
  findDeploymentBlock,
  getProbeContract,
  orderActions,
  partitionHoldersByCode,
  planRoleActions,
  probeRoles,
  readProxyAdmin,
  resolveRoleTarget,
  scanRoleGrantedAccounts,
  verifyHolders,
} from './lib';

import { getCurrentAddresses } from '../../config/constants/addresses';

/**
 * Registry keys that use AccessControl, and the ones that use Ownable.
 * Everything comes from config/constants/addresses.ts, so a network is covered
 * as soon as its addresses are filled in there.
 */
const ACCESS_CONTROL_KEYS = [
  'pyramid',
  'pyramidEscrowMulti',
  'arena',
  'arkadaRewarder',
  'globalEscrow',
  'escrowFactory',
  'arkadaMap',
] as const;

const OWNABLE_KEYS = ['arkadaMapBoost'] as const;

/** Generous per-action gas figure, only used for the pre-flight balance check. */
const GAS_PER_ACTION = 120_000;

const PROXY_ADMIN_ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
];

/**
 * Where completed log scans are remembered, so a repeat run costs a handful of
 * requests instead of a few hundred. Gitignored, and holds nothing secret -
 * just which accounts were ever granted which role, up to which block.
 */
const SCAN_CACHE_DIR = path.join('scripts-data', 'rotation-scan');

/** Re-read this many blocks below the cached tip, in case of a small reorg. */
const REORG_MARGIN = 128;

interface ScanCache {
  toBlock: number;
  byRole: Record<string, string[]>;
}

const scanCachePath = (network: string, address: string) =>
  path.join(SCAN_CACHE_DIR, `${network}-${address.toLowerCase()}.json`);

const readScanCache = (network: string, address: string): ScanCache | null => {
  try {
    const raw = fs.readFileSync(scanCachePath(network, address), 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.toBlock !== 'number' || !parsed?.byRole) return null;
    return parsed as ScanCache;
  } catch {
    return null;
  }
};

const writeScanCache = (
  network: string,
  address: string,
  cache: ScanCache,
): void => {
  fs.mkdirSync(SCAN_CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    scanCachePath(network, address),
    JSON.stringify(cache, null, 1),
  );
};

const warnings: string[] = [];

const warn = (message: string) => {
  warnings.push(message);
  console.log(`  !! ${message}`);
};

/**
 * Every `*_ROLE()` getter compiled in this repo. Used to probe the deployed
 * contracts, which are not always the variant that would be compiled today.
 */
const readRoleGetterNames = async (env: HardhatRuntimeEnvironment) => {
  const names = await env.artifacts.getAllFullyQualifiedNames();
  const abis = await Promise.all(
    names
      .filter((name) => name.startsWith('contracts/'))
      .map(async (name) => (await env.artifacts.readArtifact(name)).abi),
  );
  return collectRoleGetterNames(abis);
};

const func = async (env: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(env);
  if (!addresses) {
    throw new Error(`no addresses configured for network ${env.network.name}`);
  }

  if (!utils.isAddress(NEW_OWNER)) {
    throw new Error('set NEW_OWNER in scripts/rotation/config.ts first');
  }

  const { deployer } = await env.getNamedAccounts();
  const executor = await env.ethers.getSigner(deployer);

  const targets: RotationTargets = {
    owner: utils.getAddress(NEW_OWNER),
    operator: NEW_OPERATOR ? utils.getAddress(NEW_OPERATOR) : '',
    signer: NEW_SIGNER ? utils.getAddress(NEW_SIGNER) : '',
  };

  // A typo here would hand everything straight back to the stolen key.
  for (const [label, target] of Object.entries(targets)) {
    if (!target) continue;
    if (target === utils.getAddress(COMPROMISED_DEPLOYER)) {
      throw new Error(`${label} target is the compromised deployer`);
    }
  }

  const executorIsTarget = Object.entries(targets).find(
    ([, target]) => target && target === executor.address,
  )?.[0];

  console.log('='.repeat(72));
  console.log(`network:  ${env.network.name}`);
  console.log(`phase:    ${PHASE}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`executor: ${executor.address}`);
  console.log(`owner:    ${targets.owner}`);
  console.log(`operator: ${targets.operator || '-> owner'}`);
  console.log(`signer:   ${targets.signer || '-> owner'}`);
  console.log('='.repeat(72));

  // Running as one of the new addresses is not a mistake by itself. For
  // revoke it is the better way round: the new admin strips the old holders,
  // and it can never revoke itself because it is the address roles move to.
  if (executorIsTarget) {
    if (PHASE === 'revoke') {
      console.log(
        `running as the new ${executorIsTarget} - it keeps its own roles ` +
          'and only the previous holders are stripped\n',
      );
    } else {
      warn(
        `running as the new ${executorIsTarget}: the ${PHASE} phase is ` +
          'normally sent from the account that holds the role today',
      );
    }
  }

  if (!targets.signer) {
    warn(
      'NEW_SIGNER is empty: SIGNER_ROLE goes to the multisig and every ' +
        'signature-based mint stops working (contracts use ECDSA.recover)',
    );
  }
  if (!targets.operator) {
    warn(
      'NEW_OPERATOR is empty: OPERATOR/MINTER/DISTRIBUTOR go to the multisig ' +
        'and the backend can no longer call them automatically',
    );
  }
  if (!SCAN_EVENTS) {
    warn(
      'SCAN_EVENTS is off: only the addresses in KNOWN_HOLDER_CANDIDATES / ' +
        'EXTRA_HOLDER_CANDIDATES are checked, other holders stay untouched',
    );
  }

  const roleGetterNames = await readRoleGetterNames(env);
  const candidates = [
    ...KNOWN_HOLDER_CANDIDATES,
    ...EXTRA_HOLDER_CANDIDATES,
    executor.address,
    targets.owner,
    targets.operator,
    targets.signer,
  ].filter(Boolean);

  const actions: RotationAction[] = [];
  const contracts = new Map<string, Contract>();

  // ---------------------------------------------------------------- roles

  // The transfer phase only moves ownership, so the (slow) role scan is skipped.
  for (const key of PHASE === 'transfer' ? [] : ACCESS_CONTROL_KEYS) {
    const address = addresses[key];
    if (!address || !utils.isAddress(address)) continue;

    console.log(`\n${key} @ ${address}`);

    if ((await env.ethers.provider.getCode(address)) === '0x') {
      warn(`${key}: no contract deployed at this address, skipping`);
      continue;
    }

    const probe = getProbeContract(address, roleGetterNames, executor);
    contracts.set(utils.getAddress(address), probe);

    const roles = await probeRoles(probe, roleGetterNames);
    if (roles.length === 0) {
      warn(`${key}: no roles found, is this really an AccessControl contract?`);
      continue;
    }

    // Only the revoke phase needs the full holder set. grant decides purely on
    // whether the new address already has the role, so scanning years of logs
    // there would cost thousands of requests and change nothing.
    const needsHolderScan = SCAN_EVENTS && PHASE === 'revoke';

    // One scan per contract covers every role on it. A previous scan is
    // resumed from where it stopped, so re-running a phase after a failure
    // costs a handful of requests instead of a few hundred.
    const scanned = new Map<string, string[]>();
    if (needsHolderScan) {
      const cached = readScanCache(env.network.name, address);
      let fromBlock: number | undefined;

      if (cached) {
        fromBlock = Math.max(0, cached.toBlock - REORG_MARGIN + 1);
        for (const [role, accounts] of Object.entries(cached.byRole)) {
          scanned.set(role, accounts);
        }
        console.log(`  cached scan up to block ${cached.toBlock}, resuming`);
      } else {
        // Scanning from block 0 is what makes the log query unservable on a
        // busy chain, so the range starts at the deployment.
        try {
          fromBlock = await findDeploymentBlock(env.ethers.provider, address);
          console.log(`  deployed at block ${fromBlock}`);
        } catch (error) {
          warn(
            `${key}: could not locate the deployment block ` +
              `(${(error as Error).message}), scanning from block 0`,
          );
        }
      }

      const toBlock = await env.ethers.provider.getBlockNumber();
      let reported = 0;
      const scan = await scanRoleGrantedAccounts(probe, {
        fromBlock,
        toBlock,
        maxRequests: SCAN_MAX_REQUESTS,
        onProgress: (requests, block, end) => {
          // A long sweep is silent otherwise; report every 50 requests.
          if (requests - reported < 50) return;
          reported = requests;
          const done =
            end - block === 0 ? 100 : Math.floor((block / end) * 100);
          console.log(
            `    scanning... ${requests} requests, block ${block} (${done}%)`,
          );
        },
      });

      for (const [role, accounts] of scan.byRole) {
        // Re-grants show up as repeated events; one entry per account is enough.
        scanned.set(role, [
          ...new Set([...(scanned.get(role) ?? []), ...accounts]),
        ]);
      }

      if (scan.complete) {
        console.log(`  scanned RoleGranted in ${scan.requests} request(s)`);
        // Only a complete scan may be cached - caching a partial one would
        // make the next run skip the blocks it never actually read.
        writeScanCache(env.network.name, address, {
          toBlock,
          byRole: Object.fromEntries(scanned),
        });
      } else {
        warn(
          `${key}: log scan failed (${scan.error}) after ${scan.requests} ` +
            'request(s), only the candidate list was checked - holders may ' +
            'be missing',
        );
      }
    }

    const roleNames = new Map(
      roles.map((role) => [role.hash.toLowerCase(), role.name]),
    );

    for (const role of roles) {
      const holders = await verifyHolders(probe, role.hash, [
        ...candidates,
        ...(scanned.get(role.hash.toLowerCase()) ?? []),
      ]);

      const desired = resolveRoleTarget(role.name, targets);

      // AccessControl gates grant/revoke behind the role's admin role, and the
      // deployer does not always hold it. Without this the plan plausibly
      // lists a transaction that reverts with AccessControlUnauthorizedAccount.
      const authority = await checkRoleAuthority(
        probe,
        role.hash,
        executor.address,
      );
      if (!authority.canExecute) {
        const adminName =
          roleNames.get(authority.adminRole.toLowerCase()) ??
          authority.adminRole;
        const whoCan = await verifyHolders(
          probe,
          authority.adminRole,
          holders.length > 0 ? [...candidates, ...holders] : candidates,
        );
        warn(
          `${key}.${role.name}: executor does not hold ${adminName}, cannot ` +
            `change this role - must be sent by ${
              whoCan.join(' or ') || 'a holder of ' + adminName
            }`,
        );
        console.log(`  ${role.name}: SKIPPED (no authority)`);
        continue;
      }

      // Contracts hold roles as integrations (Pyramid is an OPERATOR on
      // ArkadaRewarder); revoking those breaks the product, not the attacker.
      // The new owner is exempt - a Safe is a contract too, and dropping it
      // here would re-grant the same role on every run.
      const { wallets, contracts: contractHolders } =
        await partitionHoldersByCode(env.ethers.provider, holders);
      const kept = contractHolders.filter((holder) => holder !== desired);
      const rotatable = holders.filter((holder) => !kept.includes(holder));

      const planned = planRoleActions({
        contractLabel: key,
        contractAddress: address,
        role,
        holders: rotatable,
        desired,
        phase: PHASE,
      });

      console.log(
        `  ${role.name}: wallets [${
          wallets.join(', ') || 'none'
        }] -> ${desired}`,
      );
      if (kept.length > 0) {
        console.log(`    kept (contracts): ${kept.join(', ')}`);
      }
      if (planned.skipped) warn(`${key}.${role.name}: ${planned.skipped}`);
      actions.push(...planned.actions);
    }
  }

  // ------------------------------------------------------------- ownable

  if (PHASE === 'transfer') {
    for (const key of OWNABLE_KEYS) {
      const address = addresses[key];
      if (!address || !utils.isAddress(address)) continue;

      const probe = getProbeContract(address, [], executor);
      contracts.set(utils.getAddress(address), probe);

      const currentOwner = utils.getAddress(await probe.owner());
      console.log(`\n${key} @ ${address}\n  owner: ${currentOwner}`);

      if (currentOwner === targets.owner) continue;
      if (currentOwner !== executor.address) {
        warn(
          `${key}: owned by ${currentOwner}, not by the executor - the ` +
            'transfer must be sent from that account',
        );
        continue;
      }

      actions.push({
        kind: 'transferOwnership',
        contractLabel: key,
        contractAddress: address,
        account: targets.owner,
      });
    }

    // --------------------------------------------------------- proxyadmin

    const proxyCandidates = [...ACCESS_CONTROL_KEYS, ...OWNABLE_KEYS]
      .map((key) => addresses[key])
      .filter(
        (address): address is string => !!address && utils.isAddress(address),
      );

    const proxyAdmins = new Set<string>();
    for (const proxy of proxyCandidates) {
      const admin = await readProxyAdmin(env.ethers.provider, proxy);
      if (admin) proxyAdmins.add(admin);
    }

    for (const admin of proxyAdmins) {
      const proxyAdmin = new Contract(admin, PROXY_ADMIN_ABI, executor);
      contracts.set(admin, proxyAdmin);

      let currentOwner: string;
      try {
        currentOwner = utils.getAddress(await proxyAdmin.owner());
      } catch {
        warn(
          `ProxyAdmin ${admin}: owner() reverted - proxies may be admined ` +
            'directly by an EOA, check manually',
        );
        continue;
      }

      console.log(`\nProxyAdmin @ ${admin}\n  owner: ${currentOwner}`);

      if (currentOwner === targets.owner) continue;
      if (currentOwner !== executor.address) {
        warn(
          `ProxyAdmin ${admin}: owned by ${currentOwner}, not by the ` +
            'executor - the transfer must be sent from that account',
        );
        continue;
      }

      actions.push({
        kind: 'transferOwnership',
        contractLabel: 'ProxyAdmin',
        contractAddress: admin,
        account: targets.owner,
      });
    }
  }

  // ---------------------------------------------------------------- run

  const ordered = orderActions(actions, executor.address);

  console.log(`\n${'='.repeat(72)}`);
  console.log(`planned actions: ${ordered.length}`);
  ordered.forEach((action, index) =>
    console.log(`  ${index + 1}. ${describeAction(action)}`),
  );
  console.log('='.repeat(72));

  // Gas check before sending anything. An unfunded signer fails per chain with
  // whatever wording that node picked ("account does not exist" on Somnia),
  // which is a poor way to learn that a key was never topped up here.
  if (!DRY_RUN && ordered.length > 0) {
    const balance = await executor.getBalance();
    const gasPrice = await env.ethers.provider.getGasPrice();
    const estimate = gasPrice.mul(GAS_PER_ACTION).mul(ordered.length);

    console.log(
      `\nexecutor balance: ${utils.formatEther(balance)}, ` +
        `rough need: ${utils.formatEther(estimate)}`,
    );

    if (balance.isZero()) {
      throw new Error(
        `${executor.address} has no balance on ${env.network.name} - ` +
          'fund it before running this phase',
      );
    }
    if (balance.lt(estimate)) {
      warn(
        `${executor.address} may not have enough gas for ${ordered.length} ` +
          'transactions - top it up or expect the run to stop partway',
      );
    }
  }

  const results = await executeActions(
    ordered,
    (address) => {
      const contract = contracts.get(utils.getAddress(address));
      if (!contract) throw new Error(`no contract handle for ${address}`);
      return contract;
    },
    { dryRun: DRY_RUN },
  );

  const failed = results.filter((result) => result.status === 'failed');
  const unconfirmed = results.filter(
    (result) => result.status === 'unconfirmed',
  );
  const notAttempted = ordered.slice(results.length);

  console.log(`\ndone: ${results.length}/${ordered.length} actions processed`);

  if (notAttempted.length > 0) {
    console.log(`\nnot attempted (${notAttempted.length}):`);
    notAttempted.forEach((action) =>
      console.log(`  - ${describeAction(action)}`),
    );
    console.log(
      'Re-run this phase to pick them up - applied actions are skipped.',
    );
  }
  if (warnings.length > 0) {
    console.log(`\nwarnings (${warnings.length}):`);
    warnings.forEach((message) => console.log(`  - ${message}`));
  }
  if (unconfirmed.length > 0) {
    console.log('\nSTOPPED: a transaction was broadcast but not confirmed.');
    unconfirmed.forEach((result) =>
      console.log(`  check ${result.txHash} before re-running`),
    );
    process.exitCode = 1;
  }
  if (failed.length > 0) {
    console.log(
      '\nSTOPPED on a failed transaction, nothing after it was sent.',
    );
    process.exitCode = 1;
  }
  if (DRY_RUN) {
    console.log('\nDRY RUN - no transaction was sent.');
  }
};

func(hre).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
