import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { increaseTime } from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  ArenaType,
  createArenaTest,
  joinArenaTest,
  joinArenaWithSignatureTest,
  setDurationConfigTest,
  setFeeBPSTest,
  setIntervalToStartConfigTest,
  setPlayersConfigTest,
  setTreasuryTest,
} from './common/pvp-arena.helpers';

const ADDRESS_ZERO = ethers.constants.AddressZero;

describe.only('ArkadaPVPArena', () => {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right roles', async () => {
      const { arenaContract, owner, arenaSigner } = await loadFixture(
        defaultDeploy,
      );
      expect(
        await arenaContract.hasRole(
          await arenaContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
      expect(
        await arenaContract.hasRole(
          await arenaContract.ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
      expect(
        await arenaContract.hasRole(
          await arenaContract.SIGNER_ROLE(),
          arenaSigner.address,
        ),
      ).to.equal(true);
    });

    it('Should set correct treasury, feeBPS, playersConfig, intervalToStartConfig and durationConfig', async () => {
      const { arenaContract, treasury, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      expect(await arenaContract.treasury()).to.equal(treasury.address);
      expect(await arenaContract.feeBPS()).to.equal(arenaInitialConfig.feeBPS);

      const playersConfig = await arenaContract.playersConfig();
      expect(playersConfig.min).to.equal(arenaInitialConfig.playersConfig.min);
      expect(playersConfig.max).to.equal(arenaInitialConfig.playersConfig.max);

      const intervalToStartConfig = await arenaContract.intervalToStartConfig();
      expect(intervalToStartConfig.min).to.equal(
        arenaInitialConfig.intervalToStartConfig.min,
      );
      expect(intervalToStartConfig.max).to.equal(
        arenaInitialConfig.intervalToStartConfig.max,
      );

      const durationConfig = await arenaContract.durationConfig();
      expect(durationConfig.min).to.equal(
        arenaInitialConfig.durationConfig.min,
      );
      expect(durationConfig.max).to.equal(
        arenaInitialConfig.durationConfig.max,
      );
    });
  });

  describe('Treasury Control', () => {
    it('Should allow owner to set treasury address', async () => {
      const { arenaContract, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest({
        arenaContract,
        owner,
        newTreasuryAddress: regularAccounts[0].address,
      });
      await setTreasuryTest({
        arenaContract,
        owner,
        newTreasuryAddress: regularAccounts[1].address,
      });
    });

    it('Should not allow non-owner to set treasury address', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setTreasuryTest(
        { arenaContract, owner, newTreasuryAddress: user.address },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow to set treasury address to ZeroAddress', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setTreasuryTest(
        { arenaContract, owner, newTreasuryAddress: ADDRESS_ZERO },
        { revertMessage: 'PVPArena__InvalidAddress' },
      );
    });
  });

  describe('feeBPS Control', () => {
    it('Should allow owner to set feeBPS', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setFeeBPSTest({
        arenaContract,
        owner,
        newFeeBPS: 200,
      });
      await setFeeBPSTest({
        arenaContract,
        owner,
        newFeeBPS: 400,
      });
    });

    it('Should not allow non-owner to set feeBPS', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setFeeBPSTest(
        {
          arenaContract,
          owner,
          newFeeBPS: 400,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('playersCount Control', () => {
    it('Should allow owner to set playersCount', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
    });
    it('Should revert if max < min', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setPlayersConfigTest(
        {
          arenaContract,
          owner,
          newConfig: {
            max: 2,
            min: 3,
          },
        },
        { revertMessage: 'PVPArena__InvalidMinMax' },
      );
    });

    it('Should not allow non-owner to set playersCount', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setPlayersConfigTest(
        {
          arenaContract,
          owner,
          newConfig: {
            max: 10,
            min: 3,
          },
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('intervalToStart Control', () => {
    it('Should allow owner to set intervalToStart', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setIntervalToStartConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
      await setIntervalToStartConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
    });

    it('Should revert if max < min', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setIntervalToStartConfigTest(
        {
          arenaContract,
          owner,
          newConfig: {
            max: 2,
            min: 3,
          },
        },
        { revertMessage: 'PVPArena__InvalidMinMax' },
      );
    });

    it('Should not allow non-owner to set intervalToStart', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setIntervalToStartConfigTest(
        {
          arenaContract,
          owner,
          newConfig: {
            max: 10,
            min: 3,
          },
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('duration Control', () => {
    it('Should allow owner to set duration', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setDurationConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
      await setDurationConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
    });

    it('Should revert if max < min', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setDurationConfigTest(
        {
          arenaContract,
          owner,
          newConfig: {
            max: 2,
            min: 3,
          },
        },
        { revertMessage: 'PVPArena__InvalidMinMax' },
      );
    });

    it('Should not allow non-owner to set duration', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setDurationConfigTest(
        {
          arenaContract,
          owner,
          newConfig: {
            max: 10,
            min: 3,
          },
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('createArena', () => {
    it('Should be reverted if _entryFee zero', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.min + 1,
          entryFee: 0,
          requiredPlayers: 10,
          startTime: 0,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__ZeroValue',
        },
      );
    });

    it('Should be reverted if duration not in config range', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max + 1,
          entryFee: 10,
          requiredPlayers: 10,
          startTime: 0,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidDuration',
        },
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.min - 1,
          entryFee: 10,
          requiredPlayers: 10,
          startTime: 0,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidDuration',
        },
      );
    });

    it('Should be reverted if type TIME and startTime not in config range', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 10,
          startTime: 0,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidTimestamp',
        },
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 10,
          startTime:
            blockTimestamp + arenaInitialConfig.intervalToStartConfig.min - 1,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidTimestamp',
        },
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 10,
          startTime:
            blockTimestamp + arenaInitialConfig.intervalToStartConfig.max + 2,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidTimestamp',
        },
      );
    });

    it('Should be reverted if type PLACES and requiredPlayers not in config range', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.max + 1,
          startTime: 0,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidPlayersRequired',
        },
      );
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.min - 1,
          startTime: 0,
          signatured: false,
        },
        {
          revertMessage: 'PVPArena__InvalidPlayersRequired',
        },
      );
    });

    it('Should be reverted if not owner try to create signatured arena', async () => {
      const { arenaContract, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      await createArenaTest(
        {
          arenaContract,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          signatured: true,
        },
        {
          from: regularAccounts[0],
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('Should be created arena with type PLACES', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: arenaInitialConfig.playersConfig.min,
        startTime: 0,
        signatured: true,
      });
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: arenaInitialConfig.playersConfig.min,
        startTime: 0,
        signatured: false,
      });
    });

    it('Should be created arena with type TIME', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      await createArenaTest({
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
      });
      await createArenaTest({
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
      });
    });
  });

  describe('default arena: joinArena', () => {
    it('Should be reverted if entryFee invalid', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      await createArenaTest({
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
      });

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.05'), // Wrong fee amount
        },
        { revertMessage: 'PVPArena__InvalidFeeAmount' },
      );
    });

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 999, // Non-existent arena
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if TIME arena already started', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaTest({
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
      });

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
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if PLACES arena is full', async () => {
      const { arenaContract, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 1
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 1, // Only 1 player needed to fill arena
        startTime: 0,
        signatured: false,
      });

      // First join should succeed
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Second join should fail as arena is full
      await joinArenaTest(
        {
          arenaContract,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if player already joined', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaTest({
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
      });

      // First join succeeds
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Second join by same player fails
      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__AlreadyJoined' },
      );
    });

    it('Should successfully join TIME arena', async () => {
      const { arenaContract, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaTest({
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
      });

      // User joins successfully
      await joinArenaTest({
        arenaContract,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });
    });

    it('Should successfully join PLACES arena', async () => {
      const { arenaContract, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 3,
        startTime: 0,
        signatured: false,
      });

      // First user joins
      await joinArenaTest({
        arenaContract,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });
    });

    it('Should start PLACES arena when required players join', async () => {
      const { arenaContract, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 3,
        startTime: 0,
        signatured: false,
      });

      // Get current block timestamp for later comparison
      const blockTimestampBefore = (
        await arenaContract.provider.getBlock('latest')
      ).timestamp;

      // First two users join
      await joinArenaTest({
        arenaContract,
        owner: regularAccounts[0],
        arenaId: 1,
        value: parseEther('0.1'),
      });

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
      expect(arena.players).to.equal(3);
      expect(arena.startTime).to.be.at.least(blockTimestampBefore);
      expect(arena.endTime).to.equal(arena.startTime.add(arena.duration));
    });
  });

  describe('signature-based arena: joinArena', () => {
    it('Should be reverted if signature is invalid', async () => {
      const { arenaContract, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured arena
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        signatured: true, // Requires signature
      });

      // Try to join with signature from non-signer (user)
      await joinArenaWithSignatureTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          player: owner,
          nonce: 1,
          signer: user, // Not authorized signer
        },
        { revertMessage: 'PVPArena__IsNotSigner' },
      );
    });

    it('Should be reverted if nonce already used', async () => {
      const { arenaContract, owner, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured arena
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        signatured: true, // Requires signature
      });

      // First join with nonce = 1 succeeds
      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: owner,
        nonce: 1,
        signer: arenaSigner,
      });

      // Second join with same nonce should fail
      await joinArenaWithSignatureTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          player: owner,
          nonce: 1, // Same nonce
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__NonceAlreadyUsed' },
      );
    });

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContract, owner, arenaSigner } = await loadFixture(
        defaultDeploy,
      );

      await joinArenaWithSignatureTest(
        {
          arenaContract,
          owner,
          arenaId: 999, // Non-existent arena
          player: owner,
          nonce: 1,
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if arena already started', async () => {
      const { arenaContract, owner, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
        signatured: true,
      });

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to join after start time
      await joinArenaWithSignatureTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          player: owner,
          nonce: 1,
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if player already joined', async () => {
      const { arenaContract, owner, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaTest({
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
      });

      // First join succeeds with nonce 1
      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: owner,
        nonce: 1,
        signer: arenaSigner,
      });

      // Second join by same player fails, even with different nonce
      await joinArenaWithSignatureTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          player: owner,
          nonce: 2,
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__AlreadyJoined' },
      );
    });

    it('Should successfully join with valid signature', async () => {
      const { arenaContract, owner, user, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaTest({
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
      });

      // User joins with signature (free join)
      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: user,
        nonce: 1,
        signer: arenaSigner,
      });

      // Verify arena state
      const arena = await arenaContract.arenas(1);
      expect(arena.players).to.equal(1);

      // Verify user is a participant
      const arenaIdHash = ethers.utils.solidityKeccak256(['uint256'], [1]);
      const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
        ['bytes32', 'address'],
        [arenaIdHash, user.address],
      );
      expect(await arenaContract.participants(arenaIdAndAddressHash)).to.equal(
        true,
      );

      // Verify fees NOT collected (signature join is free)
      expect(await arenaContract.feesByArena(1)).to.equal(0);
    });

    it('Should successfully start PLACES arena when required players join with signatures', async () => {
      const {
        arenaContract,
        owner,
        regularAccounts,
        arenaSigner,
        arenaInitialConfig,
      } = await loadFixture(defaultDeploy);

      // Create a signatured PLACES arena with requiredPlayers = 3
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 3,
        startTime: 0,
        signatured: true,
      });

      // Get current block timestamp for later comparison
      const blockTimestampBefore = (
        await arenaContract.provider.getBlock('latest')
      ).timestamp;

      // First two users join with signature
      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: regularAccounts[0],
        nonce: 1,
        signer: arenaSigner,
      });

      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: regularAccounts[1],
        nonce: 2,
        signer: arenaSigner,
      });

      // Verify arena not started yet
      let arena = await arenaContract.arenas(1);
      expect(arena.players).to.equal(2);
      expect(arena.startTime).to.equal(0);
      expect(arena.endTime).to.equal(0);

      // Third user joins, should trigger arena start
      await joinArenaWithSignatureTest({
        arenaContract,
        owner,
        arenaId: 1,
        player: regularAccounts[2],
        nonce: 3,
        signer: arenaSigner,
      });

      // Verify arena started
      arena = await arenaContract.arenas(1);
      expect(arena.players).to.equal(3);
      expect(arena.startTime).to.be.at.least(blockTimestampBefore);
      expect(arena.endTime).to.equal(arena.startTime.add(arena.duration));
    });
  });
});
