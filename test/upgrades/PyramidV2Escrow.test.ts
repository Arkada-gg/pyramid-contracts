import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';
import {
  ArkadaRewarder,
  ERC1155Mock,
  ERC20Mock,
  ERC721Mock,
  Factory__factory,
  Pyramid,
  PyramidV2Escrow,
} from '../../typechain-types';
import {
  IMintPyramidEscrowData,
  signMintDataTyped,
} from '../common/common.helpers';
import { createEscrowTest } from '../common/factory.helpers';
import {
  mintPyramidTest,
  setIsMintingActiveTest,
  setTreasuryTest,
  withdrawTest,
} from '../common/pyramid-escrow.helpers';
import { setArkadaRewarderTest } from '../common/pyramid.helpers';

const upgradeFixture = async () => {
  const [owner, user, treasury, questSigner, admin] = await ethers.getSigners();

  // Deploy ArkadaRewarder contract as upgradeable proxy
  const ArkadaRewarderFactory = await ethers.getContractFactory(
    'ArkadaRewarder',
  );
  const arkadaRewarderContract = (await upgrades.deployProxy(
    ArkadaRewarderFactory,
    [owner.address],
    {
      unsafeAllow: ['constructor'],
    },
  )) as ArkadaRewarder;
  await arkadaRewarderContract.deployed();

  const domain = {
    name: 'pyramid',
    version: '1',
  };

  // Deploy Pyramid contract as upgradeable proxy
  const PyramidFactory = await ethers.getContractFactory('Pyramid');
  const pyramidContract = (await upgrades.deployProxy(
    PyramidFactory,
    [
      'Pyramid',
      'PYR',
      domain.name,
      domain.version,
      owner.address,
      arkadaRewarderContract.address,
    ],
    {
      unsafeAllow: ['constructor'],
    },
  )) as Pyramid;
  await pyramidContract.deployed();

  // Setup initial state
  await pyramidContract.grantRole(
    await pyramidContract.SIGNER_ROLE(),
    questSigner.address,
  );
  await pyramidContract.setTreasury(treasury.address);
  await arkadaRewarderContract.grantRole(
    await arkadaRewarderContract.OPERATOR_ROLE(),
    pyramidContract.address,
  );

  // Get the current version before upgrade
  const versionBefore = await pyramidContract.pyramidVersion();
  expect(versionBefore).to.equal('1');

  // Deploy the new implementation and upgrade
  const PyramidV2EscrowFactory = await ethers.getContractFactory(
    'PyramidV2Escrow',
  );
  const pyramidV2Escrow = (await upgrades.upgradeProxy(
    pyramidContract.address,
    PyramidV2EscrowFactory,
  )) as PyramidV2Escrow;

  // Verify the upgrade was successful by checking the new version
  const versionAfter = await pyramidV2Escrow.pyramidVersion();
  expect(versionAfter).to.equal('2');

  // Verify that the contract still has the same address
  expect(pyramidV2Escrow.address).to.equal(pyramidContract.address);

  // Verify that the contract still has the same state
  const isMintingActive = await pyramidV2Escrow.s_isMintingActive();
  expect(isMintingActive).to.equal(true);

  const arkadaRewarder = await pyramidV2Escrow.s_arkadaRewarder();
  expect(arkadaRewarder).to.not.equal(ethers.constants.AddressZero);

  const factoryContract = await new Factory__factory(owner).deploy();
  await expect(
    factoryContract.initialize(
      ethers.constants.AddressZero,
      pyramidV2Escrow.address,
    ),
  ).to.be.revertedWithCustomError(factoryContract, 'Factory__ZeroAddress');
  await factoryContract.initialize(owner.address, pyramidV2Escrow.address);

  // Deploy mock tokens
  const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
  const erc20Token = (await ERC20Mock.deploy(
    'Test Token',
    'TEST',
  )) as ERC20Mock;
  await erc20Token.deployed();

  const ERC721Mock = await ethers.getContractFactory('ERC721Mock');
  const erc721Token = (await ERC721Mock.deploy(
    'Test NFT',
    'TNFT',
  )) as ERC721Mock;
  await erc721Token.deployed();

  const ERC1155Mock = await ethers.getContractFactory('ERC1155Mock');
  const erc1155Token = (await ERC1155Mock.deploy()) as ERC1155Mock;
  await erc1155Token.deployed();

  const { chainId } = await ethers.provider.getNetwork();
  const QUEST_ID = 'test';
  const QUEST_ID_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(QUEST_ID),
  );
  const COMMUNITIES = ['community1', 'community2'];
  const TITLE = 'Test Quest';
  const DIFFICULTY = 1;
  const QUEST_TYPE = 1;
  const TAGS = ['tag1', 'tag2'];

  await createEscrowTest({
    factoryContract,
    owner,
    questId: QUEST_ID_HASH,
    admin: admin.address,
    whitelistedTokens: [
      erc20Token.address,
      erc721Token.address,
      erc1155Token.address,
    ],
    treasury: treasury.address,
  });

  const escrowAddress = await factoryContract.s_escrows(QUEST_ID_HASH);
  // Setup initial balances
  await erc20Token.mint(escrowAddress, ethers.utils.parseEther('1000'));
  await erc721Token.mint(escrowAddress, 1);
  await erc1155Token.mint(escrowAddress, 1, 100, '0x');

  // Send native tokens
  await user.sendTransaction({
    to: escrowAddress,
    value: ethers.utils.parseEther('1'),
  });

  return {
    pyramidV2Escrow,
    pyramidContract,
    arkadaRewarderContract,
    owner,
    user,
    treasury,
    questSigner,
    admin,
    factoryContract,
    erc20Token,
    erc721Token,
    erc1155Token,
    QUEST_ID,
    QUEST_ID_HASH,
    COMMUNITIES,
    TITLE,
    DIFFICULTY,
    QUEST_TYPE,
    TAGS,
    domain: {
      ...domain,
      chainId,
      verifyingContract: pyramidV2Escrow.address,
    },
  };
};

