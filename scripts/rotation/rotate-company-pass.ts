import { Contract, utils } from 'ethers';
import * as hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  COMPANY_PASS_ADDRESSES,
  COMPANY_PASS_ROLE_ROUTING,
  DRY_RUN,
  EXTRA_PASS_HOLDER_CANDIDATES,
  PHASE,
  SCAN_EVENTS,
  SCAN_MAX_REQUESTS,
} from './company-pass.config';
import {
  COMPROMISED_DEPLOYER,
  DEFAULT_ROLE_TARGET,
  EXTRA_HOLDER_CANDIDATES,
  KNOWN_HOLDER_CANDIDATES,
  NEW_OPERATOR,
  NEW_OWNER,
  NEW_SIGNER,
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

import { ARKADA_COMPANY_PASS_CONTRACT_NAME } from '../../config';

/**
 * Rotation of ArkadaCompanyPass only.
 *
 * `rotate-admin.ts` walks the contracts listed in
 * `config/constants/addresses.ts` and that rotation is already done. The pass
 * was deployed after it, is not in that registry, and needs the same three
 * phases on its own - hence a separate entry point over the same `lib.ts`.
 *
 * Two things are specific to this contract:
 *  - it is not Ownable, so the only ownership to move is the ProxyAdmin that
 *    can upgrade it;
 *  - `initialize` grants DEFAULT_ADMIN_ROLE and nothing else, so `grant` is
 *    also the phase that first hands out SIGNER_ROLE and URI_SETTER_ROLE.
 */

/** Generous per-action gas figure, only used for the pre-flight balance check. */
const GAS_PER_ACTION = 120_000;

const PROXY_ADMIN_ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
];

/** Getters used to confirm an address really is a company pass. */
const IDENTITY_ABI = [
  'function companyPassVersion() pure returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function s_treasury() view returns (address)',
];

const warnings: string[] = [];

const warn = (message: string) => {
  warnings.push(message);
  console.log(`  !! ${message}`);
};

/**
 * Role getters declared by ArkadaCompanyPass.
 *
 * Read from this one artifact rather than from every contract in the repo:
 * the deployed implementation is the one this repo compiles, so probing the
 * unrelated roles of other contracts would only cost calls.
 */
const readRoleGetterNames = async (env: HardhatRuntimeEnvironment) => {
  const { abi } = await env.artifacts.readArtifact(
    ARKADA_COMPANY_PASS_CONTRACT_NAME,
  );
  return collectRoleGetterNames([abi]);
};

/**
 * Confirms the configured address is a company pass and returns its treasury.
 * A wrong address in the config would otherwise be probed for roles, find
 * DEFAULT_ADMIN_ROLE on some unrelated contract, and be rotated.
 */
const identifyPass = async (
  env: HardhatRuntimeEnvironment,
  address: string,
): Promise<{ label: string; treasury?: string } | null> => {
  const pass = new Contract(address, IDENTITY_ABI, env.ethers.provider);
  try {
    const [version, name, symbol] = await Promise.all([
      pass.companyPassVersion(),
      pass.name(),
      pass.symbol(),
    ]);
    let treasury: string | undefined;
    try {
      treasury = utils.getAddress(await pass.s_treasury());
    } catch {
      // Older implementation without the getter - not worth stopping for.
    }
    return { label: `${name} (${symbol}), version ${version}`, treasury };
  } catch {
    return null;
  }
};

