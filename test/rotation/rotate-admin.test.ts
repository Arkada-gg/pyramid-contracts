import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { utils } from 'ethers';
import { artifacts, ethers } from 'hardhat';

import { RoleTargetKind } from '../../scripts/rotation/config';
import {
  DEFAULT_ADMIN_ROLE_NAME,
  ERC1967_ADMIN_SLOT,
  RotationAction,
  RotationTargets,
  checkRoleAuthority,
  collectRoleGetterNames,
  executeActions,
  findDeploymentBlock,
  getProbeContract,
  isTransientRpcError,
  orderActions,
  partitionHoldersByCode,
  planRoleActions,
  probeRoles,
  readProxyAdmin,
  resolveRoleTarget,
  scanRoleGrantedAccounts,
  verifyHolders,
  withRetry,
} from '../../scripts/rotation/lib';
import { defaultDeploy } from '../common/fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const abiOf = async (name: string): Promise<any[]> =>
  (await artifacts.readArtifact(name)).abi;

const ROUTING: Record<string, RoleTargetKind> = {
  DEFAULT_ADMIN_ROLE: 'owner',
  ADMIN_ROLE: 'owner',
  URI_SETTER_ROLE: 'owner',
  WITHDRAWER_ROLE: 'owner',
  OPERATOR_ROLE: 'operator',
  MINTER_ROLE: 'operator',
  DISTRIBUTOR_ROLE: 'operator',
  SIGNER_ROLE: 'signer',
};

const targets = (
  owner: string,
  operator = '',
  signer = '',
): RotationTargets => ({ owner, operator, signer });

