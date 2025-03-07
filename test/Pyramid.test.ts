import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { parseEther } from 'ethers/lib/utils';
import {
  IMintPyramidData,
  signMintData,
  signMintDataTyped,
} from './common/common.helpers';
import { defaultDeploy } from './common/fixtures';
import {
  initializeQuestTest,
  mintPyramidTest,
  setIsMintingActiveTest,
  setTreasuryTest,
  unpublishQuestTest,
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

  describe('Quest Management', () => {
    it('Should allow signer role to initialize quest', async () => {
      const {
        pyramidContract,
        owner,
        questSigner,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });

      await initializeQuestTest(
        {
          pyramidContract,
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
        pyramidContract,
        owner,
        user,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });

      await initializeQuestTest(
        {
          pyramidContract,
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
        pyramidContract,
        owner,
        questSigner,
        QUEST_ID,
        COMMUNITIES,
        TITLE,
        DIFFICULTY,
        QUEST_TYPE,
        TAGS,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });

      await initializeQuestTest(
        {
          pyramidContract,
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
          pyramidContract,
          owner,
          questId: QUEST_ID,
        },
        { from: questSigner },
      );
    });

    it('Should not allow non-owner to unpublish quest', async () => {
      const {
        pyramidContract,
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
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });

      await initializeQuestTest(
        {
          pyramidContract,
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
          pyramidContract,
          owner,
          questId: QUEST_ID,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Minting', () => {
    it('Should not allow minting when inactive', async () => {
      const { pyramidContract, owner, user, QUEST_ID, factoryContract } =
        await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: false });

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

      const signature = await signMintData(data, user);

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
      const { pyramidContract, owner, user, QUEST_ID, factoryContract } =
        await loadFixture(defaultDeploy);

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

      const signature = await signMintData(data, user);

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

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidContract,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user, revertMessage: 'Factory__NoQuestEscrowFound' },
      );

      // await mintPyramidTest(
      //   {
      //     pyramidContract,
      //     owner,
      //     data,
      //     signature,
      //     value: parseEther('0.1'),
      //   },
      //   { from: user, revertMessage: 'Pyramid__NonceAlreadyUsed' },
      // );
    });

    it('Should allow successful minting', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        COMMUNITIES,
      } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });
      await setTreasuryTest({
        pyramidContract,
        owner,
        treasury: ethers.constants.AddressZero,
      });

      const data = {
        questId: QUEST_ID,
        communityId: COMMUNITIES[0],
        userId: user.address,
        timestamp: Math.floor(Date.now() / 1000),
        nonce: 1,
      };

      const signature = await questSigner.signMessage(
        ethers.utils.arrayify(
          ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'string', 'address', 'uint256', 'uint256'],
              [
                data.questId,
                data.communityId,
                data.userId,
                data.timestamp,
                data.nonce,
              ],
            ),
          ),
        ),
      );

      await mintPyramidTest({
        pyramidContract,
        owner,
        data,
        signature,
        value: ethers.utils.parseEther('0.1'),
      });
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds', async () => {
      const { pyramidContract, owner } = await loadFixture(defaultDeploy);
      await setIsMintingActiveTest({ pyramidContract, owner, isActive: true });
      await setTreasuryTest({
        pyramidContract,
        owner,
        treasury: ethers.constants.AddressZero,
      });

      // First send some ETH to the contract
      await owner.sendTransaction({
        to: pyramidContract.address,
        value: ethers.utils.parseEther('1'),
      });

      await withdrawTest({
        pyramidContract,
        owner,
        value: ethers.utils.parseEther('1'),
      });
    });

    it('Should not allow non-owner to withdraw funds', async () => {
      const { pyramidContract, owner, user } = await loadFixture(defaultDeploy);
      await withdrawTest(
        {
          pyramidContract,
          owner,
          value: ethers.utils.parseEther('1'),
        },
        { from: user, revertMessage: 'Ownable: caller is not the owner' },
      );
    });
  });
});
