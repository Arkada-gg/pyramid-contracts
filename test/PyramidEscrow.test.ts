import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { IMintPyramidData, signMintDataTyped } from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  initializeQuestTest,
  mintPyramidTest,
  setIsMintingActiveTest,
  setTreasuryTest,
  unpublishQuestTest,
  withdrawTest,
} from './common/pyramid-escrow.helpers';

describe.only('PyramidEscrow', () => {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { pyramidEscrowContract, owner } = await loadFixture(defaultDeploy);
      expect(
        await pyramidEscrowContract.hasRole(
          await pyramidEscrowContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set initial minting state to true', async () => {
      const { pyramidEscrowContract } = await loadFixture(defaultDeploy);
      expect(await pyramidEscrowContract.s_isMintingActive()).to.equal(true);
    });

    it('Should set correct token name and symbol', async () => {
      const { pyramidEscrowContract } = await loadFixture(defaultDeploy);
      expect(await pyramidEscrowContract.name()).to.equal('Pyramid');
      expect(await pyramidEscrowContract.symbol()).to.equal('PYR');
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to set minting state', async () => {
      const { pyramidEscrowContract, owner } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: true,
      });
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: false,
      });
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { pyramidEscrowContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      await setIsMintingActiveTest(
        { pyramidEscrowContract, owner, isActive: true },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { pyramidEscrowContract, owner, treasury } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest({
        pyramidEscrowContract,
        owner,
        treasury: treasury.address,
      });
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { pyramidEscrowContract, owner, user, treasury } =
        await loadFixture(defaultDeploy);
      await setTreasuryTest(
        {
          pyramidEscrowContract,
          owner,
          treasury: treasury.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { pyramidEscrowContract, owner } = await loadFixture(defaultDeploy);
      await setTreasuryTest(
        {
          pyramidEscrowContract,
          owner,
          treasury: ethers.constants.AddressZero,
        },
        { revertMessage: 'Pyramid__ZeroAddress' },
      );
    });
  });

  describe('Quest Management', () => {
    it('Should allow signer role to initialize quest', async () => {
      const {
        pyramidEscrowContract,
        owner,
        questSigner,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: true,
      });

      await initializeQuestTest(
        {
          pyramidEscrowContract,
          owner,
          questId: QUEST_ID,
          communities: COMMUNITIES,
          title: TITLE,
          difficulty: DIFFICULTY,
          questType: QUEST_TYPE,
          tags: TAGS,
        },
        { from: questSigner },
      );
    });

    it('Should not allow non-signer role to initialize quest', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: true,
      });

      await initializeQuestTest(
        {
          pyramidEscrowContract,
          owner,
          questId: QUEST_ID,
          communities: COMMUNITIES,
          title: TITLE,
          difficulty: DIFFICULTY,
          questType: QUEST_TYPE,
          tags: TAGS,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should allow signer role to unpublish quest', async () => {
      const {
        pyramidEscrowContract,
        owner,
        questSigner,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: true,
      });

      await initializeQuestTest(
        {
          pyramidEscrowContract,
          owner,
          questId: QUEST_ID,
          communities: COMMUNITIES,
          title: TITLE,
          difficulty: DIFFICULTY,
          questType: QUEST_TYPE,
          tags: TAGS,
        },
        { from: questSigner },
      );

      await unpublishQuestTest(
        {
          pyramidEscrowContract,
          owner,
          questId: QUEST_ID,
        },
        { from: questSigner },
      );
    });

    it('Should not allow non-owner to unpublish quest', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: true,
      });

      await initializeQuestTest(
        {
          pyramidEscrowContract,
          owner,
          questId: QUEST_ID,
          communities: COMMUNITIES,
          title: TITLE,
          difficulty: DIFFICULTY,
          questType: QUEST_TYPE,
          tags: TAGS,
        },
        { from: questSigner },
      );

      await unpublishQuestTest(
        {
          pyramidEscrowContract,
          owner,
          questId: QUEST_ID,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Minting', () => {
    it('Should not allow minting when inactive', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract,
        owner,
        isActive: false,
      });

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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
          pyramidEscrowContract,
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
        pyramidEscrowContract,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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
          pyramidEscrowContract,
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
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrow,
      } = await loadFixture(defaultDeploy);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrow,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__NonceAlreadyUsed' },
      );
    });

    it('Should allow successful minting', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrow,
        treasury,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      const recipientBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract,
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
      const recipientBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      expect(recipientBalanceAfter).to.equal(
        recipientBalanceBefore.add(expectedRecipientPayout),
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(
        userBalanceBefore.sub(price).add(rewards),
      );
    });

    it('Should allow successful minting with erc20 token rewards', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrow,
        treasury,
        tokens,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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
          tokenAddress: tokens.erc20Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      const recipientBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const erc20BalanceBefore = await tokens.erc20Token.balanceOf(
        user.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract,
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
      const recipientBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const erc20BalanceAfter = await tokens.erc20Token.balanceOf(user.address);
      expect(recipientBalanceAfter).to.equal(
        recipientBalanceBefore.add(expectedRecipientPayout),
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(erc20BalanceAfter).to.equal(erc20BalanceBefore.add(rewards));
    });

    it('Should allow successful minting with erc721 token rewards', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrow,
        treasury,
        tokens,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = 1;

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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
          tokenAddress: tokens.erc721Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 1,
          tokenType: 1,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      const recipientBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract,
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
      const recipientBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      expect(recipientBalanceAfter).to.equal(
        recipientBalanceBefore.add(expectedRecipientPayout),
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await tokens.erc721Token.ownerOf(1)).eq(user.address);
    });

    it('Should allow successful minting with erc1155 token rewards', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrow,
        treasury,
        tokens,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = 1;

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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
          tokenAddress: tokens.erc1155Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 1,
          tokenType: 2,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      const recipientBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract,
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
      const recipientBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      expect(recipientBalanceAfter).to.equal(
        recipientBalanceBefore.add(expectedRecipientPayout),
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await tokens.erc1155Token.balanceOf(user.address, 1)).eq(rewards);
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds', async () => {
      const {
        pyramidEscrowContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrow,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;

      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
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

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrow,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract,
          owner,
          data,
          signature,
          value: parseEther('0.4'),
        },
        { from: user },
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      await withdrawTest({
        pyramidEscrowContract,
        owner,
      });

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore.add(parseEther('0.3')));
    });

    it('Should not allow non-owner to withdraw funds', async () => {
      const { pyramidEscrowContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      await withdrawTest(
        {
          pyramidEscrowContract,
          owner,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });
});
