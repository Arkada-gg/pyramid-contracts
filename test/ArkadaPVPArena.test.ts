import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { IMintPyramidData, signMintDataTyped } from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  setFeeBPSTest,
  setMinIntervalToStartTest,
  setMinPlayersCountTest,
  setTreasuryTest,
} from './common/pvp-arena.helpers';
import {
  mintPyramidTest,
  setIsMintingActiveTest,
} from './common/pyramid.helpers';

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

    it('Should set correct treasury, feeBPS, minPlayersCount and minIntervalToStart', async () => {
      const { arenaContract, treasury, arenaInitialConfig } = await loadFixture(
        defaultDeploy,
      );
      expect(await arenaContract.treasury()).to.equal(treasury.address);
      expect(await arenaContract.feeBPS()).to.equal(arenaInitialConfig.feeBPS);
      expect(await arenaContract.minPlayersCount()).to.equal(
        arenaInitialConfig.minPlayersCount,
      );
      expect(await arenaContract.minIntervalToStart()).to.equal(
        arenaInitialConfig.minIntervalToStart,
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

  describe('minPlayersCount Control', () => {
    it('Should allow owner to set minPlayersCount', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setMinPlayersCountTest({
        arenaContract,
        owner,
        newMinPlayersCount: 5,
      });
      await setMinPlayersCountTest({
        arenaContract,
        owner,
        newMinPlayersCount: 6,
      });
    });

    it('Should not allow non-owner to set minPlayersCount', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setMinPlayersCountTest(
        {
          arenaContract,
          owner,
          newMinPlayersCount: 6,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('minIntervalToStart Control', () => {
    it('Should allow owner to set minPlayersCount', async () => {
      const { arenaContract, owner } = await loadFixture(defaultDeploy);
      await setMinIntervalToStartTest({
        arenaContract,
        owner,
        newMinIntervalToStart: 5,
      });
      await setMinIntervalToStartTest({
        arenaContract,
        owner,
        newMinIntervalToStart: 6,
      });
    });

    it('Should not allow non-owner to set minIntervalToStart', async () => {
      const { arenaContract, owner, user } = await loadFixture(defaultDeploy);
      await setMinIntervalToStartTest(
        {
          arenaContract,
          owner,
          newMinIntervalToStart: 6,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  

  describe('Minting', () => {
    it('Should not allow minting when inactive', async () => {
      const {
        pyramidContract,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: false });

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: user.address,
            BPS: 10000,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, user, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__MintingIsNotActive' },
      );
    });

    it('Should not allow minting with invalid signature', async () => {
      const {
        pyramidContract,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: user.address,
            BPS: 10000,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, user, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: ethers.utils.parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__IsNotSigner' },
      );
    });

    it('Should not allow minting with used nonce', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: user.address,
            BPS: 100,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: parseEther('0.01'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__NonceAlreadyUsed' },
      );
    });

    it('Should not allow minting if quest id for user already minted', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: user.address,
            BPS: 100,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: parseEther('0.01'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      const data2 = { ...data, nonce: 2 };
      const signature2 = await signMintDataTyped(data2, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data: data2,
          signature: signature2,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__MintedForQuestId' },
      );
    });

    it('Should allow successful minting', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
        treasury,
        arkadaRewarderContract,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: questSigner.address,
            BPS,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      const recipientRewardsBefore = await arkadaRewarderContract.userRewards(
        questSigner.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      const rewardsBefore = await arkadaRewarderContract.userRewards(
        user.address,
      );
      const rewarderBalanceBefore = await ethers.provider.getBalance(
        arkadaRewarderContract.address,
      );

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      const treasuryBalanceAfter = await ethers.provider.getBalance(
        treasury.address,
      );
      const recipientRewardsAfter = await arkadaRewarderContract.userRewards(
        questSigner.address,
      );
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const rewardsAfter = await arkadaRewarderContract.userRewards(
        user.address,
      );
      const rewarderBalanceAfter = await ethers.provider.getBalance(
        arkadaRewarderContract.address,
      );

      expect(recipientRewardsAfter).to.equal(
        recipientRewardsBefore.add(expectedRecipientPayout),
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout).sub(rewards),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(rewardsAfter).to.equal(rewardsBefore.add(rewards));

      expect(rewarderBalanceAfter).to.equal(
        rewarderBalanceBefore.add(rewards).add(expectedRecipientPayout),
      );
    });

    it('Should not allow minting with too high BPS', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 10001;

      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: questSigner.address,
            BPS,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__BPSTooHigh' },
      );
    });

    it('Should not allow minting if (rewards + referrals) > price', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;

      const rewards = parseEther('0.4');

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: questSigner.address,
            BPS,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__RewardTooHigh' },
      );
    });

    it('Should not allow successful minting with price 0', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const price = ethers.constants.Zero;
      const BPS = 100;

      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: questSigner.address,
            BPS,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
        },
        { from: user, revertMessage: 'Pyramid__RewardTooHigh' },
      );
    });

    it('Should allow successful minting with rewards 0', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.01');
      const BPS = 100;

      const rewards = ethers.constants.Zero;

      const data: IMintPyramidData = {
        questId: QUEST_ID.toString(),
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [
          {
            txHash: '0x123',
            networkChainId: 'networkChainId',
          },
        ],
        recipients: [
          {
            recipient: questSigner.address,
            BPS,
          },
        ],
        reward: {
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest({
        pyramidContract,
        owner,
        data,
        signature,
        value: price,
      });
    });
  });
});
