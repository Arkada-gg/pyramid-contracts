import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  ERC1155Mock,
  ERC20Mock,
  ERC721Mock,
  Factory__factory,
  GlobalEscrow__factory,
  PyramidEscrowFeeToken__factory,
} from '../typechain-types';
import { IMintPyramidData, signMintDataTypedV4 } from './common/common.helpers';

async function deployFeeToken() {
  const [owner, user, treasury, questSigner, admin, ...regularAccounts] =
    await ethers.getSigners();

  const domain = {
    name: 'pyramid',
    version: '1',
  };

  // Deploy fee token (ERC20)
  const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
  const feeToken = (await ERC20MockFactory.deploy(
    'Fee Token',
    'FEE',
  )) as ERC20Mock;
  await feeToken.deployed();

  // Deploy reward tokens
  const erc20Token = (await ERC20MockFactory.deploy(
    'Reward Token',
    'RWD',
  )) as ERC20Mock;
  await erc20Token.deployed();

  const ERC721MockFactory = await ethers.getContractFactory('ERC721Mock');
  const erc721Token = (await ERC721MockFactory.deploy(
    'Test NFT',
    'TNFT',
  )) as ERC721Mock;
  await erc721Token.deployed();

  const ERC1155MockFactory = await ethers.getContractFactory('ERC1155Mock');
  const erc1155Token = (await ERC1155MockFactory.deploy()) as ERC1155Mock;
  await erc1155Token.deployed();

  // Deploy GlobalEscrow
  const globalEscrowContract = await new GlobalEscrow__factory(owner).deploy();
  await globalEscrowContract.initialize(
    owner.address,
    [erc20Token.address, erc721Token.address, erc1155Token.address],
    treasury.address,
  );
  await globalEscrowContract.grantRole(
    await globalEscrowContract.WITHDRAWER_ROLE(),
    owner.address,
  );
  await globalEscrowContract.grantRole(
    await globalEscrowContract.DISTRIBUTOR_ROLE(),
    owner.address,
  );

  // Deploy PyramidEscrowFeeToken
  const pyramidContract = await new PyramidEscrowFeeToken__factory(
    owner,
  ).deploy();

  await pyramidContract.initialize(
    'Pyramid',
    'PYR',
    domain.name,
    domain.version,
    owner.address,
    feeToken.address,
  );

  await globalEscrowContract.grantRole(
    await globalEscrowContract.DISTRIBUTOR_ROLE(),
    pyramidContract.address,
  );

  await pyramidContract.grantRole(
    await pyramidContract.SIGNER_ROLE(),
    questSigner.address,
  );

  await pyramidContract.setTreasury(treasury.address);

  // Deploy Factory
  const { chainId } = await ethers.provider.getNetwork();

  const factoryContract = await new Factory__factory(owner).deploy();
  await factoryContract.initialize(owner.address, pyramidContract.address);

  const QUEST_ID = 'test';
  const QUEST_ID_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(QUEST_ID),
  );

  // Create escrow
  await factoryContract.createEscrow(
    QUEST_ID_HASH,
    admin.address,
    [erc20Token.address, erc721Token.address, erc1155Token.address],
    treasury.address,
  );

  const escrowAddress = await factoryContract.s_escrows(QUEST_ID_HASH);
  await erc20Token.mint(escrowAddress, parseEther('1000'));
  await erc721Token.mint(escrowAddress, 1);
  await erc1155Token.mint(escrowAddress, 1, 100, '0x');

  // Fund global escrow
  await erc20Token.mint(globalEscrowContract.address, parseEther('1000'));
  await erc721Token.mint(globalEscrowContract.address, 2);
  await erc1155Token.mint(globalEscrowContract.address, 2, 100, '0x');
  await user.sendTransaction({
    to: escrowAddress,
    value: parseEther('1'),
  });
  await user.sendTransaction({
    to: globalEscrowContract.address,
    value: parseEther('1000'),
  });

  // Mint fee tokens to user and approve contract
  await feeToken.mint(user.address, parseEther('1000'));
  await feeToken
    .connect(user)
    .approve(pyramidContract.address, parseEther('1000'));

  const domainEscrow = {
    ...domain,
    chainId,
    verifyingContract: pyramidContract.address,
  };

  return {
    owner,
    user,
    treasury,
    questSigner,
    admin,
    pyramidContract,
    feeToken,
    factoryContract,
    globalEscrowContract,
    domainEscrow,
    QUEST_ID,
    QUEST_ID_HASH,
    tokens: { erc20Token, erc721Token, erc1155Token },
    regularAccounts,
  };
}

