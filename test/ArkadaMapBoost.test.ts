import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { arkadaMapBoostDeploy } from './common/arkada-map-boost.fixtures';
import {
  activateTest,
  mintTest,
  safeTransferFromTest,
  setBaseURITest,
  setMintPriceTest,
  setMintingActiveTest,
  setTreasuryTest,
  transferFromTest,
} from './common/arkada-map-boost.helpers';

describe('ArkadaMapBoost', () => {
  it('deployment', async () => {
    await loadFixture(arkadaMapBoostDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right owner', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      expect(await arkadaMapBoostContract.owner()).to.equal(owner.address);
    });

    it('Should set initial minting state to true', async () => {
      const { arkadaMapBoostContract } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      expect(await arkadaMapBoostContract.s_isMintingActive()).to.equal(true);
    });

    it('Should set correct token name and symbol', async () => {
      const { arkadaMapBoostContract, NAME, SYMBOL } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      expect(await arkadaMapBoostContract.name()).to.equal(NAME);
      expect(await arkadaMapBoostContract.symbol()).to.equal(SYMBOL);
    });

    it('Should set correct mint price', async () => {
      const { arkadaMapBoostContract, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      expect(await arkadaMapBoostContract.mintPrice()).to.equal(MINT_PRICE);
    });

    it('Should set correct treasury', async () => {
      const { arkadaMapBoostContract, treasury } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      expect(await arkadaMapBoostContract.treasury()).to.equal(
        treasury.address,
      );
    });

    it('Should set correct base URI', async () => {
      const { arkadaMapBoostContract, BASE_URI } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      expect(await arkadaMapBoostContract.tokenURI(0)).to.equal(BASE_URI);
      expect(await arkadaMapBoostContract.tokenURI(999)).to.equal(BASE_URI);
    });

    it('Should not allow initialization with zero treasury', async () => {
      const { owner, MINT_PRICE, NAME, SYMBOL, BASE_URI } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      const ArkadaMapBoostFactory = await ethers.getContractFactory(
        'ArkadaMapBoost',
      );
      const newContract = await ArkadaMapBoostFactory.deploy();

      await expect(
        newContract.initialize(
          NAME,
          SYMBOL,
          BASE_URI,
          owner.address,
          ethers.constants.AddressZero,
          MINT_PRICE,
        ),
      ).to.be.revertedWithCustomError(
        newContract,
        'ArkadaMapBoost__InvalidAddress',
      );
    });

    it('Should not allow initialization with zero mint price', async () => {
      const { owner, treasury, NAME, SYMBOL, BASE_URI } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      const ArkadaMapBoostFactory = await ethers.getContractFactory(
        'ArkadaMapBoost',
      );
      const newContract = await ArkadaMapBoostFactory.deploy();

      await expect(
        newContract.initialize(
          NAME,
          SYMBOL,
          BASE_URI,
          owner.address,
          treasury.address,
          0,
        ),
      ).to.be.revertedWithCustomError(
        newContract,
        'ArkadaMapBoost__InvalidAmount',
      );
    });

    it('Should not allow double initialization', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        treasury,
        MINT_PRICE,
        NAME,
        SYMBOL,
        BASE_URI,
      } = await loadFixture(arkadaMapBoostDeploy);

      await expect(
        arkadaMapBoostContract.initialize(
          NAME,
          SYMBOL,
          BASE_URI,
          owner.address,
          treasury.address,
          MINT_PRICE,
        ),
      ).to.be.revertedWithCustomError(
        arkadaMapBoostContract,
        'InvalidInitialization',
      );
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to set minting state', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await setMintingActiveTest({
        arkadaMapBoostContract,
        owner,
        isActive: false,
      });
      await setMintingActiveTest({
        arkadaMapBoostContract,
        owner,
        isActive: true,
      });
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { arkadaMapBoostContract, owner, user } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await setMintingActiveTest(
        { arkadaMapBoostContract, owner, isActive: false },
        { from: user, revertMessage: 'OwnableUnauthorizedAccount' },
      );
    });
  });

  describe('Mint Price Management', () => {
    it('Should allow owner to set mint price', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      const newPrice = parseEther('0.2');
      await setMintPriceTest({
        arkadaMapBoostContract,
        owner,
        mintPrice: newPrice,
      });
    });

    it('Should not allow non-owner to set mint price', async () => {
      const { arkadaMapBoostContract, owner, user } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await setMintPriceTest(
        { arkadaMapBoostContract, owner, mintPrice: parseEther('0.2') },
        { from: user, revertMessage: 'OwnableUnauthorizedAccount' },
      );
    });

    it('Should not allow setting mint price to zero', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await setMintPriceTest(
        { arkadaMapBoostContract, owner, mintPrice: 0 },
        { revertMessage: 'ArkadaMapBoost__InvalidAmount' },
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { arkadaMapBoostContract, owner, regularAccounts } =
        await loadFixture(arkadaMapBoostDeploy);
      await setTreasuryTest({
        arkadaMapBoostContract,
        owner,
        treasury: regularAccounts[0].address,
      });
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { arkadaMapBoostContract, owner, user, regularAccounts } =
        await loadFixture(arkadaMapBoostDeploy);
      await setTreasuryTest(
        {
          arkadaMapBoostContract,
          owner,
          treasury: regularAccounts[0].address,
        },
        { from: user, revertMessage: 'OwnableUnauthorizedAccount' },
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await setTreasuryTest(
        {
          arkadaMapBoostContract,
          owner,
          treasury: ethers.constants.AddressZero,
        },
        { revertMessage: 'ArkadaMapBoost__InvalidAddress' },
      );
    });
  });

  describe('Base URI Management', () => {
    it('Should allow owner to set base URI', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      const newURI = 'https://new-api.arkada.com/mapboost/';
      await setBaseURITest({
        arkadaMapBoostContract,
        owner,
        baseURI: newURI,
      });
      expect(await arkadaMapBoostContract.tokenURI(0)).to.equal(newURI);
      expect(await arkadaMapBoostContract.tokenURI(999)).to.equal(newURI);
    });

    it('Should not allow non-owner to set base URI', async () => {
      const { arkadaMapBoostContract, owner, user } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await setBaseURITest(
        {
          arkadaMapBoostContract,
          owner,
          baseURI: 'https://new-api.arkada.com/mapboost/',
        },
        { from: user, revertMessage: 'OwnableUnauthorizedAccount' },
      );
    });
  });

  describe('Minting', () => {
    it('Should allow successful minting', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });
    });

    it('Should not allow minting when inactive', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);
      await setMintingActiveTest({
        arkadaMapBoostContract,
        owner,
        isActive: false,
      });

      await mintTest(
        { arkadaMapBoostContract, owner, value: MINT_PRICE },
        { from: user, revertMessage: 'ArkadaMapBoost__MintingNotActive' },
      );
    });

    it('Should not allow minting with invalid payment (too low)', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await mintTest(
        { arkadaMapBoostContract, owner, value: MINT_PRICE.sub(1) },
        { revertMessage: 'ArkadaMapBoost__InvalidPayment' },
      );
    });

    it('Should not allow minting with invalid payment (too high)', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );
      await mintTest(
        { arkadaMapBoostContract, owner, value: MINT_PRICE.add(1) },
        { revertMessage: 'ArkadaMapBoost__InvalidPayment' },
      );
    });

    it('Should transfer payment to treasury', async () => {
      const { arkadaMapBoostContract, owner, treasury, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      const treasuryBalanceAfter = await ethers.provider.getBalance(
        treasury.address,
      );
      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(MINT_PRICE),
      );
    });

    it('Should increment token ID correctly', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      // Initially no tokens
      await expect(
        arkadaMapBoostContract.ownerOf(0),
      ).to.be.revertedWithCustomError(
        arkadaMapBoostContract,
        'ERC721NonexistentToken',
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });
      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(owner.address);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });
      expect(await arkadaMapBoostContract.ownerOf(1)).to.equal(owner.address);
      expect(await arkadaMapBoostContract.balanceOf(owner.address)).to.equal(2);
    });

    it('Should mint multiple tokens to different addresses', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await mintTest(
        {
          arkadaMapBoostContract,
          owner,
          value: MINT_PRICE,
        },
        { from: user },
      );

      expect(await arkadaMapBoostContract.balanceOf(owner.address)).to.equal(1);
      expect(await arkadaMapBoostContract.balanceOf(user.address)).to.equal(1);
      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(owner.address);
      expect(await arkadaMapBoostContract.ownerOf(1)).to.equal(user.address);
    });

    it('Should allow minting via receive function', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      const balanceBefore = await arkadaMapBoostContract.balanceOf(
        owner.address,
      );

      // Find the next token ID
      let nextTokenId = 0;
      while (true) {
        try {
          await arkadaMapBoostContract.ownerOf(nextTokenId);
          nextTokenId++;
        } catch {
          break;
        }
      }

      await expect(
        owner.sendTransaction({
          to: arkadaMapBoostContract.address,
          value: MINT_PRICE,
        }),
      )
        .to.emit(arkadaMapBoostContract, 'Minted')
        .withArgs(owner.address, nextTokenId);

      expect(await arkadaMapBoostContract.ownerOf(nextTokenId)).to.equal(
        owner.address,
      );
      expect(await arkadaMapBoostContract.balanceOf(owner.address)).to.equal(
        balanceBefore.add(1),
      );
    });
  });

  describe('Activation', () => {
    it('Should allow owner to activate their token', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });
    });

    it('Should not allow non-owner to activate token', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest(
        { arkadaMapBoostContract, owner, tokenId: 0 },
        { from: user, revertMessage: 'ArkadaMapBoost__NotOwner' },
      );
    });

    it('Should not allow activating already activated token', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });

      await activateTest(
        { arkadaMapBoostContract, owner, tokenId: 0 },
        { revertMessage: 'ArkadaMapBoost__AlreadyActivated' },
      );
    });

    it('Should not allow activating non-existent token', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      await activateTest(
        { arkadaMapBoostContract, owner, tokenId: 999 },
        { revertMessage: 'ERC721NonexistentToken' },
      );
    });

    it('Should emit BoostActivated event', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await expect(arkadaMapBoostContract.connect(owner).activate(0))
        .to.emit(arkadaMapBoostContract, 'BoostActivated')
        .withArgs(owner.address, 0);
    });
  });

  describe('Transfers', () => {
    it('Should allow transferring non-activated token', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await transferFromTest({
        arkadaMapBoostContract,
        owner,
        from: owner,
        to: user,
        tokenId: 0,
      });

      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(user.address);
    });

    it('Should allow safeTransferFrom for non-activated token', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await safeTransferFromTest({
        arkadaMapBoostContract,
        owner,
        from: owner,
        to: user,
        tokenId: 0,
      });

      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(user.address);
    });

    it('Should not allow transferring activated token', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });

      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: user,
          tokenId: 0,
        },
        { revertMessage: 'ArkadaMapBoost__CannotTransferActivated' },
      );
    });

    it('Should not allow safeTransferFrom for activated token', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });

      await safeTransferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: user,
          tokenId: 0,
        },
        { revertMessage: 'ArkadaMapBoost__CannotTransferActivated' },
      );
    });

    it('Should allow transferring token before activation', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        user,
        regularAccounts,
        MINT_PRICE,
      } = await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      // Transfer to user
      await transferFromTest({
        arkadaMapBoostContract,
        owner,
        from: owner,
        to: user,
        tokenId: 0,
      });

      // User can activate
      await activateTest(
        {
          arkadaMapBoostContract,
          owner,
          tokenId: 0,
        },
        { from: user },
      );

      // Now cannot transfer
      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: user,
          to: regularAccounts[0],
          tokenId: 0,
        },
        {
          from: user,
          revertMessage: 'ArkadaMapBoost__CannotTransferActivated',
        },
      );
    });

    it('Should allow approved address to transfer non-activated token', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        user,
        regularAccounts,
        MINT_PRICE,
      } = await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await arkadaMapBoostContract.connect(owner).approve(user.address, 0);

      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: regularAccounts[0],
          tokenId: 0,
        },
        { from: user },
      );

      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(
        regularAccounts[0].address,
      );
    });

    it('Should not allow approved address to transfer activated token', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        user,
        regularAccounts,
        MINT_PRICE,
      } = await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });

      await arkadaMapBoostContract.connect(owner).approve(user.address, 0);

      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: regularAccounts[0],
          tokenId: 0,
        },
        {
          from: user,
          revertMessage: 'ArkadaMapBoost__CannotTransferActivated',
        },
      );
    });

    it('Should allow operator to transfer non-activated token', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        user,
        regularAccounts,
        MINT_PRICE,
      } = await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await arkadaMapBoostContract
        .connect(owner)
        .setApprovalForAll(user.address, true);

      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: regularAccounts[0],
          tokenId: 0,
        },
        { from: user },
      );

      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(
        regularAccounts[0].address,
      );
    });

    it('Should not allow operator to transfer activated token', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        user,
        regularAccounts,
        MINT_PRICE,
      } = await loadFixture(arkadaMapBoostDeploy);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });

      await arkadaMapBoostContract
        .connect(owner)
        .setApprovalForAll(user.address, true);

      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: regularAccounts[0],
          tokenId: 0,
        },
        {
          from: user,
          revertMessage: 'ArkadaMapBoost__CannotTransferActivated',
        },
      );
    });
  });

  describe('Token URI', () => {
    it('Should return same URI for all tokens', async () => {
      const { arkadaMapBoostContract, owner, BASE_URI, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      expect(await arkadaMapBoostContract.tokenURI(0)).to.equal(BASE_URI);
      expect(await arkadaMapBoostContract.tokenURI(999)).to.equal(BASE_URI);

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      expect(await arkadaMapBoostContract.tokenURI(0)).to.equal(BASE_URI);
      expect(await arkadaMapBoostContract.tokenURI(1)).to.equal(BASE_URI);
      expect(await arkadaMapBoostContract.tokenURI(999)).to.equal(BASE_URI);
    });

    it('Should return updated URI after owner changes it', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      const newURI = 'https://new-api.arkada.com/mapboost/';
      await setBaseURITest({
        arkadaMapBoostContract,
        owner,
        baseURI: newURI,
      });

      expect(await arkadaMapBoostContract.tokenURI(0)).to.equal(newURI);
      expect(await arkadaMapBoostContract.tokenURI(1)).to.equal(newURI);
      expect(await arkadaMapBoostContract.tokenURI(999)).to.equal(newURI);
    });
  });

  describe('ERC721 Standard', () => {
    it('Should support ERC721 interface', async () => {
      const { arkadaMapBoostContract } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      // ERC165 interface ID for ERC721
      const ERC721_INTERFACE_ID = '0x80ac58cd';
      expect(
        await arkadaMapBoostContract.supportsInterface(ERC721_INTERFACE_ID),
      ).to.equal(true);
    });

    it('Should support ERC721Metadata interface', async () => {
      const { arkadaMapBoostContract } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      // ERC165 interface ID for ERC721Metadata
      const ERC721_METADATA_INTERFACE_ID = '0x5b5e139f';
      expect(
        await arkadaMapBoostContract.supportsInterface(
          ERC721_METADATA_INTERFACE_ID,
        ),
      ).to.equal(true);
    });

    it('Should support ERC165 interface', async () => {
      const { arkadaMapBoostContract } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      // ERC165 interface ID
      const ERC165_INTERFACE_ID = '0x01ffc9a7';
      expect(
        await arkadaMapBoostContract.supportsInterface(ERC165_INTERFACE_ID),
      ).to.equal(true);
    });

    it('Should return false for unsupported interface', async () => {
      const { arkadaMapBoostContract } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      const UNSUPPORTED_INTERFACE_ID = '0x12345678';
      expect(
        await arkadaMapBoostContract.supportsInterface(
          UNSUPPORTED_INTERFACE_ID,
        ),
      ).to.equal(false);
    });
  });

  describe('Edge Cases', () => {
    it('Should handle multiple mints and activations', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      // Mint 3 tokens
      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });
      await mintTest(
        {
          arkadaMapBoostContract,
          owner,
          value: MINT_PRICE,
        },
        { from: user },
      );
      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      // Activate first and third
      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 0,
      });
      await activateTest({
        arkadaMapBoostContract,
        owner,
        tokenId: 2,
      });

      // First and third should not be transferable
      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: user,
          tokenId: 0,
        },
        { revertMessage: 'ArkadaMapBoost__CannotTransferActivated' },
      );

      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: owner,
          to: user,
          tokenId: 2,
        },
        { revertMessage: 'ArkadaMapBoost__CannotTransferActivated' },
      );

      // Second should be transferable
      await transferFromTest(
        {
          arkadaMapBoostContract,
          owner,
          from: user,
          to: owner,
          tokenId: 1,
        },
        { from: user },
      );

      expect(await arkadaMapBoostContract.ownerOf(1)).to.equal(owner.address);
    });

    it('Should handle treasury change during minting', async () => {
      const { arkadaMapBoostContract, owner, regularAccounts, MINT_PRICE } =
        await loadFixture(arkadaMapBoostDeploy);

      const newTreasury = regularAccounts[0].address;
      await setTreasuryTest({
        arkadaMapBoostContract,
        owner,
        treasury: newTreasury,
      });

      const newTreasuryBalanceBefore = await ethers.provider.getBalance(
        newTreasury,
      );

      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: MINT_PRICE,
      });

      const newTreasuryBalanceAfter = await ethers.provider.getBalance(
        newTreasury,
      );
      expect(newTreasuryBalanceAfter).to.equal(
        newTreasuryBalanceBefore.add(MINT_PRICE),
      );
    });

    it('Should handle mint price change', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostDeploy,
      );

      const newPrice = parseEther('0.2');
      await setMintPriceTest({
        arkadaMapBoostContract,
        owner,
        mintPrice: newPrice,
      });

      // Old price should fail
      await mintTest(
        { arkadaMapBoostContract, owner, value: MINT_PRICE },
        { revertMessage: 'ArkadaMapBoost__InvalidPayment' },
      );

      // New price should work
      await mintTest({
        arkadaMapBoostContract,
        owner,
        value: newPrice,
      });
    });
  });
});