describe.only('PyramidV2Escrow', () => {
  describe('Upgrade', () => {
    it('should upgrade successfully and maintain state', async () => {
      await loadFixture(upgradeFixture);
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to set minting state', async () => {
      const { pyramidV2Escrow, owner } = await loadFixture(upgradeFixture);
      await setIsMintingActiveTest({
        pyramidEscrowContract: pyramidV2Escrow,
        owner,
        isActive: true,
      });
      await setIsMintingActiveTest({
        pyramidEscrowContract: pyramidV2Escrow,
        owner,
        isActive: false,
      });
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { pyramidV2Escrow, owner, user } = await loadFixture(
        upgradeFixture,
      );
      await setIsMintingActiveTest(
        { pyramidEscrowContract: pyramidV2Escrow, owner, isActive: true },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { pyramidV2Escrow, owner, treasury } = await loadFixture(
        upgradeFixture,
      );
      await setTreasuryTest({
        pyramidEscrowContract: pyramidV2Escrow,
        owner,
        treasury: treasury.address,
      });
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { pyramidV2Escrow, owner, user, treasury } = await loadFixture(
        upgradeFixture,
      );
      await setTreasuryTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
          owner,
          treasury: treasury.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { pyramidV2Escrow, owner } = await loadFixture(upgradeFixture);
      await setTreasuryTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
          owner,
          treasury: ethers.constants.AddressZero,
        },
        { revertMessage: 'Pyramid__ZeroAddress' },
      );
    });
  });

  describe('Arkada Rewarder Management', () => {
    it('Should allow owner to set Arkada rewarder', async () => {
      const { pyramidV2Escrow, owner, arkadaRewarderContract } =
        await loadFixture(upgradeFixture);
      await setArkadaRewarderTest({
        pyramidContract: pyramidV2Escrow,
        owner,
        arkadaRewarder: arkadaRewarderContract.address,
      });
    });

    it('Should not allow non-owner to set Arkada rewarder', async () => {
      const { pyramidV2Escrow, owner, user, arkadaRewarderContract } =
        await loadFixture(upgradeFixture);
      await setArkadaRewarderTest(
        {
          pyramidContract: pyramidV2Escrow,
          owner,
          arkadaRewarder: arkadaRewarderContract.address,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });

  describe('Minting', () => {
    it('Should not allow minting when inactive', async () => {
      const {
        pyramidV2Escrow,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(upgradeFixture);
      await setIsMintingActiveTest({
        pyramidEscrowContract: pyramidV2Escrow,
        owner,
        isActive: false,
      });

      const data: IMintPyramidEscrowData = {
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
          pyramidEscrowContract: pyramidV2Escrow,
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
        pyramidV2Escrow,
        owner,
        user,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(upgradeFixture);

      const data: IMintPyramidEscrowData = {
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
          pyramidEscrowContract: pyramidV2Escrow,
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
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(upgradeFixture);

      const data: IMintPyramidEscrowData = {
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
          pyramidEscrowContract: pyramidV2Escrow,
          owner,
          data,
          signature,
          value: parseEther('0.1'),
        },
        { from: user },
      );

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
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
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
        treasury,
        arkadaRewarderContract,
      } = await loadFixture(upgradeFixture);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0.01');

      const data: IMintPyramidEscrowData = {
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

      const signature = await signMintDataTyped(data, questSigner, domain);

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
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

      expect(
        await arkadaRewarderContract.userRewards(questSigner.address),
      ).to.equal(expectedRecipientPayout);

      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(
        userBalanceBefore.sub(price).add(rewards),
      );
    });

    it('Should allow successful minting without any rewards', async () => {
      const {
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
        treasury,
        arkadaRewarderContract,
      } = await loadFixture(upgradeFixture);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0');

      const data: IMintPyramidEscrowData = {
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
      };

      const signature = await signMintDataTyped(data, questSigner, domain);

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
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

      expect(
        await arkadaRewarderContract.userRewards(questSigner.address),
      ).to.equal(expectedRecipientPayout);

      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(
        userBalanceBefore.sub(price).add(rewards),
      );
    });

    it('Should allow successful minting with erc20 token rewards', async () => {
      const {
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
        treasury,
        erc20Token,
        arkadaRewarderContract,
      } = await loadFixture(upgradeFixture);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = parseEther('0.01');

      const data: IMintPyramidEscrowData = {
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
          tokenAddress: erc20Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
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

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      const erc20BalanceBefore = await erc20Token.balanceOf(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
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
      const erc20BalanceAfter = await erc20Token.balanceOf(user.address);
      expect(
        await arkadaRewarderContract.userRewards(questSigner.address),
      ).to.equal(expectedRecipientPayout);
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(erc20BalanceAfter).to.equal(erc20BalanceBefore.add(rewards));
    });

    it('Should allow successful minting with erc721 token rewards', async () => {
      const {
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
        treasury,
        erc721Token,
        arkadaRewarderContract,
      } = await loadFixture(upgradeFixture);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = 1;

      const data: IMintPyramidEscrowData = {
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
          tokenAddress: erc721Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 1,
          tokenType: 1,
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

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
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

      expect(
        await arkadaRewarderContract.userRewards(questSigner.address),
      ).to.equal(expectedRecipientPayout);
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await erc721Token.ownerOf(1)).eq(user.address);
    });

    it('Should allow successful minting with erc1155 token rewards', async () => {
      const {
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
        arkadaRewarderContract,
        treasury,
        erc1155Token,
      } = await loadFixture(upgradeFixture);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const rewards = 1;

      const data: IMintPyramidEscrowData = {
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
          tokenAddress: erc1155Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 1,
          tokenType: 2,
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

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
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

      expect(
        await arkadaRewarderContract.userRewards(questSigner.address),
      ).to.equal(expectedRecipientPayout);
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(expectedTreasuryPayout),
      );
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(price));
      expect(await erc1155Token.balanceOf(user.address, 1)).eq(rewards);
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds', async () => {
      const {
        pyramidV2Escrow,
        owner,
        user,
        questSigner,
        QUEST_ID,
        factoryContract,
        domain,
      } = await loadFixture(upgradeFixture);

      const price = parseEther('0.1');
      const BPS = 100;

      const rewards = parseEther('0.01');

      const data: IMintPyramidEscrowData = {
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

      const signature = await signMintDataTyped(data, questSigner, domain);

      await mintPyramidTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
          owner,
          data,
          signature,
          value: parseEther('0.4'),
        },
        { from: user },
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      await withdrawTest({
        pyramidEscrowContract: pyramidV2Escrow,
        owner,
      });

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.equal(balanceBefore.add(parseEther('0.3')));
    });

    it('Should not allow non-owner to withdraw funds', async () => {
      const { pyramidV2Escrow, owner, user } = await loadFixture(
        upgradeFixture,
      );
      await withdrawTest(
        {
          pyramidEscrowContract: pyramidV2Escrow,
          owner,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });
  });
});
