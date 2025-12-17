import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { IMintPyramidData, signMintDataTyped } from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  mintPyramidTest,
  setIsMintingActiveTest,
  setTreasuryTest,
  withdrawTest,
} from './common/pyramid-escrow.helpers';

describe('PyramidEscrowMultiV1', () => {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { pyramidEscrowContractMulti, owner } = await loadFixture(
        defaultDeploy,
      );
      expect(
        await pyramidEscrowContractMulti.hasRole(
          await pyramidEscrowContractMulti.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set the right signer role', async () => {
      const { pyramidEscrowContractMulti, questSigner } = await loadFixture(
        defaultDeploy,
      );
      expect(
        await pyramidEscrowContractMulti.hasRole(
          await pyramidEscrowContractMulti.SIGNER_ROLE(),
          questSigner.address,
        ),
      ).to.equal(true);
    });

    it('Should set initial minting state to true', async () => {
      const { pyramidEscrowContractMulti } = await loadFixture(defaultDeploy);
      expect(await pyramidEscrowContractMulti.s_isMintingActive()).to.equal(
        true,
      );
    });

    it('Should set correct token name and symbol', async () => {
      const { pyramidEscrowContractMulti } = await loadFixture(defaultDeploy);
      expect(await pyramidEscrowContractMulti.name()).to.equal('Pyramid');
      expect(await pyramidEscrowContractMulti.symbol()).to.equal('PYR');
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to set minting state', async () => {
      const { pyramidEscrowContractMulti, owner } = await loadFixture(
        defaultDeploy,
      );
      await setIsMintingActiveTest({
        pyramidEscrowContract: pyramidEscrowContractMulti,
        owner,
        isActive: true,
      });
      await setIsMintingActiveTest({
        pyramidEscrowContract: pyramidEscrowContractMulti,
        owner,
        isActive: false,
      });
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { pyramidEscrowContractMulti, owner, user } = await loadFixture(
        defaultDeploy,
      );
      await setIsMintingActiveTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          isActive: true,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { pyramidEscrowContractMulti, owner, treasury } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest({
        pyramidEscrowContract: pyramidEscrowContractMulti,
        owner,
        treasury: treasury.address,
      });
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { pyramidEscrowContractMulti, owner, user, treasury } =
        await loadFixture(defaultDeploy);
      await setTreasuryTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          treasury: treasury.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { pyramidEscrowContractMulti, owner } = await loadFixture(
        defaultDeploy,
      );
      await setTreasuryTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          treasury: ethers.constants.AddressZero,
        },
        { revertMessage: 'Pyramid__ZeroAddress' },
      );
    });
  });

  describe('Minting', () => {
    it('Should not allow minting when inactive', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({
        pyramidEscrowContract: pyramidEscrowContractMulti,
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
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, user, domain);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
        pyramidEscrowContractMulti,
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
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: factoryContract.address,
        },
      };

      const signature = await signMintDataTyped(data, user, domain);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Pyramid__NonceAlreadyUsed' },
      );
    });

    it('Should allow minting if quest id for user already minted', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.01'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      const data2 = { ...data, nonce: 2 };
      const signature2 = await signMintDataTyped(
        data2,
        questSigner,
        domainEscrowMulti,
      );

      await mintPyramidTest({
        pyramidEscrowContract: pyramidEscrowContractMulti,
        owner,
        data: data2,
        signature: signature2,
        value: parseEther('0.1'),
      });
    });

    it('Should allow successful minting with native token rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );

      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(
        userBalanceBefore.sub(price).add(rewards),
      );
    });

    it('Should allow successful minting with native token global rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        globalEscrowContract,
        domainEscrowMulti,
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
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );

      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(
        userBalanceBefore.sub(price).add(rewards),
      );
    });

    it('Should allow successful minting without any rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domainEscrowMulti,
        treasury,
        arkadaRewarderContract,
      } = await loadFixture(defaultDeploy);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0');

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
          chainId: 0,
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
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
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const erc20BalanceBefore = await tokens.erc20Token.balanceOf(
        user.address,
      );
      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const erc20BalanceAfter = await tokens.erc20Token.balanceOf(user.address);
      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(erc20BalanceAfter).to.equal(erc20BalanceBefore.add(rewards));
    });

    it('Should allow successful minting with erc20 token global rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        globalEscrowContract,
        domainEscrowMulti,
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
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: tokens.erc20Token.address,
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const erc20BalanceBefore = await tokens.erc20Token.balanceOf(
        user.address,
      );
      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const erc20BalanceAfter = await tokens.erc20Token.balanceOf(user.address);
      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(erc20BalanceAfter).to.equal(erc20BalanceBefore.add(rewards));
    });

    it('Should allow successful minting with erc721 token rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          tokenId: 3,
          tokenType: 1,
          rakeBps: 0,
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      const referalBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      const referalBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referalBalanceAfter.sub(referalBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await tokens.erc721Token.ownerOf(3)).eq(user.address);
    });

    it('Should allow successful minting with erc721 token global rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        globalEscrowContract,
        domainEscrowMulti,
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
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: tokens.erc721Token.address,
          amount: rewards,
          tokenId: 2,
          tokenType: 1,
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      const referalBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      const referalBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referalBalanceAfter.sub(referalBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await tokens.erc721Token.ownerOf(2)).eq(user.address);
    });

    it('Should allow successful minting with erc1155 token rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await tokens.erc1155Token.balanceOf(user.address, 1)).eq(rewards);
    });

    it('Should allow successful minting with erc1155 token global rewards', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        globalEscrowContract,
        domainEscrowMulti,
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
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: tokens.erc1155Token.address,
          amount: rewards,
          tokenId: 2,
          tokenType: 2,
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const referralBalanceBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
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
      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      const referralBalanceAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(referralBalanceAfter.sub(referralBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await tokens.erc1155Token.balanceOf(user.address, 2)).eq(rewards);
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds', async () => {
      const {
        pyramidEscrowContractMulti,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContractMulti,
        domainEscrowMulti,
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
          factoryAddress: factoryContractMulti.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: parseEther('0.1'),
          tokenId: 0,
          tokenType: 3,
          rakeBps: 10000,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTyped(
        data,
        questSigner,
        domainEscrowMulti,
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
          data,
          signature,
          value: parseEther('0.4'),
        },
        { from: user },
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      await withdrawTest({
        pyramidEscrowContract: pyramidEscrowContractMulti,
        owner,
      });

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore.add(parseEther('0.3')));
    });

    it('Should not allow non-owner to withdraw funds', async () => {
      const { pyramidEscrowContractMulti, owner, user } = await loadFixture(
        defaultDeploy,
      );
      await withdrawTest(
        {
          pyramidEscrowContract: pyramidEscrowContractMulti,
          owner,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });
});