const func = async (env: HardhatRuntimeEnvironment) => {
  const configured = COMPANY_PASS_ADDRESSES[env.network.name] ?? [];
  if (configured.length === 0) {
    throw new Error(
      `no ArkadaCompanyPass address configured for network ${env.network.name} ` +
        '- add it to COMPANY_PASS_ADDRESSES in scripts/rotation/company-pass.config.ts',
    );
  }
  for (const address of configured) {
    if (!utils.isAddress(address)) {
      throw new Error(`${address} is not a valid address`);
    }
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

  // A typo here would hand the pass straight back to the stolen key.
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
  console.log('ArkadaCompanyPass rotation');
  console.log(`network:  ${env.network.name}`);
  console.log(`phase:    ${PHASE}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`executor: ${executor.address}`);
  console.log(`owner:    ${targets.owner}`);
  console.log(`operator: ${targets.operator || '-> owner'}`);
  console.log(`signer:   ${targets.signer || '-> owner'}`);
  console.log('='.repeat(72));

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
      'NEW_SIGNER is empty: SIGNER_ROLE goes to the multisig and mintPass ' +
        'stops working entirely (the contract recovers an EOA via ECDSA)',
    );
  }
  if (!SCAN_EVENTS && PHASE === 'revoke') {
    warn(
      'SCAN_EVENTS is off: only the addresses in the candidate lists are ' +
        'checked, any other holder keeps its role',
    );
  }

  const roleGetterNames = await readRoleGetterNames(env);
  const candidates = [
    ...KNOWN_HOLDER_CANDIDATES,
    ...EXTRA_HOLDER_CANDIDATES,
    ...EXTRA_PASS_HOLDER_CANDIDATES,
    executor.address,
    targets.owner,
    targets.operator,
    targets.signer,
  ].filter(Boolean);

  const actions: RotationAction[] = [];
  const contracts = new Map<string, Contract>();
  const passes: string[] = [];

  // ---------------------------------------------------------------- roles

  for (const address of configured) {
    console.log(`\nArkadaCompanyPass @ ${address}`);

    if ((await env.ethers.provider.getCode(address)) === '0x') {
      warn(`${address}: no contract deployed at this address, skipping`);
      continue;
    }

    const identity = await identifyPass(env, address);
    if (!identity) {
      warn(
        `${address}: does not answer companyPassVersion()/name()/symbol() - ` +
          'this is not an ArkadaCompanyPass proxy, skipping',
      );
      continue;
    }
    console.log(`  ${identity.label}`);
    passes.push(utils.getAddress(address));

    // The treasury takes every mint payment. It is not part of AccessControl,
    // so no phase of this script can move it - it has to be reported.
    if (identity.treasury) {
      const compromised = utils.getAddress(COMPROMISED_DEPLOYER);
      console.log(`  treasury: ${identity.treasury}`);
      if (identity.treasury === compromised) {
        warn(
          `${address}: treasury is the compromised deployer - call ` +
            'setTreasury from the admin, this script does not touch it',
        );
      }
    }

    const probe = getProbeContract(address, roleGetterNames, executor);
    contracts.set(utils.getAddress(address), probe);

    const roles = await probeRoles(probe, roleGetterNames);
    if (roles.length === 0) {
      warn(`${address}: no roles found, is this really the pass?`);
      continue;
    }

    // Only revoke needs the full holder set; grant decides on whether the new
    // address already has the role.
    const scanned = new Map<string, string[]>();
    if (SCAN_EVENTS && PHASE === 'revoke') {
      let fromBlock: number | undefined;
      try {
        fromBlock = await findDeploymentBlock(env.ethers.provider, address);
        console.log(`  deployed at block ${fromBlock}`);
      } catch (error) {
        warn(
          `${address}: could not locate the deployment block ` +
            `(${(error as Error).message}), scanning from block 0`,
        );
      }

      const scan = await scanRoleGrantedAccounts(probe, {
        fromBlock,
        maxRequests: SCAN_MAX_REQUESTS,
      });

      for (const [role, accounts] of scan.byRole) {
        // Re-grants show up as repeated events; one entry per account is enough.
        scanned.set(role, [...new Set(accounts)]);
      }

      if (scan.complete) {
        console.log(`  scanned RoleGranted in ${scan.requests} request(s)`);
      } else {
        warn(
          `${address}: log scan failed (${scan.error}) after ` +
            `${scan.requests} request(s), only the candidate list was ` +
            'checked - holders may be missing',
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

      const desired = resolveRoleTarget(
        role.name,
        targets,
        COMPANY_PASS_ROLE_ROUTING,
        DEFAULT_ROLE_TARGET,
      );

      // AccessControl gates grant/revoke behind the role's admin role. Without
      // this the plan lists a transaction that reverts with
      // AccessControlUnauthorizedAccount.
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
          `${role.name}: executor does not hold ${adminName}, cannot change ` +
            `this role - must be sent by ${
              whoCan.join(' or ') || 'a holder of ' + adminName
            }`,
        );
        console.log(`  ${role.name}: SKIPPED (no authority)`);
        continue;
      }

      // A role held by a contract is an integration, not a leaked key. The
      // pass has none today, but a future one must not be revoked blindly.
      const { wallets, contracts: contractHolders } =
        await partitionHoldersByCode(env.ethers.provider, holders);
      const kept = contractHolders.filter((holder) => holder !== desired);
      const rotatable = holders.filter((holder) => !kept.includes(holder));

      const planned = planRoleActions({
        contractLabel: 'ArkadaCompanyPass',
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
      // initialize() only grants DEFAULT_ADMIN_ROLE, so an empty holder set on
      // the other two roles is expected, not a sign of a bad candidate list.
      if (holders.length === 0 && PHASE === 'grant') {
        console.log('    nobody holds this role yet - first grant');
      }
      if (kept.length > 0) {
        console.log(`    kept (contracts): ${kept.join(', ')}`);
      }
      if (planned.skipped) warn(`${role.name}: ${planned.skipped}`);
      actions.push(...planned.actions);
    }
  }

  // --------------------------------------------------------- proxyadmin

  // The pass is not Ownable - the only ownership it has is the ProxyAdmin
  // that can upgrade the implementation behind the proxy.
  if (PHASE === 'transfer') {
    const proxyAdmins = new Set<string>();
    for (const proxy of passes) {
      const admin = await readProxyAdmin(env.ethers.provider, proxy);
      if (admin) {
        proxyAdmins.add(admin);
      } else {
        warn(
          `${proxy}: ERC1967 admin slot is empty - not a transparent proxy, ` +
            'check how this pass is upgraded',
        );
      }
    }

    for (const admin of proxyAdmins) {
      const proxyAdmin = new Contract(admin, PROXY_ADMIN_ABI, executor);
      contracts.set(admin, proxyAdmin);

      let currentOwner: string;
      try {
        currentOwner = utils.getAddress(await proxyAdmin.owner());
      } catch {
        warn(
          `ProxyAdmin ${admin}: owner() reverted - the proxy may be admined ` +
            'directly by an EOA, check manually',
        );
        continue;
      }

      console.log(`\nProxyAdmin @ ${admin}\n  owner: ${currentOwner}`);

      // The pass was deployed through the same manifest as everything else,
      // so its ProxyAdmin is usually the one already handed over.
      if (currentOwner === targets.owner) {
        console.log('  already owned by the new owner');
        continue;
      }
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

  // Gas check before sending anything: an unfunded signer fails per chain with
  // whatever wording that node picked, which is a poor way to learn a key was
  // never topped up here.
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
