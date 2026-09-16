import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { artifacts } from 'hardhat';

import {
  COMPANY_PASS_ROLE_ROUTING,
  EXTRA_PASS_HOLDER_CANDIDATES,
} from '../../scripts/rotation/company-pass.config';
import { DEFAULT_ROLE_TARGET } from '../../scripts/rotation/config';
import {
  RotationTargets,
  collectRoleGetterNames,
  executeActions,
  getProbeContract,
  orderActions,
  planRoleActions,
  probeRoles,
  resolveRoleTarget,
  scanRoleGrantedAccounts,
  verifyHolders,
} from '../../scripts/rotation/lib';
import { companyPassDeploy } from '../common/company-pass.fixtures';

const NEW_OWNER = '0xEc38A8ff6Ae438F3b3a585cc4E617135c94af229';
const NEW_SIGNER = '0x009B1D2b092d957e514E423C98a9c2AEBd252BfD';
const NEW_OPERATOR = '0x948908C1d4EDE75c9F20a3cC9ef8105e8F1bd4de';

const targets: RotationTargets = {
  owner: NEW_OWNER,
  operator: NEW_OPERATOR,
  signer: NEW_SIGNER,
};

const roleNames = async (): Promise<string[]> =>
  collectRoleGetterNames([
    (await artifacts.readArtifact('ArkadaCompanyPass')).abi,
  ]);

const target = (roleName: string) =>
  resolveRoleTarget(
    roleName,
    targets,
    COMPANY_PASS_ROLE_ROUTING,
    DEFAULT_ROLE_TARGET,
  );

describe('rotation/company-pass', () => {
  describe('roles', () => {
    it('Should discover exactly the roles the pass implements', async () => {
      const { companyPassContract, owner } = await loadFixture(
        companyPassDeploy,
      );

      const names = await roleNames();
      const roles = await probeRoles(
        getProbeContract(companyPassContract.address, names, owner),
        names,
      );

      expect(roles.map((role) => role.name)).to.deep.equal([
        'DEFAULT_ADMIN_ROLE',
        'SIGNER_ROLE',
        'URI_SETTER_ROLE',
      ]);
    });

    it('Should not pick up the EIP712 typehash as a role', async () => {
      expect(await roleNames()).to.not.include('MINT_PASS_DATA_HASH');
    });

    it('Should route every role of the pass to a real address', async () => {
      // A role missing from the routing falls back to the owner, so the point
      // here is that SIGNER_ROLE does NOT: minting recovers an EOA via ECDSA
      // and would break for good behind a multisig.
      expect(target('DEFAULT_ADMIN_ROLE')).to.equal(NEW_OWNER);
      expect(target('URI_SETTER_ROLE')).to.equal(NEW_OWNER);
      expect(target('SIGNER_ROLE')).to.equal(NEW_SIGNER);
    });
  });

  describe('holders', () => {
    it('Should find the holders granted after initialize', async () => {
      const { companyPassContract, owner, signer, uriSetter } =
        await loadFixture(companyPassDeploy);

      const names = await roleNames();
      const probe = getProbeContract(companyPassContract.address, names, owner);
      const scan = await scanRoleGrantedAccounts(probe);
      expect(scan.complete).to.equal(true);

      // initialize() grants DEFAULT_ADMIN_ROLE only - the other two are
      // granted afterwards, which is what the event scan is there to catch.
      const holdersOf = async (roleHash: string) =>
        verifyHolders(probe, roleHash, [
          ...EXTRA_PASS_HOLDER_CANDIDATES,
          ...(scan.byRole.get(roleHash.toLowerCase()) ?? []),
        ]);

      expect(
        await holdersOf(await companyPassContract.SIGNER_ROLE()),
      ).to.deep.equal([signer.address]);
      expect(
        await holdersOf(await companyPassContract.URI_SETTER_ROLE()),
      ).to.deep.equal([uriSetter.address]);
      expect(
        await holdersOf(await companyPassContract.DEFAULT_ADMIN_ROLE()),
      ).to.deep.equal([owner.address]);
    });
  });

  describe('phases', () => {
    it('Should grant, then revoke, and leave the new addresses in control', async () => {
      const { companyPassContract, owner, signer, uriSetter } =
        await loadFixture(companyPassDeploy);

      const names = await roleNames();
      const probe = getProbeContract(companyPassContract.address, names, owner);
      const roles = await probeRoles(probe, names);
      const candidates = [
        owner.address,
        signer.address,
        uriSetter.address,
        ...Object.values(targets),
      ];

      const plan = async (phase: 'grant' | 'revoke') => {
        const actions = [];
        for (const role of roles) {
          const holders = await verifyHolders(probe, role.hash, candidates);
          const planned = planRoleActions({
            contractLabel: 'ArkadaCompanyPass',
            contractAddress: companyPassContract.address,
            role,
            holders,
            desired: target(role.name),
            phase,
          });
          expect(planned.skipped).to.equal(undefined);
          actions.push(...planned.actions);
        }
        return orderActions(actions, owner.address);
      };

      const grants = await plan('grant');
      expect(grants).to.have.length(3);
      await executeActions(grants, () => probe, {
        dryRun: false,
        log: () => undefined,
      });

      const revokes = await plan('revoke');
      expect(
        revokes.map((action) => 'account' in action && action.account),
      ).to.deep.equal([signer.address, uriSetter.address, owner.address]);

      await executeActions(revokes, () => probe, {
        dryRun: false,
        log: () => undefined,
      });

      for (const role of roles) {
        expect(
          await companyPassContract.hasRole(role.hash, target(role.name)),
        ).to.equal(true);
      }
      for (const stale of [owner, signer, uriSetter]) {
        for (const role of roles) {
          expect(
            await companyPassContract.hasRole(role.hash, stale.address),
          ).to.equal(false);
        }
      }
    });

    it('Should refuse to revoke before the grant phase ran', async () => {
      const { companyPassContract, owner } = await loadFixture(
        companyPassDeploy,
      );

      const names = await roleNames();
      const probe = getProbeContract(companyPassContract.address, names, owner);
      const [role] = await probeRoles(probe, names);

      const planned = planRoleActions({
        contractLabel: 'ArkadaCompanyPass',
        contractAddress: companyPassContract.address,
        role,
        holders: [owner.address],
        desired: NEW_OWNER,
        phase: 'revoke',
      });

      // Otherwise the pass would be left with no admin at all - it is not
      // Ownable, DEFAULT_ADMIN_ROLE is the only way back in.
      expect(planned.actions).to.deep.equal([]);
      expect(planned.skipped).to.contain('run the grant phase first');
    });
  });

  describe('proxy admin', () => {
    it('Should have no owner() of its own to transfer', async () => {
      const { companyPassContract, owner } = await loadFixture(
        companyPassDeploy,
      );

      // The pass is not Ownable: the only ownership the transfer phase moves
      // is the ProxyAdmin behind the ERC1967 slot.
      const probe = getProbeContract(companyPassContract.address, [], owner);
      await expect(probe.owner()).to.be.reverted;
    });
  });
});
