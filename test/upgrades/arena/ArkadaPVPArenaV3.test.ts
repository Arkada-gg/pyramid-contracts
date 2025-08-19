import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';

import { ArkadaPVPArena, ArkadaPVPArenaV3 } from '../../../typechain-types';
import { increaseTime } from '../../common/common.helpers';
import {
  ArenaType,
  createArenaV3Test,
  emergencyCloseTest,
  joinArenaTest,
  joinArenaWithSignatureTest,
  leaveArenaTest,
  rebuyTest,
  setPlayersConfigTest,
} from '../../common/pvp-arena.helpers';

const ADDRESS_ZERO = ethers.constants.AddressZero;

const upgradeFixture = async () => {
  const [owner, user, treasury, arenaSigner, admin, ...regularAccounts] =
    await ethers.getSigners();

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
  const ArenaFactory = await ethers.getContractFactory('ArkadaPVPArena');
  const arenaContract = (await upgrades.deployProxy(
    ArenaFactory,
    [
      arenaDomain.name,
      arenaDomain.version,
      treasury.address,
      arenaSigner.address,
      owner.address,
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

  const operatorRole = await arenaContract.OPERATOR_ROLE();
  await arenaContract.grantRole(operatorRole, owner.address);

  // Deploy the new implementation and upgrade
  const ArkadaPVPArenaV3Factory = await ethers.getContractFactory(
    'ArkadaPVPArenaV3',
  );
  const arenaV3 = (await upgrades.upgradeProxy(
    arenaContract.address,
    ArkadaPVPArenaV3Factory,
  )) as ArkadaPVPArenaV3;

  const treasuryAfter = await arenaV3.treasury();
  expect(treasuryAfter).to.equal(treasury.address);

  const feeBPSAfter = await arenaV3.feeBPS();
  expect(feeBPSAfter).to.equal(arenaInitialConfig.feeBPS);

  const timeLeftToRebuyBPSAfter = await arenaV3.timeLeftToRebuyBPS();
  expect(timeLeftToRebuyBPSAfter).to.equal(
    arenaInitialConfig.timeLeftForRebuyBPS,
  );

  return {
    owner,
    user,
    treasury,
    admin,
    arenaContract: arenaV3,
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

describe.only('UPGRADE: ArkadaPVPArena -> ArkadaPVPArenaV3', () => {
  it('deployment', async () => {
    await loadFixture(upgradeFixture);
  });

  describe('createArena', () => {
    it('Should be created arena with type PLACES and lockArenaOnStart true', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        upgradeFixture,
      );
      await createArenaV3Test({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: arenaInitialConfig.playersConfig.min,
        startTime: 0,
        signatured: true,
        lockOnStart: true,
      });
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          signatured: false,
          lockOnStart: true,
        },
        { value: parseEther('0.1') },
      );
    });

    it('Should be created arena with type TIME and lockArenaOnStart true', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        upgradeFixture,
      );

      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      await createArenaV3Test({
        arenaContract,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        signatured: true,
        lockOnStart: true,
      });
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          signatured: false,
          lockOnStart: true,
        },
        { value: parseEther('0.1') },
      );
    });
  });

  describe('default arena: joinArena', () => {
    it('Should start PLACES arena when required players join', async () => {
      const { arenaContract, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(upgradeFixture);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          signatured: false,
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Get current block timestamp for later comparison
      const blockTimestampBefore = (
        await arenaContract.provider.getBlock('latest')
      ).timestamp;

      await joinArenaTest({
        arenaContract,
        owner: regularAccounts[1],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Verify arena not started yet
      let arena = await arenaContract.arenas(1);
      expect(arena.players).to.equal(2);
      expect(arena.startTime).to.equal(0);
      expect(arena.endTime).to.equal(0);

      // Third user joins, should trigger arena start
      await joinArenaTest({
        arenaContract,
        owner: regularAccounts[2],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Verify arena started
      arena = await arenaContract.arenas(1);
      expect(arena.startTime).to.be.at.least(blockTimestampBefore);
      expect(arena.endTime).to.equal(arena.startTime.add(arena.duration));
    });

    it('Should successfully join TIME arena when started', async () => {
      const { arenaContract, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(upgradeFixture);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          signatured: false,
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to join after start time

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[3] },
      );
    });

    it('Should successfully join PLACES arena when started', async () => {
      const { arenaContract, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(upgradeFixture);

      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 1
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 1, // Only 1 player needed to fill arena
          startTime: 0,
          signatured: false,
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Second join should fail as arena is full
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
    });

    it('Should be reverted if join PLACES arena when started and lockArenaOnStart true', async () => {
      const { arenaContract, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(upgradeFixture);

      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 1
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 1, // Only 1 player needed to fill arena
          startTime: 0,
          signatured: false,
          lockOnStart: true,
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Second join should fail as arena is full
      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          revertMessage: 'PVPArena__ArenaLocked',
        },
      );
    });

    it('Should be reverted if join TIME arena when started and lockArenaOnStart true', async () => {
      const { arenaContract, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(upgradeFixture);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          signatured: false,
          lockOnStart: true,
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to join after start time

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[3], revertMessage: 'PVPArena__ArenaLocked' },
      );
    });
  });

  describe('signature-based arena: joinArena', () => {
    it('Should be reverted if start PLACES arena when required players join with signatures and lockArenaOnStart true', async () => {
      const {
        arenaContract,
        owner,
        regularAccounts,
        arenaSigner,
        arenaInitialConfig,
      } = await loadFixture(upgradeFixture);

      // Create a signatured PLACES arena with requiredPlayers = 3
      await createArenaV3Test({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 3,
        startTime: 0,
        signatured: true,
        lockOnStart: true,
      });

      // First two users join with signature
      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: regularAccounts[0],
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: regularAccounts[1],
        freeFromFee: true,
        discountBps: 0,
        nonce: 2,
        signer: arenaSigner,
      });

      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: regularAccounts[2],
        freeFromFee: true,
        discountBps: 0,
        nonce: 3,
        signer: arenaSigner,
      });

      // Third user joins, should trigger arena start
      await joinArenaWithSignatureTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          player: regularAccounts[3],
          freeFromFee: true,
          discountBps: 0,
          nonce: 4,
          signer: arenaSigner,
        },
        {
          revertMessage: 'PVPArena__ArenaLocked',
        },
      );
    });
  });

  describe('rebuy', () => {
    const rebuyFixture = async (type: 'Places' | 'Time') => {
      const fixture = await loadFixture(upgradeFixture);

      const blockTimestamp = (
        await fixture.arenaContract.provider.getBlock('latest')
      ).timestamp;

      if (type === 'Places') {
        await createArenaV3Test(
          {
            arenaContract: fixture.arenaContract,
            owner: fixture.owner,
            type: ArenaType.PLACES,
            duration: fixture.arenaInitialConfig.durationConfig.max,
            entryFee: parseEther('0.1'),
            requiredPlayers: 4,
            startTime: 0,
            signatured: false,
          },
          { from: fixture.regularAccounts[0], value: parseEther('0.1') },
        );
      } else {
        await createArenaV3Test(
          {
            arenaContract: fixture.arenaContract,
            owner: fixture.owner,
            type: ArenaType.TIME,
            duration: fixture.arenaInitialConfig.durationConfig.max,
            entryFee: parseEther('0.1'),
            requiredPlayers: 0,
            startTime:
              blockTimestamp +
              Math.floor(
                fixture.arenaInitialConfig.intervalToStartConfig.max / 2,
              ),
            signatured: false,
          },
          { from: fixture.regularAccounts[0], value: parseEther('0.1') },
        );
      }

      return { ...fixture, blockTimestamp };
    };

    it('Should revert if lockArenaOnStart true', async () => {
      const { arenaContract, owner, regularAccounts, arenaInitialConfig } =
        await rebuyFixture('Time');

      await createArenaV3Test(
        {
          arenaContract: arenaContract,
          owner: owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 4,
          startTime: 0,
          signatured: false,
          lockOnStart: true,
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 2,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 2,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );
      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 2,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      await rebuyTest(
        {
          arenaContract,
          owner,
          arenaId: 2,
        },
        {
          value: parseEther('0.1'),
          revertMessage: 'PVPArena__ArenaLocked',
        },
      );
    });

    it('Should refund all deposits', async () => {
      const { arenaContract, owner, regularAccounts } = await rebuyFixture(
        'Places',
      );

      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );
      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      await rebuyTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
        },
        {
          value: parseEther('0.1'),
        },
      );

      await rebuyTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
        },
        {
          value: parseEther('0.1'),
        },
      );

      await emergencyCloseTest({
        arenaContract,
        owner,
        arenaId: 1,
      });

      const balanceBefore = await owner.getBalance();

      await leaveArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
      });

      const balanceAfter = await owner.getBalance();

      expect(balanceAfter.sub(balanceBefore)).eq(parseEther('0.1').mul(3));
    });
  });
});
