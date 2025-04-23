import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';

import { increaseTime } from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  ArenaType,
  claimRewardsTest,
  createArenaTest,
  endArenaAndDistributeRewardsTest,
  joinArenaTest,
  joinArenaWithSignatureTest,
  leaveArenaTest,
  setDurationConfigTest,
  setFeeBPSTest,
  setIntervalToStartConfigTest,
  setPlayersConfigTest,
  setTreasuryTest,
} from './common/pvp-arena.helpers';

const ADDRESS_ZERO = ethers.constants.AddressZero;

// Helper function to create a Merkle tree for rewards
function createRewardsMerkleTree(
  rewards: Array<{ address: string; amount: string }>,
) {
  // Create leaves from address and amount pairs
  const leaves = rewards.map((reward) =>
    // This matches the contract's leaf computation: keccak256(abi.encodePacked(address, amount))
    ethers.utils.solidityKeccak256(
      ['address', 'uint256'],
      [reward.address, reward.amount],
    ),
  );

  // Create a Merkle tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  return {
    tree,
    root: tree.getHexRoot(),
    leaves,
    getProof: (index: number) => tree.getHexProof(leaves[index]),
  };
}

describe('ArkadaPVPArena', () => {
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

    it('Should be reverted if player tried to join signatured arena', async () => {
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
        signatured: true,
      });

      await joinArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__ArenaIsSignatured' },
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

  describe('leaveArena', () => {
    it('Should be reverted if arena does not exist', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);

      await leaveArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 999, // Non-existent arena
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if TIME arena has already started', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to leave after start time
      await leaveArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if PLACES arena has reached required players', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

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

      // Both players join
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Second join should fail as arena is full
      await leaveArenaTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if player has not joined', async () => {
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

      // User hasn't joined
      await leaveArenaTest(
        {
          arenaContract,
          owner: user, // User hasn't joined
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__NotJoined' },
      );
    });

    it('Should successfully leave a TIME arena', async () => {
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

      // Join the arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Leave the arena
      await leaveArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
      });
    });

    it('Should successfully leave a PLACES arena', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 2
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 2,
        startTime: 0,
        signatured: false,
      });

      // Join the arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Leave the arena
      await leaveArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
      });
    });

    it('Should delete arena when last player leaves', async () => {
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

      // Both players join
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // First player leaves
      await leaveArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
      });

      // Arena should still exist
      let arena = await arenaContract.arenas(1);
      expect(arena.id).to.equal(1);
      expect(arena.players).to.equal(1);

      // Last player leaves, arena should be deleted
      await leaveArenaTest({
        arenaContract,
        owner: user,
        arenaId: 1,
      });

      // Arena should be deleted
      arena = await arenaContract.arenas(1);
      expect(arena.id).to.equal(0);
    });
  });

  describe('endArenaAndDistributeRewards', () => {
    it('Should be reverted if caller is not admin', async () => {
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
          Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
        signatured: false,
      });

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // Non-admin tries to end arena
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner: user,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);

      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 999, // Non-existent arena
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if TIME arena has not started', async () => {
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

      // Try to end arena before it starts
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );
    });

    it('Should be reverted if PLACES arena does not have enough players', async () => {
      const { arenaContract, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

      // Create a PLACES arena with requiredPlayers = 2
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

      // Only one player joins
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Try to end arena before enough players join
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );
    });

    it('Should be reverted if arena has not ended', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena starts but before it ends
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to end arena before it ends
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__ArenaNotEnded' },
      );
    });

    it('Should be reverted if arena already ended', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // End arena first time
      const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'));
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // Try to end arena again
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test2')),
        },
        { revertMessage: 'PVPArena__AlreadyEnded' },
      );
    });

    it('Should successfully end a TIME arena', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // End arena
      const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'));
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });
    });

    it('Should successfully end a PLACES arena', async () => {
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

      // All required players join
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

      await joinArenaTest({
        arenaContract,
        owner: regularAccounts[2],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(arenaInitialConfig.durationConfig.max + 20);

      // End arena
      const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'));
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });
    });
  });

  describe('claimRewards', () => {
    it('Should be reverted if rewards not distributed', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Try to claim rewards before distribution
      await claimRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          amount: parseEther('0.09'),
          proofs: [],
        },
        { revertMessage: 'PVPArena__RewardsNotDistributed' },
      );
    });

    it('Should be reverted if player has already claimed', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // Generate merkle tree
      const rewards = [
        { address: owner.address, amount: parseEther('0.09').toString() },
      ];
      const { root, getProof } = createRewardsMerkleTree(rewards);

      // End arena and distribute rewards
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // Claim rewards
      await claimRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        amount: parseEther('0.09'),
        proofs: getProof(0),
      });

      // Try to claim again
      await claimRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          amount: parseEther('0.09'),
          proofs: getProof(0),
        },
        { revertMessage: 'PVPArena__IAlreadyClaimed' },
      );
    });

    it('Should be reverted if proof is invalid', async () => {
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
          Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
        signatured: false,
      });

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // Generate merkle tree for owner only
      const rewards = [
        { address: owner.address, amount: parseEther('0.09').toString() },
      ];
      const { root, getProof } = createRewardsMerkleTree(rewards);

      // End arena and distribute rewards
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // User tries to claim with invalid proof (empty proof)
      await claimRewardsTest(
        {
          arenaContract,
          owner: user,
          arenaId: 1,
          amount: parseEther('0.09'),
          proofs: [],
        },
        { revertMessage: 'PVPArena__InvalidProofs' },
      );

      // User tries to claim with invalid proof (empty proof)
      await claimRewardsTest(
        {
          arenaContract,
          owner: user,
          arenaId: 1,
          amount: parseEther('0.10'),
          proofs: getProof(0),
        },
        { revertMessage: 'PVPArena__InvalidProofs' },
      );
    });

    it('Should successfully claim rewards with valid proof', async () => {
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

      // Join arena
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // Generate merkle tree for owner
      const rewards = [
        { address: owner.address, amount: parseEther('0.09').toString() },
      ];
      const { root, getProof } = createRewardsMerkleTree(rewards);

      // End arena and distribute rewards
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // Owner claims rewards
      await claimRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        amount: parseEther('0.09'),
        proofs: getProof(0),
      });
    });

    it('Should successfully claim rewards for multiple players', async () => {
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

      // All required players join
      await joinArenaTest({
        arenaContract,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

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

      // Forward time to after arena ends
      await increaseTime(arenaInitialConfig.durationConfig.max + 20);

      // Create a proper merkle tree with multiple players
      const rewards = [
        { address: owner.address, amount: parseEther('0.09').toString() },
        {
          address: regularAccounts[0].address,
          amount: parseEther('0.08').toString(),
        },
        {
          address: regularAccounts[1].address,
          amount: parseEther('0.07').toString(),
        },
      ];

      const { root, getProof } = createRewardsMerkleTree(rewards);

      // End arena and distribute rewards
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // First player claims rewards
      await claimRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        amount: parseEther('0.09'),
        proofs: getProof(0),
      });

      // Second player claims rewards
      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[0],
        arenaId: 1,
        amount: parseEther('0.08'),
        proofs: getProof(1),
      });

      // Third player claims rewards
      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[1],
        arenaId: 1,
        amount: parseEther('0.07'),
        proofs: getProof(2),
      });
    });
  });

  describe('Complex TIME Arena Scenario', () => {
    it('Should handle complete lifecycle with multiple players, timeouts, and complex reward distribution', async () => {
      console.log('\n----- STARTING COMPLEX TIME ARENA TEST -----');
      const { arenaContract, owner, user, regularAccounts, treasury } =
        await loadFixture(defaultDeploy);

      // Configure for flexible testing
      console.log('Configuring contract parameters...');
      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: { max: 15, min: 1 },
      });

      await setDurationConfigTest({
        arenaContract,
        owner,
        newConfig: { max: 100000, min: 1000 },
      });

      await setIntervalToStartConfigTest({
        arenaContract,
        owner,
        newConfig: { max: 1000, min: 200 },
      });

      await setFeeBPSTest({
        arenaContract,
        owner,
        newFeeBPS: 500, // 5% fee
      });

      const blockTimestamp = (await arenaContract.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena with future start time
      console.log('Creating TIME arena with future start time...');
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.TIME,
        duration: 1000, // 1000 seconds duration
        entryFee: parseEther('0.15'),
        requiredPlayers: 0,
        startTime: blockTimestamp + 300, // Starts in 5 minutes
        signatured: false,
      });

      // First wave of players join (5 players)
      console.log('First wave: 5 players joining arena...');
      for (let i = 0; i < 5; i++) {
        console.log(`Player ${i + 1} joining with 0.15 ETH...`);
        await joinArenaTest({
          arenaContract,
          owner: i === 0 ? owner : i === 1 ? user : regularAccounts[i - 2],
          arenaId: 1,
          value: parseEther('0.15'),
        });

        // Check player count after each join
        const arena = await arenaContract.arenas(1);
        console.log(`Arena now has ${arena.players.toString()} players`);
      }

      // Some players leave before arena starts
      console.log('Two players leaving arena before it starts...');
      await leaveArenaTest({
        arenaContract,
        owner: regularAccounts[1],
        arenaId: 1,
      });

      await leaveArenaTest({
        arenaContract,
        owner: regularAccounts[2],
        arenaId: 1,
      });

      // Verify arena state
      let arena = await arenaContract.arenas(1);
      console.log(
        `Arena now has ${arena.players.toString()} players after 2 left`,
      );
      expect(arena.players).to.equal(3);

      // Second wave joins
      console.log('Second wave: 4 more players joining...');
      for (let i = 3; i < 7; i++) {
        await joinArenaTest({
          arenaContract,
          owner: regularAccounts[i],
          arenaId: 1,
          value: parseEther('0.15'),
        });
      }

      // Verify arena state
      arena = await arenaContract.arenas(1);
      console.log(`Arena now has ${arena.players.toString()} players total`);
      expect(arena.players).to.equal(7);

      // Collect fees info before arena starts
      const totalFees = parseEther('0.15').mul(7); // 7 players * 0.15 ETH
      const feeBPS = await arenaContract.feeBPS();
      const feeAmount = totalFees.mul(feeBPS).div(10000); // 5% of total
      const prizePot = totalFees.sub(feeAmount);

      console.log(
        `Total entry fees collected: ${ethers.utils.formatEther(
          totalFees,
        )} ETH`,
      );
      console.log(
        `Fee amount (5%): ${ethers.utils.formatEther(feeAmount)} ETH`,
      );
      console.log(`Prize pot: ${ethers.utils.formatEther(prizePot)} ETH`);

      // Wait for arena to start automatically
      console.log('Advancing time to start arena...');
      await increaseTime(350); // Past the start time

      // Try to join after start (should fail)
      console.log('Player trying to join after arena started (should fail)...');
      await joinArenaTest(
        {
          arenaContract,
          owner: regularAccounts[7],
          arenaId: 1,
          value: parseEther('0.15'),
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );

      // Wait for arena to finish
      console.log('Advancing time to finish arena...');
      await increaseTime(1100); // Past duration + buffer

      // Prepare reward distribution with different percentages for each player
      console.log('Preparing reward distribution...');
      const rewards = [
        {
          address: owner.address,
          amount: prizePot.mul(25).div(100).toString(),
        }, // 25% - 1st place
        { address: user.address, amount: prizePot.mul(20).div(100).toString() }, // 20% - 2nd place
        {
          address: regularAccounts[0].address,
          amount: prizePot.mul(15).div(100).toString(),
        }, // 15% - 3rd place
        {
          address: regularAccounts[3].address,
          amount: prizePot.mul(12).div(100).toString(),
        }, // 12% - 4th place
        {
          address: regularAccounts[4].address,
          amount: prizePot.mul(10).div(100).toString(),
        }, // 10% - 5th place
        {
          address: regularAccounts[5].address,
          amount: prizePot.mul(10).div(100).toString(),
        }, // 10% - 6th place
        {
          address: regularAccounts[6].address,
          amount: prizePot.mul(8).div(100).toString(),
        }, // 8% - 7th place
      ];

      console.log('Reward distribution by percentage:');
      rewards.forEach((r, i) => {
        console.log(
          `Player ${i + 1}: ${ethers.utils.formatEther(r.amount)} ETH (${
            i === 0
              ? 25
              : i === 1
              ? 20
              : i === 2
              ? 15
              : i === 3
              ? 12
              : i === 4
              ? 10
              : i === 5
              ? 10
              : 8
          }%)`,
        );
      });

      const { root, getProof } = createRewardsMerkleTree(rewards);

      // Check treasury balance before ending
      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      console.log(
        `Treasury balance before: ${ethers.utils.formatEther(
          treasuryBalanceBefore,
        )} ETH`,
      );

      // End arena and distribute rewards
      console.log('Ending arena and distributing rewards...');
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // Verify treasury received fees
      const treasuryBalanceAfter = await ethers.provider.getBalance(
        treasury.address,
      );
      console.log(
        `Treasury received: ${ethers.utils.formatEther(
          treasuryBalanceAfter.sub(treasuryBalanceBefore),
        )} ETH`,
      );
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.be.closeTo(
        feeAmount,
        1000,
      );

      // Players claim rewards in random order
      console.log('Players claiming rewards in random order...');

      // Middle ranked player claims first
      console.log('4th place player claiming first...');
      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[3],
        arenaId: 1,
        amount: rewards[3].amount,
        proofs: getProof(3),
      });

      // Winner claims
      console.log('1st place (winner) claiming...');
      await claimRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        amount: rewards[0].amount,
        proofs: getProof(0),
      });

      // Attempt incorrect claim (should fail)
      console.log('Attempting claim with wrong amount (should fail)...');
      await claimRewardsTest(
        {
          arenaContract,
          owner: regularAccounts[4],
          arenaId: 1,
          amount: prizePot.mul(15).div(100), // Wrong amount - trying to claim more
          proofs: getProof(4),
        },
        { revertMessage: 'PVPArena__InvalidProofs' },
      );

      // Correct claim for remaining players
      console.log('Remaining players claiming correctly...');

      await claimRewardsTest({
        arenaContract,
        owner: user,
        arenaId: 1,
        amount: rewards[1].amount,
        proofs: getProof(1),
      });

      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[0],
        arenaId: 1,
        amount: rewards[2].amount,
        proofs: getProof(2),
      });

      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[4],
        arenaId: 1,
        amount: rewards[4].amount,
        proofs: getProof(4),
      });

      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[5],
        arenaId: 1,
        amount: rewards[5].amount,
        proofs: getProof(5),
      });

      await claimRewardsTest({
        arenaContract,
        owner: regularAccounts[6],
        arenaId: 1,
        amount: rewards[6].amount,
        proofs: getProof(6),
      });

      // Attempt double claim (should fail)
      console.log('Attempting to claim twice (should fail)...');
      await claimRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          amount: rewards[0].amount,
          proofs: getProof(0),
        },
        { revertMessage: 'PVPArena__IAlreadyClaimed' },
      );

      console.log('All rewards claimed successfully!');
      console.log('----- COMPLEX TIME ARENA TEST COMPLETE -----\n');
    });
  });

  describe('Complex PLACES Arena Scenario', () => {
    it('Should handle required players count, auto-start, and special reward patterns', async () => {
      console.log('\n----- STARTING COMPLEX PLACES ARENA TEST -----');
      const { arenaContract, owner, user, regularAccounts, treasury } =
        await loadFixture(defaultDeploy);

      // Configure for testing
      console.log('Configuring contract parameters...');
      await setPlayersConfigTest({
        arenaContract,
        owner,
        newConfig: { max: 15, min: 1 },
      });

      await setDurationConfigTest({
        arenaContract,
        owner,
        newConfig: { max: 100000, min: 1000 },
      });

      await setIntervalToStartConfigTest({
        arenaContract,
        owner,
        newConfig: { max: 1000, min: 200 },
      });

      await setFeeBPSTest({
        arenaContract,
        owner,
        newFeeBPS: 800, // 8% fee
      });

      // Create a PLACES arena that requires 8 players to start
      console.log('Creating PLACES arena with 8 required players...');
      await createArenaTest({
        arenaContract,
        owner,
        type: ArenaType.PLACES,
        duration: 1500, // 25 minutes
        entryFee: parseEther('0.1'),
        requiredPlayers: 8, // Requires 8 players to start
        startTime: 0,
        signatured: false,
      });

      // First batch of players join (4 players)
      console.log('First batch: 4 players joining...');
      for (let i = 0; i < 4; i++) {
        const player =
          i === 0 ? owner : i === 1 ? user : regularAccounts[i - 2];
        console.log(`Player ${i + 1} joining with 0.1 ETH...`);
        await joinArenaTest({
          arenaContract,
          owner: player,
          arenaId: 1,
          value: parseEther('0.1'),
        });

        // Verify arena state after each join
        const arena = await arenaContract.arenas(1);
        console.log(
          `Arena has ${arena.players.toString()} players, still not started`,
        );
        expect(arena.startTime).to.equal(0); // Not started yet
      }

      // Some players leave and rejoin to test that functionality
      console.log('Testing leave/rejoin functionality...');
      await leaveArenaTest({
        arenaContract,
        owner: user,
        arenaId: 1,
      });

      console.log('User left, now rejoining...');
      await joinArenaTest({
        arenaContract,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Try to end arena before required players (should fail)
      console.log(
        'Trying to end arena before required players (should fail)...',
      );
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract,
          owner,
          arenaId: 1,
          root: ethers.utils.formatBytes32String('dummy'),
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );

      // Add more players to reach the threshold (4 more)
      console.log('Adding 4 more players to reach required threshold...');
      for (let i = 4; i < 8; i++) {
        console.log(
          `Player ${i + 1} joining (player ${i + 1} of 8 required)...`,
        );
        await joinArenaTest({
          arenaContract,
          owner: regularAccounts[i - 2],
          arenaId: 1,
          value: parseEther('0.1'),
        });

        // Check if we've hit the required players threshold
        if (i < 7) {
          // Not enough players yet
          const arena = await arenaContract.arenas(1);
          console.log(
            `Arena has ${arena.players.toString()} players, still not started`,
          );
          expect(arena.startTime).to.equal(0);
        } else {
          // Should have started with the 8th player
          const arena = await arenaContract.arenas(1);
          console.log(
            `Arena has ${arena.players.toString()} players, STARTED at ${
              arena.startTime
            }`,
          );
          expect(arena.startTime).to.be.gt(0);
          expect(arena.endTime).to.equal(arena.startTime.add(arena.duration));
        }
      }

      // Arena has started, wait for completion
      console.log('Arena has started, waiting for completion...');
      await increaseTime(1600);

      // Try to add more players after the arena has started (should fail for PLACES arena)
      console.log(
        'Adding 2 more players after arena start but before end... (should fail)',
      );
      await joinArenaTest(
        {
          arenaContract,
          owner: regularAccounts[6],
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          revertMessage: 'PVPArena__ArenaStarted',
        },
      );

      await joinArenaTest(
        {
          arenaContract,
          owner: regularAccounts[7],
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          revertMessage: 'PVPArena__ArenaStarted',
        },
      );

      // Calculate fees and prepare rewards
      console.log('Calculating fees and preparing rewards...');
      const totalFees = parseEther('0.1').mul(8); // 8 players * 0.1 ETH
      const feeBPS = await arenaContract.feeBPS();
      const feeAmount = totalFees.mul(feeBPS).div(10000);
      const prizePot = totalFees.sub(feeAmount);

      console.log(`Total fees: ${ethers.utils.formatEther(totalFees)} ETH`);
      console.log(
        `Fee amount (8%): ${ethers.utils.formatEther(feeAmount)} ETH`,
      );
      console.log(`Prize pot: ${ethers.utils.formatEther(prizePot)} ETH`);

      // Create a non-uniform distribution for the 8 players
      console.log('Creating non-uniform reward distribution...');
      const rewards = [
        {
          address: owner.address,
          amount: prizePot.mul(35).div(100).toString(),
        }, // 35% - Winner
        { address: user.address, amount: prizePot.mul(20).div(100).toString() }, // 20% - Runner-up
        {
          address: regularAccounts[0].address,
          amount: prizePot.mul(15).div(100).toString(),
        }, // 15% - Third place
        {
          address: regularAccounts[1].address,
          amount: prizePot.mul(7).div(100).toString(),
        }, // 7% - participation
        {
          address: regularAccounts[2].address,
          amount: prizePot.mul(7).div(100).toString(),
        }, // 7% - participation
        {
          address: regularAccounts[3].address,
          amount: prizePot.mul(6).div(100).toString(),
        }, // 6% - participation
        {
          address: regularAccounts[4].address,
          amount: prizePot.mul(5).div(100).toString(),
        }, // 5% - participation
        {
          address: regularAccounts[5].address,
          amount: prizePot.mul(5).div(100).toString(),
        }, // 5% - participation
      ];

      console.log('Reward distribution:');
      rewards.forEach((r, i) => {
        const percent =
          i === 0
            ? 35
            : i === 1
            ? 20
            : i === 2
            ? 15
            : i === 3
            ? 7
            : i === 4
            ? 7
            : i === 5
            ? 6
            : 5;
        console.log(
          `Player ${i + 1}: ${ethers.utils.formatEther(
            r.amount,
          )} ETH (${percent}%)`,
        );
      });

      const { root, getProof } = createRewardsMerkleTree(rewards);

      // End arena and distribute rewards
      console.log('Ending arena and distributing rewards...');
      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      await endArenaAndDistributeRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        root,
      });

      // Verify treasury received correct fee
      const treasuryBalanceAfter = await ethers.provider.getBalance(
        treasury.address,
      );
      console.log(
        `Treasury received: ${ethers.utils.formatEther(
          treasuryBalanceAfter.sub(treasuryBalanceBefore),
        )} ETH`,
      );
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.be.closeTo(
        feeAmount,
        1000,
      );

      // Winner claims first
      console.log('Winner claiming reward first...');
      await claimRewardsTest({
        arenaContract,
        owner,
        arenaId: 1,
        amount: rewards[0].amount,
        proofs: getProof(0),
      });

      // Random order of claims for other players
      console.log('Other players claiming in random order...');
      const claimOrder = [2, 5, 1, 3, 4, 6, 7]; // Random claim order for 7 remaining players

      for (const idx of claimOrder) {
        const playerIndex = idx; // Convert to zero-based index
        const playerAccount =
          playerIndex === 0
            ? owner
            : playerIndex === 1
            ? user
            : regularAccounts[playerIndex - 2];

        console.log(`Player ${idx} claiming reward...`);
        await claimRewardsTest({
          arenaContract,
          owner: playerAccount,
          arenaId: 1,
          amount: rewards[playerIndex].amount,
          proofs: getProof(playerIndex),
        });
      }

      // Test claim by player who wasn't on the list (should fail)
      console.log(
        'Player not in distribution trying to claim (should fail)...',
      );
      await claimRewardsTest(
        {
          arenaContract,
          owner: regularAccounts[8], // This player wasn't in the arena
          arenaId: 1,
          amount: parseEther('0.01'),
          proofs: [],
        },
        { revertMessage: 'PVPArena__InvalidProofs' },
      );

      console.log('All rewards claimed successfully!');
      console.log('----- COMPLEX PLACES ARENA TEST COMPLETE -----\n');
    });
  });
});