describe('rotation/lib', () => {
  describe('collectRoleGetterNames', () => {
    it('Should collect every role declared across the contracts', async () => {
      const names = collectRoleGetterNames([
        await abiOf('Pyramid'),
        await abiOf('ArkadaPVPArenaV3'),
        await abiOf('GlobalEscrow'),
        await abiOf('ArkadaRewarder'),
      ]);

      expect(names).to.include.members([
        'DEFAULT_ADMIN_ROLE',
        'ADMIN_ROLE',
        'SIGNER_ROLE',
        'OPERATOR_ROLE',
        'DISTRIBUTOR_ROLE',
        'WITHDRAWER_ROLE',
      ]);
    });

    it('Should not treat other bytes32 getters as roles', async () => {
      const names = collectRoleGetterNames([await abiOf('Pyramid')]);

      const nonRoles = names.filter((name) => !name.endsWith('_ROLE'));
      expect(nonRoles).to.deep.equal([]);
    });

    it('Should always include DEFAULT_ADMIN_ROLE', () => {
      expect(collectRoleGetterNames([])).to.deep.equal([
        DEFAULT_ADMIN_ROLE_NAME,
      ]);
    });
  });

  describe('resolveRoleTarget', () => {
    const owner = '0x1111111111111111111111111111111111111111';
    const operator = '0x2222222222222222222222222222222222222222';
    const signer = '0x3333333333333333333333333333333333333333';

    it('Should send signing roles to the hot signer', () => {
      expect(
        resolveRoleTarget(
          'SIGNER_ROLE',
          targets(owner, operator, signer),
          ROUTING,
        ),
      ).to.equal(signer);
    });

    it('Should keep fund withdrawal with the owner', () => {
      expect(
        resolveRoleTarget(
          'WITHDRAWER_ROLE',
          targets(owner, operator, signer),
          ROUTING,
        ),
      ).to.equal(owner);
    });

    it('Should route unknown roles to the owner', () => {
      expect(
        resolveRoleTarget(
          'SOME_NEW_ROLE',
          targets(owner, operator, signer),
          ROUTING,
        ),
      ).to.equal(owner);
    });

    it('Should fall back to the owner when the hot wallet is unset', () => {
      expect(
        resolveRoleTarget('SIGNER_ROLE', targets(owner), ROUTING),
      ).to.equal(owner);
    });
  });

  describe('planRoleActions', () => {
    const role = { name: 'SIGNER_ROLE', hash: utils.id('SIGNER') };
    const holder = '0x1111111111111111111111111111111111111111';
    const desired = '0x2222222222222222222222222222222222222222';
    const base = {
      contractLabel: 'pyramid',
      contractAddress: '0x3333333333333333333333333333333333333333',
      role,
    };

    it('Should grant the role to the new address', () => {
      const { actions } = planRoleActions({
        ...base,
        holders: [holder],
        desired,
        phase: 'grant',
      });

      expect(actions).to.have.lengthOf(1);
      expect(actions[0].kind).to.equal('grantRole');
      expect(actions[0].account).to.equal(desired);
    });

    it('Should not re-grant a role the new address already holds', () => {
      const { actions } = planRoleActions({
        ...base,
        holders: [holder, desired],
        desired,
        phase: 'grant',
      });

      expect(actions).to.deep.equal([]);
    });

    it('Should revoke every stale holder once the new address is in place', () => {
      const other = '0x4444444444444444444444444444444444444444';
      const { actions } = planRoleActions({
        ...base,
        holders: [holder, other, desired],
        desired,
        phase: 'revoke',
      });

      expect(actions.map((action) => action.account)).to.deep.equal([
        holder,
        other,
      ]);
      expect(actions.every((action) => action.kind === 'revokeRole')).to.equal(
        true,
      );
    });

    it('Should never revoke the target, even when it is the executor', () => {
      const executorAndTarget = desired;
      const { actions } = planRoleActions({
        ...base,
        holders: [holder, executorAndTarget],
        desired: executorAndTarget,
        phase: 'revoke',
      });

      // Running revoke as the new admin is the recommended way round, so the
      // plan must never strip the account doing the stripping.
      expect(actions.map((action) => action.account)).to.deep.equal([holder]);

      const ordered = orderActions(actions, executorAndTarget);
      expect(
        ordered.some((action) => action.account === executorAndTarget),
      ).to.equal(false);
    });

    it('Should refuse to revoke before the grant phase ran', () => {
      const { actions, skipped } = planRoleActions({
        ...base,
        holders: [holder],
        desired,
        phase: 'revoke',
      });

      expect(actions).to.deep.equal([]);
      expect(skipped).to.contain('grant phase first');
    });
  });

  describe('withRetry', () => {
    it('Should retry an RPC hiccup and give up on a revert', async () => {
      expect(
        isTransientRpcError('More than 3000 archived blocks queried'),
      ).to.eq(true);
      expect(isTransientRpcError('execution reverted')).to.equal(false);

      let calls = 0;
      const result = await withRetry(
        async () => {
          calls += 1;
          if (calls === 1) throw new Error('rate limit exceeded');
          return 'ok';
        },
        { delayMs: 1, log: () => undefined },
      );
      expect(result).to.equal('ok');
      expect(calls).to.equal(2);

      let revertCalls = 0;
      await expect(
        withRetry(
          async () => {
            revertCalls += 1;
            throw new Error('execution reverted');
          },
          { delayMs: 1 },
        ),
      ).to.be.rejectedWith('execution reverted');
      expect(revertCalls).to.equal(1);
    });
  });

  describe('gas pre-flight', () => {
    it('Should catch an unfunded signer before sending anything', async () => {
      const { pyramidContract } = await loadFixture(defaultDeploy);
      const empty = ethers.Wallet.createRandom().connect(ethers.provider);

      // What the script checks before it starts sending: a zero balance means
      // every transaction would fail, with wording that varies per chain.
      expect((await empty.getBalance()).isZero()).to.equal(true);

      const probe = getProbeContract(
        pyramidContract.address,
        ['DEFAULT_ADMIN_ROLE'],
        empty,
      );
      await expect(
        probe.grantRole(
          await pyramidContract.DEFAULT_ADMIN_ROLE(),
          empty.address,
        ),
      ).to.be.rejected;
    });
  });

  describe('orderActions', () => {
    it('Should revoke the executor own admin role last', () => {
      const executor = '0x1111111111111111111111111111111111111111';
      const other = '0x2222222222222222222222222222222222222222';
      const contractAddress = '0x3333333333333333333333333333333333333333';

      const revoke = (roleName: string, account: string): RotationAction => ({
        kind: 'revokeRole',
        contractLabel: 'pyramid',
        contractAddress,
        roleName,
        roleHash: utils.id(roleName),
        account,
      });

      const ordered = orderActions(
        [
          revoke(DEFAULT_ADMIN_ROLE_NAME, executor),
          revoke(DEFAULT_ADMIN_ROLE_NAME, other),
          revoke('SIGNER_ROLE', executor),
        ],
        executor,
      );

      expect(
        ordered.map((action) => [
          (action as { roleName: string }).roleName,
          action.account,
        ]),
      ).to.deep.equal([
        ['SIGNER_ROLE', executor],
        [DEFAULT_ADMIN_ROLE_NAME, other],
        [DEFAULT_ADMIN_ROLE_NAME, executor],
      ]);
    });

    it('Should keep grants ahead of revocations', () => {
      const executor = '0x1111111111111111111111111111111111111111';
      const contractAddress = '0x3333333333333333333333333333333333333333';
      const ordered = orderActions(
        [
          {
            kind: 'revokeRole',
            contractLabel: 'pyramid',
            contractAddress,
            roleName: DEFAULT_ADMIN_ROLE_NAME,
            roleHash: utils.id('admin'),
            account: executor,
          },
          {
            kind: 'grantRole',
            contractLabel: 'pyramid',
            contractAddress,
            roleName: DEFAULT_ADMIN_ROLE_NAME,
            roleHash: utils.id('admin'),
            account: executor,
          },
        ],
        executor,
      );

      expect(ordered[0].kind).to.equal('grantRole');
    });
  });

  describe('readProxyAdmin', () => {
    it('Should use the ERC1967 admin slot', () => {
      const expected = utils.hexZeroPad(
        utils.hexlify(
          ethers.BigNumber.from(utils.id('eip1967.proxy.admin')).sub(1),
        ),
        32,
      );

      expect(ERC1967_ADMIN_SLOT).to.equal(expected);
    });

    it('Should return undefined for a contract that is not a proxy', async () => {
      const { pyramidContract } = await loadFixture(defaultDeploy);

      expect(
        await readProxyAdmin(ethers.provider, pyramidContract.address),
      ).to.equal(undefined);
    });
  });

  describe('findDeploymentBlock', () => {
    it('Should find the block the contract was deployed in', async () => {
      const [sender] = await ethers.getSigners();

      const boost = await (
        await ethers.getContractFactory('ArkadaMapBoost')
      ).deploy();
      const deployedAt = (await boost.deployTransaction.wait()).blockNumber;

      // Real transactions rather than hardhat_mine: bulk-mined blocks carry no
      // queryable state, so getCode on them answers '0x'.
      for (let i = 0; i < 5; i += 1) {
        await (await sender.sendTransaction({ to: sender.address })).wait();
      }

      expect(
        await findDeploymentBlock(ethers.provider, boost.address),
      ).to.equal(deployedAt);
    });

    it('Should reject an address with no code', async () => {
      const [, , someone] = await ethers.getSigners();

      await expect(
        findDeploymentBlock(ethers.provider, someone.address),
      ).to.be.rejectedWith('no contract at');
    });
  });

  describe('partitionHoldersByCode', () => {
    it('Should keep contract holders apart from wallets', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);

      const { wallets, contracts } = await partitionHoldersByCode(
        ethers.provider,
        [owner.address, pyramidContract.address],
      );

      expect(wallets).to.deep.equal([owner.address]);
      expect(contracts).to.deep.equal([pyramidContract.address]);
    });
  });

  describe('on-chain rotation', () => {
    it('Should discover the roles a deployed contract implements', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);

      const names = collectRoleGetterNames([
        await abiOf('Pyramid'),
        await abiOf('ArkadaPVPArenaV3'),
        await abiOf('GlobalEscrow'),
      ]);
      const probe = getProbeContract(pyramidContract.address, names, owner);
      const roles = await probeRoles(probe, names);

      expect(roles.map((role) => role.name)).to.deep.equal([
        'DEFAULT_ADMIN_ROLE',
        'SIGNER_ROLE',
      ]);
      expect(roles[1].hash).to.equal(await pyramidContract.SIGNER_ROLE());
    });

    it('Should find a holder that is not on the candidate list', async () => {
      const { pyramidContract, owner, questSigner } = await loadFixture(
        defaultDeploy,
      );

      const probe = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        owner,
      );
      const signerRole = await pyramidContract.SIGNER_ROLE();

      const scan = await scanRoleGrantedAccounts(probe);
      expect(scan.complete).to.equal(true);

      const holders = await verifyHolders(probe, signerRole, [
        owner.address,
        ...(scan.byRole.get(signerRole.toLowerCase()) ?? []),
      ]);

      expect(holders).to.deep.equal([questSigner.address]);
    });

    it('Should scan every role in a single pass', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);

      const probe = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        owner,
      );
      const scan = await scanRoleGrantedAccounts(probe);

      // Admin granted at initialize, signer granted after - two distinct roles
      // out of one request, rather than one request per role.
      expect(scan.requests).to.equal(1);
      expect(scan.byRole.size).to.equal(2);
      expect(
        scan.byRole.get((await pyramidContract.SIGNER_ROLE()).toLowerCase()),
      ).to.deep.equal([(await ethers.getSigners())[3].address]);
    });

    /**
     * Public RPCs cap eth_getLogs and the in-process hardhat node never does,
     * so the refusal is simulated for any range wider than `limit`.
     */
    const refuseWiderThan = (
      contract: {
        queryFilter: (...args: unknown[]) => Promise<unknown>;
      },
      limit: number,
    ) => {
      const original = contract.queryFilter.bind(contract);
      // eslint-disable-next-line no-param-reassign
      contract.queryFilter = async (...args: unknown[]) => {
        const [, from, to] = args as [unknown, number, number];
        if (to - from + 1 > limit) {
          throw new Error('query returned more than 10000 results');
        }
        return original(...args);
      };
    };

    it('Should reuse the first accepted width instead of re-probing', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);

      const probe = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        owner,
      );
      const widths: number[] = [];
      const original = probe.queryFilter.bind(probe);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (probe as any).queryFilter = async (...args: unknown[]) => {
        const [, from, to] = args as [unknown, number, number];
        widths.push(to - from + 1);
        if (to - from + 1 > 2) {
          throw new Error('query returned more than 10000 results');
        }
        return original(...(args as Parameters<typeof original>));
      };

      const scan = await scanRoleGrantedAccounts(probe, { maxRequests: 200 });

      expect(scan.complete).to.equal(true);
      // Once a width of 2 or less is accepted, no wider range is attempted
      // again - every later request stays within the learned window.
      const firstAccepted = widths.findIndex((width) => width <= 2);
      expect(widths.slice(firstAccepted).every((width) => width <= 2)).to.equal(
        true,
      );
    });

    it('Should halve the range until the RPC accepts it', async () => {
      const { pyramidContract, owner, questSigner } = await loadFixture(
        defaultDeploy,
      );

      const probe = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        owner,
      );
      const signerRole = await pyramidContract.SIGNER_ROLE();
      refuseWiderThan(probe as never, 4);

      const scan = await scanRoleGrantedAccounts(probe, { maxRequests: 200 });

      expect(scan.complete).to.equal(true);
      expect(scan.requests).to.be.greaterThan(1);
      expect(
        await verifyHolders(probe, signerRole, [
          ...(scan.byRole.get(signerRole.toLowerCase()) ?? []),
        ]),
      ).to.deep.equal([questSigner.address]);
    });

    it('Should report an incomplete scan instead of guessing', async () => {
      const { pyramidContract, owner, questSigner } = await loadFixture(
        defaultDeploy,
      );

      const probe = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        owner,
      );
      const signerRole = await pyramidContract.SIGNER_ROLE();
      refuseWiderThan(probe as never, 0);

      const scan = await scanRoleGrantedAccounts(probe, { maxRequests: 3 });

      expect(scan.complete).to.equal(false);
      expect(scan.error).to.contain('gave up after 3 requests');
      expect(scan.byRole.size).to.equal(0);

      // The candidate list still works, and is all the caller may claim.
      expect(
        await verifyHolders(probe, signerRole, [
          owner.address,
          questSigner.address,
        ]),
      ).to.deep.equal([questSigner.address]);
    });

    it('Should report that a non-admin executor cannot change a role', async () => {
      const { pyramidContract, owner, user } = await loadFixture(defaultDeploy);

      const signerRole = await pyramidContract.SIGNER_ROLE();
      const adminRole = await pyramidContract.DEFAULT_ADMIN_ROLE();

      const asOwner = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        owner,
      );
      const asUser = getProbeContract(
        pyramidContract.address,
        ['SIGNER_ROLE'],
        user,
      );

      const allowed = await checkRoleAuthority(
        asOwner,
        signerRole,
        owner.address,
      );
      const denied = await checkRoleAuthority(asUser, signerRole, user.address);

      expect(allowed.adminRole).to.equal(adminRole);
      expect(allowed.canExecute).to.equal(true);
      expect(denied.canExecute).to.equal(false);
    });

    it('Should move every role off the old holders and keep the admin last', async () => {
      const { pyramidContract, owner, questSigner, regularAccounts } =
        await loadFixture(defaultDeploy);

      const [newOwner, newSigner] = regularAccounts;
      const rotationTargets = targets(newOwner.address, '', newSigner.address);
      const names = ['DEFAULT_ADMIN_ROLE', 'SIGNER_ROLE'];
      const probe = getProbeContract(pyramidContract.address, names, owner);
      const roles = await probeRoles(probe, names);

      const plan = async (phase: 'grant' | 'revoke') => {
        const actions: RotationAction[] = [];
        for (const role of roles) {
          const scan = await scanRoleGrantedAccounts(probe);
          const holders = await verifyHolders(probe, role.hash, [
            owner.address,
            ...(scan.byRole.get(role.hash.toLowerCase()) ?? []),
          ]);
          actions.push(
            ...planRoleActions({
              contractLabel: 'pyramid',
              contractAddress: pyramidContract.address,
              role,
              holders,
              desired: resolveRoleTarget(role.name, rotationTargets, ROUTING),
              phase,
            }).actions,
          );
        }
        return orderActions(actions, owner.address);
      };

      const contractFor = () => probe;
      const noop = () => undefined;

      const granted = await executeActions(await plan('grant'), contractFor, {
        dryRun: false,
        log: noop,
      });
      expect(granted.every((result) => result.status === 'sent')).to.equal(
        true,
      );

      const revocations = await plan('revoke');
      const last = revocations[revocations.length - 1];
      expect(last.kind).to.equal('revokeRole');
      expect((last as { roleName: string }).roleName).to.equal(
        DEFAULT_ADMIN_ROLE_NAME,
      );
      expect(last.account).to.equal(owner.address);

      const revoked = await executeActions(revocations, contractFor, {
        dryRun: false,
        log: noop,
      });
      expect(revoked.every((result) => result.status === 'sent')).to.equal(
        true,
      );

      const adminRole = await pyramidContract.DEFAULT_ADMIN_ROLE();
      const signerRole = await pyramidContract.SIGNER_ROLE();

      expect(await pyramidContract.hasRole(adminRole, newOwner.address)).to.eq(
        true,
      );
      expect(
        await pyramidContract.hasRole(signerRole, newSigner.address),
      ).to.eq(true);
      expect(await pyramidContract.hasRole(adminRole, owner.address)).to.eq(
        false,
      );
      expect(
        await pyramidContract.hasRole(signerRole, questSigner.address),
      ).to.eq(false);
    });

    it('Should not send anything in dry run mode', async () => {
      const { pyramidContract, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      const [newOwner] = regularAccounts;
      const adminRole = await pyramidContract.DEFAULT_ADMIN_ROLE();
      const probe = getProbeContract(
        pyramidContract.address,
        ['DEFAULT_ADMIN_ROLE'],
        owner,
      );

      const results = await executeActions(
        [
          {
            kind: 'grantRole',
            contractLabel: 'pyramid',
            contractAddress: pyramidContract.address,
            roleName: DEFAULT_ADMIN_ROLE_NAME,
            roleHash: adminRole,
            account: newOwner.address,
          },
        ],
        () => probe,
        { dryRun: true, log: () => undefined },
      );

      expect(results[0].status).to.equal('dry-run');
      expect(await pyramidContract.hasRole(adminRole, newOwner.address)).to.eq(
        false,
      );
    });

    it('Should transfer ownership of an Ownable contract', async () => {
      const [owner, treasury, newOwner] = await ethers.getSigners();

      const boost = await (
        await ethers.getContractFactory('ArkadaMapBoost', owner)
      ).deploy();
      await boost.initialize(
        'Boost',
        'BST',
        'ipfs://',
        owner.address,
        treasury.address,
        utils.parseEther('0.01'),
      );

      const probe = getProbeContract(boost.address, [], owner);

      await executeActions(
        [
          {
            kind: 'transferOwnership',
            contractLabel: 'arkadaMapBoost',
            contractAddress: boost.address,
            account: newOwner.address,
          },
        ],
        () => probe,
        { dryRun: false, log: () => undefined },
      );

      expect(await boost.owner()).to.equal(newOwner.address);
    });

    it('Should not call a broadcast transaction failed when only the receipt is lost', async () => {
      const { pyramidContract, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      const [newOwner] = regularAccounts;
      const adminRole = await pyramidContract.DEFAULT_ADMIN_ROLE();
      const probe = getProbeContract(
        pyramidContract.address,
        ['DEFAULT_ADMIN_ROLE'],
        owner,
      );

      // The send goes through and the grant lands; reading the receipt is
      // what the RPC refuses.
      const lossyReceipt = {
        grantRole: async (role: string, account: string) => {
          const tx = await probe.grantRole(role, account);
          await tx.wait();
          return {
            hash: tx.hash,
            wait: async () => {
              throw new Error(
                'More than 3000 archived blocks queried in one day',
              );
            },
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const results = await executeActions(
        [
          {
            kind: 'grantRole',
            contractLabel: 'pyramid',
            contractAddress: pyramidContract.address,
            roleName: DEFAULT_ADMIN_ROLE_NAME,
            roleHash: adminRole,
            account: newOwner.address,
          },
        ],
        () => lossyReceipt,
        { dryRun: false, log: () => undefined, retry: { delayMs: 1 } },
      );

      expect(results[0].status).to.equal('unconfirmed');
      expect(results[0].txHash).to.be.a('string');
      // The grant did land, which is exactly why 'failed' would mislead.
      expect(await pyramidContract.hasRole(adminRole, newOwner.address)).to.eq(
        true,
      );
    });

    it('Should stop at the first failed transaction', async () => {
      const { pyramidContract, user, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      const [newOwner] = regularAccounts;
      const adminRole = await pyramidContract.DEFAULT_ADMIN_ROLE();
      // `user` holds no admin role, so the first grant reverts.
      const probe = getProbeContract(
        pyramidContract.address,
        ['DEFAULT_ADMIN_ROLE'],
        user,
      );

      const action = (account: string): RotationAction => ({
        kind: 'grantRole',
        contractLabel: 'pyramid',
        contractAddress: pyramidContract.address,
        roleName: DEFAULT_ADMIN_ROLE_NAME,
        roleHash: adminRole,
        account,
      });

      const results = await executeActions(
        [action(newOwner.address), action(user.address)],
        () => probe,
        { dryRun: false, log: () => undefined },
      );

      expect(results).to.have.lengthOf(1);
      expect(results[0].status).to.equal('failed');
    });
  });
});
