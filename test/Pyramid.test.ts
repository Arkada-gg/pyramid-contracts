import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { IMintPyramidData, signMintDataTypedV1 } from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  mintPyramidTest,
  setArkadaRewarderTest,
  setIsMintingActiveTest,
  setTreasuryTest,
  withdrawTest,
} from './common/pyramid.helpers';

describe('Pyramid', () => {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);
      expect(
        await pyramidContract.hasRole(
          await pyramidContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set initial minting state to true', async () => {
      const { pyramidContract } = await loadFixture(defaultDeploy);
      expect(await pyramidContract.s_isMintingActive()).to.equal(true);
    });

    it('Should set correct token name and symbol', async () => {
      const { pyramidContract } = await loadFixture(defaultDeploy);
      expect(await pyramidContract.name()).to.equal('Pyramid');
      expect(await pyramidContract.symbol()).to.equal('PYR');
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to set minting state', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: false });
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { pyramidContract, owner, user } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest(
        { pyramidContract, owner, isActive: true },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { pyramidContract, owner, treasury } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest({
        pyramidContract,
        owner,
        treasury: treasury.address,
      });
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { pyramidContract, owner, user, treasury } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest(
        {
          pyramidContract,
          owner,
          treasury: treasury.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);
      await setTreasuryTest(
        {
          pyramidContract,
          owner,
          treasury: ethers.constants.AddressZero,
        },
        { revertMessage: 'Pyramid__ZeroAddress' },
      );
    });
  });

  describe('Arkada Rewarder Management', () => {
    it('Should allow owner to set arkada rewarder', async () => {
      const { pyramidContract, owner, arkadaRewarderContract } =
        await loadFixture(defaultDeploy);
      await setArkadaRewarderTest({
        pyramidContract,
        owner,
        arkadaRewarder: arkadaRewarderContract.address,
      });
    });

    it('Should not allow non-owner to set arkada rewarder', async () => {
      const { pyramidContract, owner, user, arkadaRewarderContract } =
        await loadFixture(defaultDeploy);
      await setArkadaRewarderTest(
        {
          pyramidContract,
          owner,
          arkadaRewarder: arkadaRewarderContract.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow setting arkada rewarder to zero address', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);
      await setArkadaRewarderTest(
        {
          pyramidContract,
          owner,
          arkadaRewarder: ethers.constants.AddressZero,
        },
        { revertMessage: 'Pyramid__ZeroAddress' },
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

      const signature = await signMintDataTypedV1(data, user, domain);

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

      const signature = await signMintDataTypedV1(data, user, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

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
      const signature2 = await signMintDataTypedV1(data2, questSigner, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

      await mintPyramidTest({
        pyramidContract,
        owner,
        data,
        signature,
        value: price,
      });
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds', async () => {
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

      const signature = await signMintDataTypedV1(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.4'),
        },
        { from: user },
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      await withdrawTest({
        pyramidContract,
        owner,
      });

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore.add(parseEther('0.3')));
    });

    it('Should not allow non-owner to withdraw funds', async () => {
      const { pyramidContract, owner, user } = await loadFixture(defaultDeploy);
      await withdrawTest(
        {
          pyramidContract,
          owner,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });
});
