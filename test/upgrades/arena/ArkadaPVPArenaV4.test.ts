import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';

import { ArkadaPVPArena, ArkadaPVPArenaV4 } from '../../../typechain-types';
import {
  ArenaType,
  createArenaV3Test,
  setMinEntryFeeTest,
} from '../../common/pvp-arena.helpers';

const upgradeFixture = async () => {
  const [
    owner,
    user,
    treasury,
    arenaSigner,
    admin,
    operator,
    ...regularAccounts
  ] = await ethers.getSigners();

  const { chainId } = await ethers.provider.getNetwork();

  const arenaDomain = {
    name: 'ArenaPVP',
    version: '1',
  };

  const arenaInitialConfig = {
    feeBPS: 100,
    timeLeftForRebuyBPS: 100,
    playersConfig: {
      min: 3,
      max: 50,
    },
    intervalToStartConfig: {
      min: 60 * 60,
      max: 60 * 60 * 5,
    },
    durationConfig: {
      min: 60 * 60,
      max: 60 * 60 * 5,
    },
  };
  // Deploy Pyramid contract as upgradeable proxy
  const ArenaFactory = await ethers.getContractFactory('ArkadaPVPArenaV3');
  const arenaContract = (await upgrades.deployProxy(
    ArenaFactory,
    [
      arenaDomain.name,
      arenaDomain.version,
      {
        treasury: treasury.address,
        admin: owner.address,
        signer: arenaSigner.address,
        operator: operator.address,
      },
      arenaInitialConfig.feeBPS,
      arenaInitialConfig.timeLeftForRebuyBPS,
      arenaInitialConfig.playersConfig,
      arenaInitialConfig.intervalToStartConfig,
      arenaInitialConfig.durationConfig,
    ],
    {
      unsafeAllow: ['constructor'],
    },
  )) as ArkadaPVPArena;
  await arenaContract.deployed();

  // Deploy the new implementation and upgrade
  const ArkadaPVPArenaV4Factory = await ethers.getContractFactory(
    'ArkadaPVPArenaV4',
  );
  const arenaV4 = (await upgrades.upgradeProxy(
    arenaContract.address,
    ArkadaPVPArenaV4Factory,
  )) as ArkadaPVPArenaV4;

  const treasuryAfter = await arenaV4.treasury();
  expect(treasuryAfter).to.equal(treasury.address);

  const feeBPSAfter = await arenaV4.feeBPS();
  expect(feeBPSAfter).to.equal(arenaInitialConfig.feeBPS);

  const timeLeftToRebuyBPSAfter = await arenaV4.timeLeftToRebuyBPS();
  expect(timeLeftToRebuyBPSAfter).to.equal(
    arenaInitialConfig.timeLeftForRebuyBPS,
  );

  return {
    owner,
    user,
    treasury,
    admin,
    operator,
    arenaContract: arenaV4,
    arenaSigner,
    arenaInitialConfig,
    domainArena: {
      ...arenaDomain,
      chainId,
      verifyingContract: arenaContract.address,
    },
    regularAccounts,
  };
};

describe.only('UPGRADE: ArkadaPVPArenaV3 -> ArkadaPVPArenaV4', () => {
  it('deployment', async () => {
    await loadFixture(upgradeFixture);
  });

  describe('createArena', () => {
    it('Should be reverted if try to create arena with fee < minEntryFee', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        upgradeFixture,
      );

      await setMinEntryFeeTest({
        arenaContract,
        owner,
        newFee: parseEther('0.1'),
      });

      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.00001'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidFeeAmount',
        },
      );
    });

    it('Should be reverted if not OPERATOR try to create signatured arena', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        upgradeFixture,
      );

      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.00001'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          boolParams: {
            signatured: true,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('Should be reverted if OPERATOR try to create signatured arena with fee < minEntryFee', async () => {
      const { arenaContract, owner, operator, arenaInitialConfig } =
        await loadFixture(upgradeFixture);

      await setMinEntryFeeTest({
        arenaContract,
        owner,
        newFee: parseEther('0.1'),
      });

      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.00001'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          boolParams: {
            signatured: true,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          from: operator,
          revertMessage: 'PVPArena__InvalidFeeAmount',
        },
      );
    });

    it('Should created by OPERATOR, but operator will not change fee', async () => {
      const { arenaContract, owner, operator, arenaInitialConfig } =
        await loadFixture(upgradeFixture);

      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.00001'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
          isV4: true,
        },
        {
          from: operator,
        },
      );
    });
  });
});