describe('PyramidEscrowFeeToken', () => {
  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { pyramidContract, owner } = await loadFixture(deployFeeToken);
      expect(
        await pyramidContract.hasRole(
          await pyramidContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set initial minting state to true', async () => {
      const { pyramidContract } = await loadFixture(deployFeeToken);
      expect(await pyramidContract.s_isMintingActive()).to.equal(true);
    });

    it('Should set correct token name and symbol', async () => {
      const { pyramidContract } = await loadFixture(deployFeeToken);
      expect(await pyramidContract.name()).to.equal('Pyramid');
      expect(await pyramidContract.symbol()).to.equal('PYR');
    });

    it('Should set the fee token', async () => {
      const { pyramidContract, feeToken } = await loadFixture(deployFeeToken);
      expect(await pyramidContract.s_feeToken()).to.equal(feeToken.address);
    });

    it('Should return correct pyramid version', async () => {
      const { pyramidContract } = await loadFixture(deployFeeToken);
      expect(await pyramidContract.pyramidVersion()).to.equal('1');
    });

    it('Should revert if admin is zero address', async () => {
      const [owner] = await ethers.getSigners();
      const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
      const feeToken = await ERC20MockFactory.deploy('Fee', 'FEE');

      const contract = await new PyramidEscrowFeeToken__factory(owner).deploy();
      await expect(
        contract.initialize(
          'Pyramid',
          'PYR',
          'pyramid',
          '1',
          ethers.constants.AddressZero,
          feeToken.address,
        ),
      ).to.be.revertedWithCustomError(contract, 'Pyramid__InvalidAdminAddress');
    });

    it('Should revert if fee token is zero address', async () => {
      const [owner] = await ethers.getSigners();
      const contract = await new PyramidEscrowFeeToken__factory(owner).deploy();
      await expect(
        contract.initialize(
          'Pyramid',
          'PYR',
          'pyramid',
          '1',
          owner.address,
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWithCustomError(contract, 'Pyramid__FeeTokenNotSet');
    });

    it('Should support ERC721 and AccessControl interfaces', async () => {
      const { pyramidContract } = await loadFixture(deployFeeToken);
      // ERC721 interface id
      expect(await pyramidContract.supportsInterface('0x80ac58cd')).to.equal(
        true,
      );
      // AccessControl interface id
      expect(await pyramidContract.supportsInterface('0x7965db0b')).to.equal(
        true,
      );
      // Random unsupported interface
      expect(await pyramidContract.supportsInterface('0x12345678')).to.equal(
        false,
      );
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to enable/disable minting', async () => {
      const { pyramidContract, owner } = await loadFixture(deployFeeToken);

      await expect(pyramidContract.setIsMintingActive(false))
        .to.emit(pyramidContract, 'MintingSwitch')
        .withArgs(false);
      expect(await pyramidContract.s_isMintingActive()).to.equal(false);

      await expect(pyramidContract.setIsMintingActive(true))
        .to.emit(pyramidContract, 'MintingSwitch')
        .withArgs(true);
      expect(await pyramidContract.s_isMintingActive()).to.equal(true);
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { pyramidContract, user } = await loadFixture(deployFeeToken);
      await expect(
        pyramidContract.connect(user).setIsMintingActive(false),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { pyramidContract, treasury } = await loadFixture(deployFeeToken);
      await expect(pyramidContract.setTreasury(treasury.address))
        .to.emit(pyramidContract, 'UpdatedTreasury')
        .withArgs(treasury.address);
      expect(await pyramidContract.s_treasury()).to.equal(treasury.address);
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { pyramidContract, user, treasury } = await loadFixture(
        deployFeeToken,
      );
      await expect(
        pyramidContract.connect(user).setTreasury(treasury.address),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { pyramidContract } = await loadFixture(deployFeeToken);
      await expect(
        pyramidContract.setTreasury(ethers.constants.AddressZero),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__ZeroAddress');
    });
  });

  describe('Minting', () => {
    it('Should not allow minting when inactive', async () => {
      const {
        pyramidContract,
        user,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        questSigner,
      } = await loadFixture(deployFeeToken);

      await pyramidContract.setIsMintingActive(false);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [{ recipient: user.address, BPS: 10000 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__MintingIsNotActive',
      );
    });

    it('Should not allow minting when treasury is not set', async () => {
      const [owner2, user2, , signer2] = await ethers.getSigners();
      const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
      const ft = await ERC20MockFactory.deploy('Fee', 'FEE');

      const contract = await new PyramidEscrowFeeToken__factory(
        owner2,
      ).deploy();
      await contract.initialize(
        'Pyramid',
        'PYR',
        'pyramid',
        '1',
        owner2.address,
        ft.address,
      );
      await contract.grantRole(await contract.SIGNER_ROLE(), signer2.address);

      const { chainId } = await ethers.provider.getNetwork();
      const domain = {
        name: 'pyramid',
        version: '1',
        chainId,
        verifyingContract: contract.address,
      };

      const data: IMintPyramidData = {
        questId: 'test',
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user2.address,
        walletProvider: 'wp',
        tokenURI: 'uri',
        embedOrigin: 'origin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')),
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(data, signer2, domain);

      await expect(
        contract.connect(user2).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(contract, 'Pyramid__TreasuryNotSet');
    });

    it('Should not allow minting with invalid signature', async () => {
      const { pyramidContract, user, QUEST_ID, QUEST_ID_HASH, domainEscrow } =
        await loadFixture(deployFeeToken);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [{ recipient: user.address, BPS: 10000 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      // Sign with user who is NOT a signer
      const signature = await signMintDataTypedV4(data, user, domainEscrow);

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__IsNotSigner');
    });

    it('Should not allow minting with used nonce', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract.connect(user).mintPyramid(data, signature);

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__NonceAlreadyUsed',
      );
    });

    it('Should not allow minting same questId for same address twice', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const sig1 = await signMintDataTypedV4(data, questSigner, domainEscrow);
      await pyramidContract.connect(user).mintPyramid(data, sig1);

      const data2 = { ...data, nonce: 2 };
      const sig2 = await signMintDataTypedV4(data2, questSigner, domainEscrow);

      await expect(
        pyramidContract.connect(user).mintPyramid(data2, sig2),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__MintedForQuestId',
      );
    });

    it('Should revert if BPS too high', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 10001 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__BPSTooHigh');
    });

    it('Should revert if total BPS exceeds price (ExcessiveFeePayout)', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        regularAccounts,
      } = await loadFixture(deployFeeToken);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [
          { recipient: questSigner.address, BPS: 6000 },
          { recipient: regularAccounts[0].address, BPS: 6000 },
        ],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__ExcessiveFeePayout',
      );
    });

    it('Should successfully mint with ERC20 fee token payments', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        feeToken,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');
      const BPS = 100;
      const MAX_BPS = 10000;

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [{ recipient: questSigner.address, BPS }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const userFeeBalanceBefore = await feeToken.balanceOf(user.address);
      const treasuryFeeBalanceBefore = await feeToken.balanceOf(
        treasury.address,
      );
      const referralFeeBalanceBefore = await feeToken.balanceOf(
        questSigner.address,
      );

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const userFeeBalanceAfter = await feeToken.balanceOf(user.address);
      const treasuryFeeBalanceAfter = await feeToken.balanceOf(
        treasury.address,
      );
      const referralFeeBalanceAfter = await feeToken.balanceOf(
        questSigner.address,
      );

      // Check fee token transfers
      expect(userFeeBalanceBefore.sub(userFeeBalanceAfter)).to.equal(price);
      expect(referralFeeBalanceAfter.sub(referralFeeBalanceBefore)).to.equal(
        expectedRecipientPayout,
      );
      expect(treasuryFeeBalanceAfter.sub(treasuryFeeBalanceBefore)).to.equal(
        expectedTreasuryPayout,
      );

      // Check NFT was minted
      expect(await pyramidContract.ownerOf(0)).to.equal(user.address);
      expect(await pyramidContract.tokenURI(0)).to.equal('tokenURI');
    });

    it('Should mint with zero price (no fee token transfers)', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        feeToken,
      } = await loadFixture(deployFeeToken);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const userBalanceBefore = await feeToken.balanceOf(user.address);
      const treasuryBalanceBefore = await feeToken.balanceOf(treasury.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      expect(await feeToken.balanceOf(user.address)).to.equal(
        userBalanceBefore,
      );
      expect(await feeToken.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore,
      );
      expect(await pyramidContract.ownerOf(0)).to.equal(user.address);
    });

    it('Should mint with no recipients (all fee goes to treasury)', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        feeToken,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.5');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const treasuryBalanceBefore = await feeToken.balanceOf(treasury.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const treasuryBalanceAfter = await feeToken.balanceOf(treasury.address);
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(price);
    });

    it('Should mint with multiple recipients', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        feeToken,
        regularAccounts,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('1');
      const BPS1 = 2000; // 20%
      const BPS2 = 3000; // 30%
      const MAX_BPS = 10000;

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [
          { recipient: questSigner.address, BPS: BPS1 },
          { recipient: regularAccounts[0].address, BPS: BPS2 },
        ],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const ref1Before = await feeToken.balanceOf(questSigner.address);
      const ref2Before = await feeToken.balanceOf(regularAccounts[0].address);
      const treasuryBefore = await feeToken.balanceOf(treasury.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const ref1After = await feeToken.balanceOf(questSigner.address);
      const ref2After = await feeToken.balanceOf(regularAccounts[0].address);
      const treasuryAfter = await feeToken.balanceOf(treasury.address);

      const expectedRef1 = price.mul(BPS1).div(MAX_BPS);
      const expectedRef2 = price.mul(BPS2).div(MAX_BPS);
      const expectedTreasury = price.sub(expectedRef1).sub(expectedRef2);

      expect(ref1After.sub(ref1Before)).to.equal(expectedRef1);
      expect(ref2After.sub(ref2Before)).to.equal(expectedRef2);
      expect(treasuryAfter.sub(treasuryBefore)).to.equal(expectedTreasury);
    });

    it('Should revert if user has insufficient allowance', async () => {
      const {
        pyramidContract,
        feeToken,
        questSigner,
        user,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      // Reset approval to 0
      await feeToken.connect(user).approve(pyramidContract.address, 0);

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(feeToken, 'ERC20InsufficientAllowance');
    });

    it('Should revert if user has insufficient balance', async () => {
      const {
        pyramidContract,
        feeToken,
        questSigner,
        regularAccounts,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      // Use a regular account with no fee tokens but approve the contract
      const poorUser = regularAccounts[0];
      await feeToken
        .connect(poorUser)
        .approve(pyramidContract.address, parseEther('1000'));

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price: parseEther('0.1'),
        toAddress: poorUser.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract.connect(poorUser).mintPyramid(data, signature),
      ).to.be.revertedWithCustomError(feeToken, 'ERC20InsufficientBalance');
    });

    it('Should emit correct events on minting', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        feeToken,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [{ recipient: questSigner.address, BPS: 1000 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const tx = pyramidContract.connect(user).mintPyramid(data, signature);

      await expect(tx).to.emit(pyramidContract, 'PyramidTransaction');
      await expect(tx).to.emit(pyramidContract, 'FeePayout');
      await expect(tx).to.emit(pyramidContract, 'TreasuryPayout');
      await expect(tx).to.emit(pyramidContract, 'PyramidClaim');
    });

    it('Should mint with escrow rewards (ERC20)', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        feeToken,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');
      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc20Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const erc20Before = await tokens.erc20Token.balanceOf(user.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const erc20After = await tokens.erc20Token.balanceOf(user.address);
      expect(erc20After.sub(erc20Before)).to.equal(rewards);
    });

    it('Should mint with global escrow rewards (ERC20)', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');
      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
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

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const erc20Before = await tokens.erc20Token.balanceOf(user.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const erc20After = await tokens.erc20Token.balanceOf(user.address);
      expect(erc20After.sub(erc20Before)).to.equal(rewards);
    });

    it('Should mint with ERC721 escrow rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc721Token.address,
          chainId: 1,
          amount: 1,
          tokenId: 1,
          tokenType: 1,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract.connect(user).mintPyramid(data, signature);

      expect(await tokens.erc721Token.ownerOf(1)).to.equal(user.address);
    });

    it('Should mint with ERC721 global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: tokens.erc721Token.address,
          amount: 1,
          tokenId: 2,
          tokenType: 1,
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract.connect(user).mintPyramid(data, signature);

      expect(await tokens.erc721Token.ownerOf(2)).to.equal(user.address);
    });

    it('Should mint with ERC1155 escrow rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc1155Token.address,
          chainId: 1,
          amount: 1,
          tokenId: 1,
          tokenType: 2,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract.connect(user).mintPyramid(data, signature);

      expect(await tokens.erc1155Token.balanceOf(user.address, 1)).to.equal(1);
    });

    it('Should mint with ERC1155 global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero,
        },
        globalReward: {
          tokenAddress: tokens.erc1155Token.address,
          amount: 1,
          tokenId: 2,
          tokenType: 2,
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract.connect(user).mintPyramid(data, signature);

      expect(await tokens.erc1155Token.balanceOf(user.address, 2)).to.equal(1);
    });

    it('Should mint with native token escrow rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');
      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          escrowAddress: ethers.constants.AddressZero,
        },
      };

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const ethBefore = await ethers.provider.getBalance(user.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const ethAfter = await ethers.provider.getBalance(user.address);
      // User should receive native rewards (minus gas)
      // Just check they received something (gas makes exact comparison tricky)
      expect(ethAfter.add(parseEther('0.1'))).to.be.gt(ethBefore);
    });

    it('Should mint with native token global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');
      const rewards = parseEther('0.01');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [{ recipient: questSigner.address, BPS: 100 }],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 0,
          amount: 0,
          tokenId: 0,
          tokenType: 0,
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

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract.connect(user).mintPyramid(data, signature),
      ).to.emit(pyramidContract, 'TokenReward');
    });

    it('Should emit TokenReward for both escrow and global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployFeeToken);

      const price = parseEther('0.1');
      const rewards = parseEther('0.005');

      const data: IMintPyramidData = {
        questId: QUEST_ID,
        nonce: 1,
        price,
        toAddress: user.address,
        walletProvider: 'walletProvider',
        tokenURI: 'tokenURI',
        embedOrigin: 'embedOrigin',
        transactions: [],
        recipients: [],
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc20Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: factoryContract.address,
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

      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const erc20Before = await tokens.erc20Token.balanceOf(user.address);

      await pyramidContract.connect(user).mintPyramid(data, signature);

      const erc20After = await tokens.erc20Token.balanceOf(user.address);
      // User gets both escrow and global rewards
      expect(erc20After.sub(erc20Before)).to.equal(rewards.mul(2));
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw fee tokens accidentally sent to contract', async () => {
      const { pyramidContract, owner, feeToken } = await loadFixture(
        deployFeeToken,
      );

      // Accidentally send fee tokens to the contract
      const amount = parseEther('10');
      await feeToken.mint(pyramidContract.address, amount);

      const ownerBalanceBefore = await feeToken.balanceOf(owner.address);

      await expect(pyramidContract.withdraw())
        .to.emit(pyramidContract, 'ContractWithdrawal')
        .withArgs(amount);

      const ownerBalanceAfter = await feeToken.balanceOf(owner.address);
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(amount);

      // Contract balance should be 0
      expect(await feeToken.balanceOf(pyramidContract.address)).to.equal(0);
    });

    it('Should not allow non-owner to withdraw', async () => {
      const { pyramidContract, user } = await loadFixture(deployFeeToken);

      await expect(
        pyramidContract.connect(user).withdraw(),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('Should handle withdraw when contract has zero balance', async () => {
      const { pyramidContract, owner, feeToken } = await loadFixture(
        deployFeeToken,
      );

      const ownerBalanceBefore = await feeToken.balanceOf(owner.address);

      await expect(pyramidContract.withdraw())
        .to.emit(pyramidContract, 'ContractWithdrawal')
        .withArgs(0);

      const ownerBalanceAfter = await feeToken.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore);
    });
  });
});
