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
  createArenaV3Test,
  emergencyCloseTest,
  endArenaAndDistributeRewardsTest,
  joinArenaTest,
  joinArenaWithSignatureTest,
  leaveArenaTest,
  rebuyTest,
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

describe('ArkadaPVPArenaV3', () => {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right roles', async () => {
      const { arenaContractV3, owner, arenaSigner } = await loadFixture(
        defaultDeploy,
      );
      expect(
        await arenaContractV3.hasRole(
          await arenaContractV3.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
      expect(
        await arenaContractV3.hasRole(
          await arenaContractV3.ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
      expect(
        await arenaContractV3.hasRole(
          await arenaContractV3.SIGNER_ROLE(),
          arenaSigner.address,
        ),
      ).to.equal(true);
    });

    it('Should set correct treasury, feeBPS, playersConfig, intervalToStartConfig and durationConfig', async () => {
      const { arenaContractV3, treasury, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      expect(await arenaContractV3.treasury()).to.equal(treasury.address);
      expect(await arenaContractV3.feeBPS()).to.equal(
        arenaInitialConfig.feeBPS,
      );

      const playersConfig = await arenaContractV3.playersConfig();
      expect(playersConfig.min).to.equal(arenaInitialConfig.playersConfig.min);
      expect(playersConfig.max).to.equal(arenaInitialConfig.playersConfig.max);

      const intervalToStartConfig =
        await arenaContractV3.intervalToStartConfig();
      expect(intervalToStartConfig.min).to.equal(
        arenaInitialConfig.intervalToStartConfig.min,
      );
      expect(intervalToStartConfig.max).to.equal(
        arenaInitialConfig.intervalToStartConfig.max,
      );

      const durationConfig = await arenaContractV3.durationConfig();
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
      const { arenaContractV3, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest({
        arenaContract: arenaContractV3,
        owner,
        newTreasuryAddress: regularAccounts[0].address,
      });
      await setTreasuryTest({
        arenaContract: arenaContractV3,
        owner,
        newTreasuryAddress: regularAccounts[1].address,
      });
    });

    it('Should not allow non-owner to set treasury address', async () => {
      const { arenaContractV3, owner, user } = await loadFixture(defaultDeploy);
      await setTreasuryTest(
        {
          arenaContract: arenaContractV3,
          owner,
          newTreasuryAddress: user.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow to set treasury address to ZeroAddress', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setTreasuryTest(
        {
          arenaContract: arenaContractV3,
          owner,
          newTreasuryAddress: ADDRESS_ZERO,
        },
        { revertMessage: 'PVPArena__InvalidAddress' },
      );
    });
  });

  describe('feeBPS Control', () => {
    it('Should allow owner to set feeBPS', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setFeeBPSTest({
        arenaContract: arenaContractV3,
        owner,
        newFeeBPS: 200,
      });
      await setFeeBPSTest({
        arenaContract: arenaContractV3,
        owner,
        newFeeBPS: 400,
      });
    });

    it('Should not allow non-owner to set feeBPS', async () => {
      const { arenaContractV3, owner, user } = await loadFixture(defaultDeploy);
      await setFeeBPSTest(
        {
          arenaContract: arenaContractV3,
          owner,
          newFeeBPS: 400,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('playersCount Control', () => {
    it('Should allow owner to set playersCount', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
    });
    it('Should revert if max < min', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setPlayersConfigTest(
        {
          arenaContract: arenaContractV3,
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
      const { arenaContractV3, owner, user } = await loadFixture(defaultDeploy);
      await setPlayersConfigTest(
        {
          arenaContract: arenaContractV3,
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
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setIntervalToStartConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
      await setIntervalToStartConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
    });

    it('Should revert if max < min', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setIntervalToStartConfigTest(
        {
          arenaContract: arenaContractV3,
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
      const { arenaContractV3, owner, user } = await loadFixture(defaultDeploy);
      await setIntervalToStartConfigTest(
        {
          arenaContract: arenaContractV3,
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
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setDurationConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
      await setDurationConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 10,
          min: 3,
        },
      });
    });

    it('Should revert if max < min', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);
      await setDurationConfigTest(
        {
          arenaContract: arenaContractV3,
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
      const { arenaContractV3, owner, user } = await loadFixture(defaultDeploy);
      await setDurationConfigTest(
        {
          arenaContract: arenaContractV3,
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
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.min + 1,
          entryFee: 0,
          requiredPlayers: 10,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__ZeroValue',
        },
      );
    });

    it('Should be reverted if duration not in config range', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max + 1,
          entryFee: 10,
          requiredPlayers: 10,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidDuration',
        },
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.min - 1,
          entryFee: 10,
          requiredPlayers: 10,
          startTime: 0,
          boolParams: {
            boolParams: {
              signatured: false,
              lockArenaOnStart: false,
              lockRebuy: false,
            },
            name: 'arena',
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidDuration',
        },
      );
    });

    it('Should be reverted if type TIME and startTime not in config range', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 10,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidTimestamp',
        },
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 10,
          startTime:
            blockTimestamp + arenaInitialConfig.intervalToStartConfig.min - 1,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidTimestamp',
        },
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 10,
          startTime:
            blockTimestamp + arenaInitialConfig.intervalToStartConfig.max + 5,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidTimestamp',
        },
      );
    });

    it('Should be reverted if type PLACES and requiredPlayers not in config range', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.max + 1,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidPlayersRequired',
        },
      );
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.min - 1,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        {
          revertMessage: 'PVPArena__InvalidPlayersRequired',
        },
      );
    });

    it('Should be reverted if not owner try to create signatured arena', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
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
          from: regularAccounts[0],
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('Should be reverted if user try to create arena, but not send entryFee to enter', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
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
          from: regularAccounts[0],
          revertMessage: 'PVPArena__InvalidFeeAmount',
        },
      );
    });

    it('Should be created signatured arena and owner not join automaticaly', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: arenaInitialConfig.playersConfig.min,
        startTime: 0,
        boolParams: {
          signatured: false,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });
    });

    it('Should be created arena with type PLACES', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: arenaInitialConfig.playersConfig.min,
        startTime: 0,
        boolParams: {
          signatured: false,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );
    });

    it('Should be created arena with type TIME', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );

      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        boolParams: {
          signatured: false,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );
    });
  });

  describe('default arena: joinArena', () => {
    it('Should be reverted if entryFee invalid', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 5,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.05'), // Wrong fee amount
        },
        { revertMessage: 'PVPArena__InvalidFeeAmount' },
      );
    });

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 999, // Non-existent arena
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if TIME arena start time reached, but players not', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 5,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to join after start time
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__ArenaCanceled' },
      );
    });

    it('Should be reverted if player tried to join signatured arena', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 5,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          from: regularAccounts[0],
          revertMessage: 'PVPArena__ArenaIsSignatured',
        },
      );
    });

    it('Should be reverted if player already joined', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 5,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // First join succeeds
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Second join by same player fails
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__AlreadyJoined' },
      );
    });

    it('Should be reverted if join time exceeded for TIME arena', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // User joins successfully
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // User joins successfully
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // User joins successfully
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2) +
          Math.floor(arenaInitialConfig.durationConfig.max * 0.991),
      );

      // User joins successfully
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          from: regularAccounts[3],
          revertMessage: 'PVPArena__ArenaRebuyTimeExeeded',
        },
      );
    });

    it('Should be reverted if join time exceeded for PLACES arena', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // User joins successfully
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // User joins successfully
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // User joins successfully
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.durationConfig.max * 0.991),
      );

      // User joins successfully
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          from: regularAccounts[3],
          revertMessage: 'PVPArena__ArenaRebuyTimeExeeded',
        },
      );
    });

    it('Should be reverted if join PLACES arena when started and lockArenaOnStart true', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 1
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 1, // Only 1 player needed to fill arena
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: true,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Second join should fail as arena is full
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          revertMessage: 'PVPArena__ArenaLockedOnStart',
        },
      );
    });

    it('Should be reverted if join TIME arena when started and lockArenaOnStart true', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 1,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: true,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
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
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        {
          from: regularAccounts[3],
          revertMessage: 'PVPArena__ArenaLockedOnStart',
        },
      );
    });

    it('Should successfully join TIME arena', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 5,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // User joins successfully
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });
    });

    it('Should successfully join PLACES arena', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // First user joins
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });
    });

    it('Should start PLACES arena when required players join', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Get current block timestamp for later comparison
      const blockTimestampBefore = (
        await arenaContractV3.provider.getBlock('latest')
      ).timestamp;

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[1],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Verify arena not started yet
      let arena = await arenaContractV3.arenas(1);
      expect(arena.players).to.equal(2);
      expect(arena.startTime).to.equal(0);
      expect(arena.endTime).to.equal(0);

      // Third user joins, should trigger arena start
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[2],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Verify arena started
      arena = await arenaContractV3.arenas(1);
      expect(arena.startTime).to.be.at.least(blockTimestampBefore);
      expect(arena.endTime).to.equal(arena.startTime.add(arena.duration));
    });

    it('Should successfully join TIME arena when started', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 1,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
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
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[3] },
      );
    });

    it('Should successfully join PLACES arena when started', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 1
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 1, // Only 1 player needed to fill arena
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Second join should fail as arena is full
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
    });
  });

  describe('signature-based arena: joinArena', () => {
    it('Should be reverted if signature is invalid', async () => {
      const { arenaContractV3, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 5,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena', // Requires signature
      });

      // Try to join with signature from non-signer (user)
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: owner,
          freeFromFee: true,
          discountBps: 0,
          nonce: 1,
          signer: user, // Not authorized signer
        },
        { revertMessage: 'PVPArena__IsNotSigner' },
      );
    });

    it('Should be reverted if nonce already used', async () => {
      const { arenaContractV3, owner, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 5,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena', // Requires signature
      });

      // First join with nonce = 1 succeeds
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: owner,
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      // Second join with same nonce should fail
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: owner,
          freeFromFee: true,
          discountBps: 0,
          nonce: 1, // Same nonce
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__NonceAlreadyUsed' },
      );
    });

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContractV3, owner, arenaSigner } = await loadFixture(
        defaultDeploy,
      );

      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 999, // Non-existent arena
          freeFromFee: true,
          discountBps: 0,
          player: owner,
          nonce: 1,
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if arena canceled', async () => {
      const {
        arenaContractV3,
        owner,
        arenaSigner,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 5,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to join after start time
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: owner,
          freeFromFee: true,
          discountBps: 0,
          nonce: 1,
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__ArenaCanceled' },
      );
    });

    it('Should be reverted if player already joined', async () => {
      const { arenaContractV3, owner, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 5,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });

      // First join succeeds with nonce 1
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: owner,
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      // Second join by same player fails, even with different nonce
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: owner,
          nonce: 2,
          freeFromFee: true,
          discountBps: 0,
          signer: arenaSigner,
        },
        { revertMessage: 'PVPArena__AlreadyJoined' },
      );
    });

    it('Should successfully join with valid signature', async () => {
      const { arenaContractV3, owner, user, arenaSigner, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });

      // User joins with signature (free join)
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: user,
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      // Verify arena state
      const arena = await arenaContractV3.arenas(1);
      expect(arena.players).to.equal(1);

      // Verify user is a participant
      const arenaIdHash = ethers.utils.solidityKeccak256(['uint256'], [1]);
      const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
        ['bytes32', 'address'],
        [arenaIdHash, user.address],
      );
      expect(
        await arenaContractV3.participants(arenaIdAndAddressHash),
      ).to.equal(true);

      // Verify fees NOT collected (signature join is free)
      expect(await arenaContractV3.feesByArena(1)).to.equal(0);
    });

    it('Should successfully join arena when started', async () => {
      const {
        arenaContractV3,
        owner,
        arenaSigner,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a signatured TIME arena
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.TIME,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 0,
        startTime:
          blockTimestamp +
          Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });

      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: regularAccounts[0],
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: regularAccounts[1],
        freeFromFee: true,
        discountBps: 0,
        nonce: 2,
        signer: arenaSigner,
      });

      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: regularAccounts[2],
        freeFromFee: true,
        discountBps: 0,
        nonce: 3,
        signer: arenaSigner,
      });

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to join after start time
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: owner,
        freeFromFee: true,
        discountBps: 0,
        nonce: 4,
        signer: arenaSigner,
      });
    });

    it('Should successfully start PLACES arena when required players join with signatures', async () => {
      const {
        arenaContractV3,
        owner,
        regularAccounts,
        arenaSigner,
        arenaInitialConfig,
      } = await loadFixture(defaultDeploy);

      // Create a signatured PLACES arena with requiredPlayers = 3
      await createArenaV3Test({
        arenaContract: arenaContractV3,
        owner,
        type: ArenaType.PLACES,
        duration: arenaInitialConfig.durationConfig.max,
        entryFee: parseEther('0.1'),
        requiredPlayers: 3,
        startTime: 0,
        boolParams: {
          signatured: true,
          lockArenaOnStart: false,
          lockRebuy: false,
        },
        name: 'arena',
      });

      // Get current block timestamp for later comparison
      const blockTimestampBefore = (
        await arenaContractV3.provider.getBlock('latest')
      ).timestamp;

      // First two users join with signature
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: regularAccounts[0],
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: regularAccounts[1],
        freeFromFee: true,
        discountBps: 0,
        nonce: 2,
        signer: arenaSigner,
      });

      // Verify arena not started yet
      let arena = await arenaContractV3.arenas(1);
      expect(arena.players).to.equal(2);
      expect(arena.startTime).to.equal(0);
      expect(arena.endTime).to.equal(0);

      // Third user joins, should trigger arena start
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: regularAccounts[2],
        freeFromFee: true,
        discountBps: 0,
        nonce: 3,
        signer: arenaSigner,
      });

      // Verify arena started
      arena = await arenaContractV3.arenas(1);
      expect(arena.players).to.equal(3);
      expect(arena.startTime).to.be.at.least(blockTimestampBefore);
      expect(arena.endTime).to.equal(arena.startTime.add(arena.duration));
    });
  });

  describe('default arena: joinArena with discount using signature', () => {
    it('Should revert if join with valid signature and discount 10%, but with invalid amount to send', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaSigner,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      const entryFee = parseEther('0.1');
      const discountBps = 100; // 10%

      // Create a signatured TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee,
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: entryFee },
      );

      const discount = entryFee.mul(discountBps).div(10000);

      // User joins with signature (free join)
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: user,
          freeFromFee: false,
          discountBps,
          nonce: 1,
          signer: arenaSigner,
        },
        {
          value: entryFee.sub(discount.mul(2)),
          revertMessage: 'PVPArena__InvalidFeeAmount',
        },
      );
    });

    it('Should successfully join with valid signature and discount 10%', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaSigner,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      const entryFee = parseEther('0.1');
      const discountBps = 100; // 10%

      // Create a signatured TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee,
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: entryFee },
      );

      const discount = entryFee.mul(discountBps).div(10000);

      // User joins with signature (free join)
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: user,
          freeFromFee: false,
          discountBps,
          nonce: 1,
          signer: arenaSigner,
        },
        {
          value: entryFee.sub(discount),
        },
      );

      // Verify arena state
      const arena = await arenaContractV3.arenas(1);
      expect(arena.players).to.equal(2);

      // Verify user is a participant
      const arenaIdHash = ethers.utils.solidityKeccak256(['uint256'], [1]);
      const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
        ['bytes32', 'address'],
        [arenaIdHash, user.address],
      );
      expect(
        await arenaContractV3.participants(arenaIdAndAddressHash),
      ).to.equal(true);
    });

    it('Should successfully join with valid signature and no discount', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaSigner,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      const entryFee = parseEther('0.1');
      const discountBps = 0;

      // Create a signatured TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee,
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: entryFee },
      );

      const discount = entryFee.mul(discountBps).div(10000);

      // User joins with signature (free join)
      await joinArenaWithSignatureTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          player: user,
          freeFromFee: false,
          discountBps,
          nonce: 1,
          signer: arenaSigner,
        },
        {
          value: entryFee.sub(discount),
        },
      );

      // Verify arena state
      const arena = await arenaContractV3.arenas(1);
      expect(arena.players).to.equal(2);

      // Verify user is a participant
      const arenaIdHash = ethers.utils.solidityKeccak256(['uint256'], [1]);
      const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
        ['bytes32', 'address'],
        [arenaIdHash, user.address],
      );
      expect(
        await arenaContractV3.participants(arenaIdAndAddressHash),
      ).to.equal(true);
    });
  });

  describe('leaveArena', () => {
    it('Should be reverted if arena does not exist', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);

      await leaveArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 999, // Non-existent arena
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if TIME arena has already started', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      // Forward time to after arena starts
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to leave after start time
      await leaveArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if PLACES arena has reached required players', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 1
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 2, // Only 2 players needed to fill arena
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Both players join
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Second join should fail as arena is full
      await leaveArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__ArenaStarted' },
      );
    });

    it('Should be reverted if player has not joined', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // User hasn't joined
      await leaveArenaTest(
        {
          arenaContract: arenaContractV3,
          owner: user, // User hasn't joined
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__NotJoined' },
      );
    });

    it('Should successfully leave a TIME arena', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join the arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Leave the arena
      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });
    });

    it('Should paid back 0 amount if user joined arena by signature with freeFromFee', async () => {
      const {
        arenaContractV3,
        owner,
        arenaInitialConfig,
        regularAccounts,
        arenaSigner,
      } = await loadFixture(defaultDeploy);

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 2
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 4,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join the arena
      // User joins with signature
      await joinArenaWithSignatureTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        player: owner,
        freeFromFee: true,
        discountBps: 0,
        nonce: 1,
        signer: arenaSigner,
      });

      const balanceBeforeLeave = await ethers.provider.getBalance(
        owner.address,
      );

      // Leave the arena
      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      const balanceAfterLeave = await ethers.provider.getBalance(owner.address);
      expect(balanceAfterLeave).eq(balanceBeforeLeave);
    });

    it('Should successfully leave a PLACES arena', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);

      await setPlayersConfigTest({
        arenaContract: arenaContractV3,
        owner,
        newConfig: {
          max: 5,
          min: 1,
        },
      });

      // Create a PLACES arena with requiredPlayers = 2
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 4,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join the arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Leave the arena
      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });
    });

    it('Should delete arena when last player leaves', async () => {
      const { arenaContractV3, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: user,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // First player leaves
      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      // Arena should still exist
      let arena = await arenaContractV3.arenas(1);
      expect(arena.id).to.equal(1);
      expect(arena.players).to.equal(1);

      // Last player leaves, arena should be deleted
      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner: user,
        arenaId: 1,
      });

      // Arena should be deleted
      arena = await arenaContractV3.arenas(1);
      expect(arena.id).to.equal(0);
    });
  });

  describe('rebuy', () => {
    const rebuyFixture = async (
      type: 'Places' | 'Time',
      withLockRebuy: boolean = false,
      withLockOnStart: boolean = false,
    ) => {
      const fixture = await loadFixture(defaultDeploy);

      const blockTimestamp = (
        await fixture.arenaContractV3.provider.getBlock('latest')
      ).timestamp;

      if (type === 'Places') {
        await createArenaV3Test(
          {
            arenaContract: fixture.arenaContractV3,
            owner: fixture.owner,
            type: ArenaType.PLACES,
            duration: fixture.arenaInitialConfig.durationConfig.max,
            entryFee: parseEther('0.1'),
            requiredPlayers: 3,
            startTime: 0,
            boolParams: {
              signatured: false,
              lockArenaOnStart: withLockOnStart,
              lockRebuy: withLockRebuy,
            },
            name: 'arena',
          },
          { from: fixture.regularAccounts[0], value: parseEther('0.1') },
        );
      } else {
        await createArenaV3Test(
          {
            arenaContract: fixture.arenaContractV3,
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
            boolParams: {
              signatured: false,
              lockArenaOnStart: withLockOnStart,
              lockRebuy: withLockRebuy,
            },
            name: 'arena',
          },
          { from: fixture.regularAccounts[0], value: parseEther('0.1') },
        );
      }

      return { ...fixture, blockTimestamp };
    };

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 999, // Non-existent arena
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if arena emergency closed', async () => {
      const { arenaContractV3, owner } = await rebuyFixture('Places');

      await emergencyCloseTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__EmergencyClosed' },
      );
    });

    it('Should be reverted if PLACES arena not started', async () => {
      const { arenaContractV3, owner } = await rebuyFixture('Places');

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );
    });

    it('Should be reverted if TIME arena not started', async () => {
      const { arenaContractV3, owner } = await rebuyFixture('Time');

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );
    });

    it('Should be reverted if sent insufficient ether to entry', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await rebuyFixture('Time');

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
      );

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        {
          revertMessage: 'PVPArena__InvalidFeeAmount',
          value: parseEther('0.05'),
        },
      );
    });

    it('Should be reverted if not joined arena', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await rebuyFixture('Time');

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
      );

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        {
          revertMessage: 'PVPArena__NotJoined',
          from: regularAccounts[5],
          value: parseEther('0.1'),
        },
      );
    });

    it('Should be reverted if rebuy time exceeded', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await rebuyFixture('Time');

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2) +
          Math.floor(arenaInitialConfig.durationConfig.max * 0.991),
      );

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        {
          revertMessage: 'PVPArena__ArenaRebuyTimeExeeded',
          value: parseEther('0.1'),
        },
      );
    });

    it('Should successfully rebuy', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await rebuyFixture('Time');

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2) +
          Math.floor(arenaInitialConfig.durationConfig.max * 0.5),
      );

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        {
          value: parseEther('0.1'),
        },
      );
    });

    it('Should revert if lockRebuy true', async () => {
      const {
        arenaContractV3: arenaContract,
        owner,
        regularAccounts,
      } = await rebuyFixture('Places', true);

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
          revertMessage: 'PVPArena__ArenaRebuyLocked',
        },
      );
    });

    it('Should successfully rebuy when lockArenaOnStart true', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await rebuyFixture('Time', false, true);

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      await increaseTime(
        Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2) +
          Math.floor(arenaInitialConfig.durationConfig.max * 0.5),
      );

      await rebuyTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        {
          value: parseEther('0.1'),
        },
      );
    });

    it('Should refund all deposits', async () => {
      const {
        arenaContractV3: arenaContract,
        owner,
        regularAccounts,
      } = await rebuyFixture('Places');

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

  describe('endArenaAndDistributeRewards', () => {
    it('Should be reverted if caller is not admin', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
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
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should be reverted if arena does not exist', async () => {
      const { arenaContractV3, owner } = await loadFixture(defaultDeploy);

      await endArenaAndDistributeRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 999, // Non-existent arena
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__InvalidArenaID' },
      );
    });

    it('Should be reverted if TIME arena has not started', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.max / 2),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Try to end arena before it starts
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );
    });

    it('Should be reverted if PLACES arena does not have enough players', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 2
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: arenaInitialConfig.playersConfig.min,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Try to end arena before enough players join
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__ArenaNotStarted' },
      );
    });

    it('Should be reverted if arena has not ended', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // Forward time to after arena starts but before it ends
      await increaseTime(arenaInitialConfig.intervalToStartConfig.min + 20);

      // Try to end arena before it ends
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
        },
        { revertMessage: 'PVPArena__ArenaNotEnded' },
      );
    });

    it('Should be reverted if arena already ended', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // End arena first time
      const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'));
      await endArenaAndDistributeRewardsTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });

      // Try to end arena again
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          root: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test2')),
        },
        { revertMessage: 'PVPArena__AlreadyEnded' },
      );
    });

    it('Should successfully end a TIME arena', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

      // Forward time to after arena ends
      await increaseTime(
        arenaInitialConfig.intervalToStartConfig.min +
          arenaInitialConfig.durationConfig.max +
          20,
      );

      // End arena
      const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'));
      await endArenaAndDistributeRewardsTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });
    });

    it('Should successfully end a PLACES arena', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { from: regularAccounts[0], value: parseEther('0.1') },
      );

      // All required players join
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[1],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[2],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Forward time to after arena ends
      await increaseTime(arenaInitialConfig.durationConfig.max + 20);

      // End arena
      const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'));
      await endArenaAndDistributeRewardsTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });
    });
  });

  describe('claimRewards', () => {
    it('Should be reverted if rewards not distributed', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Try to claim rewards before distribution
      await claimRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          amount: parseEther('0.09'),
          proofs: [],
        },
        { revertMessage: 'PVPArena__RewardsNotDistributed' },
      );
    });

    it('Should be reverted if player has already claimed', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

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
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });

      // Claim rewards
      await claimRewardsTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        amount: parseEther('0.09'),
        proofs: getProof(0),
      });

      // Try to claim again
      await claimRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          amount: parseEther('0.09'),
          proofs: getProof(0),
        },
        { revertMessage: 'PVPArena__AlreadyClaimed' },
      );
    });

    it('Should be reverted if proof is invalid', async () => {
      const {
        arenaContractV3,
        owner,
        user,
        arenaInitialConfig,
        regularAccounts,
      } = await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

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
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });

      // User tries to claim with invalid proof (empty proof)
      await claimRewardsTest(
        {
          arenaContract: arenaContractV3,
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
          arenaContract: arenaContractV3,
          owner: user,
          arenaId: 1,
          amount: parseEther('0.10'),
          proofs: getProof(0),
        },
        { revertMessage: 'PVPArena__InvalidProofs' },
      );
    });

    it('Should successfully claim rewards with valid proof', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Join arena
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[1] },
      );

      // Join arena
      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { from: regularAccounts[2] },
      );

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
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });

      // Owner claims rewards
      await claimRewardsTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        amount: parseEther('0.09'),
        proofs: getProof(0),
      });
    });

    it('Should successfully claim rewards for multiple players', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // All required players join
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[0],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract: arenaContractV3,
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
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        root,
      });

      // First player claims rewards
      await claimRewardsTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        amount: parseEther('0.09'),
        proofs: getProof(0),
      });

      // Second player claims rewards
      await claimRewardsTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[0],
        arenaId: 1,
        amount: parseEther('0.08'),
        proofs: getProof(1),
      });

      // Third player claims rewards
      await claimRewardsTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[1],
        arenaId: 1,
        amount: parseEther('0.07'),
        proofs: getProof(2),
      });
    });
  });

  describe('emnergency close', () => {
    it('Should be reverted not admin try to emergency close arena', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, regularAccounts } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Try to claim rewards before distribution
      await emergencyCloseTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
        },
        {
          from: regularAccounts[0],
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('Should be emergency closed by admin', async () => {
      const { arenaContractV3, owner, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Try to claim rewards before distribution
      await emergencyCloseTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });
    });

    it('Should be reverted if admin try to distribute rewards for emergency closed arena', async () => {
      const { arenaContractV3, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Try to claim rewards before distribution
      await emergencyCloseTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
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
      const { root } = createRewardsMerkleTree(rewards);

      // End arena and distribute rewards
      await endArenaAndDistributeRewardsTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          root,
        },
        { revertMessage: 'PVPArena__EmergencyClosed' },
      );
    });

    it('Should be reverted if user try to join emergency closed arena', async () => {
      const { arenaContractV3, owner, user, arenaInitialConfig } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // Try to claim rewards before distribution
      await emergencyCloseTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      await joinArenaTest(
        {
          arenaContract: arenaContractV3,
          owner,
          arenaId: 1,
          value: parseEther('0.1'),
        },
        { revertMessage: 'PVPArena__EmergencyClosed' },
      );
    });

    it('Initial pize pool should transfer to treasury when emergency closed', async () => {
      const { arenaContractV3, owner, arenaInitialConfig, treasury } =
        await loadFixture(defaultDeploy);
      const blockTimestamp = (await arenaContractV3.provider.getBlock('latest'))
        .timestamp;

      const initialPrizePool = parseEther('1');

      // Create a TIME arena
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.TIME,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 0,
          startTime:
            blockTimestamp +
            Math.floor(arenaInitialConfig.intervalToStartConfig.min + 10),
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: initialPrizePool },
      );

      const treasuryBalanceBefore = await treasury.getBalance();

      await emergencyCloseTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      const treasuryBalanceAfter = await treasury.getBalance();

      expect(treasuryBalanceAfter).eq(
        treasuryBalanceBefore.add(initialPrizePool),
      );
    });

    it('Users should able to leave and get refund from closed arena', async () => {
      const { arenaContractV3, owner, regularAccounts, arenaInitialConfig } =
        await loadFixture(defaultDeploy);

      // Create a PLACES arena with requiredPlayers = 3
      await createArenaV3Test(
        {
          arenaContract: arenaContractV3,
          owner,
          type: ArenaType.PLACES,
          duration: arenaInitialConfig.durationConfig.max,
          entryFee: parseEther('0.1'),
          requiredPlayers: 3,
          startTime: 0,
          boolParams: {
            signatured: false,
            lockArenaOnStart: false,
            lockRebuy: false,
          },
          name: 'arena',
        },
        { value: parseEther('0.1') },
      );

      // All required players join
      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[0],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await joinArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[1],
        arenaId: 1,
        value: parseEther('0.1'),
      });

      await emergencyCloseTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      // Forward time to after arena ends
      await increaseTime(arenaInitialConfig.durationConfig.max + 20);

      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner,
        arenaId: 1,
      });

      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[0],
        arenaId: 1,
      });

      await leaveArenaTest({
        arenaContract: arenaContractV3,
        owner: regularAccounts[1],
        arenaId: 1,
      });
    });
  });
});
