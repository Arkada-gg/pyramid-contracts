import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { arkadaMapBoostV2Deploy } from '../../common/arkada-map-boost-v2.fixtures';
import { adminMintTest } from '../../common/arkada-map-boost-v2.helpers';
import {
  activateTest,
  mintTest,
  setMintingActiveTest,
} from '../../common/arkada-map-boost.helpers';

describe.only('ArkadaMapBoostV2', () => {
  it('deployment', async () => {
    await loadFixture(arkadaMapBoostV2Deploy);
  });

  describe('Upgrade State Preservation', () => {
    it('Should preserve owner after upgrade', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      expect(await arkadaMapBoostContract.owner()).to.equal(owner.address);
    });

    it('Should preserve mint price after upgrade', async () => {
      const { arkadaMapBoostContract, MINT_PRICE } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      expect(await arkadaMapBoostContract.mintPrice()).to.equal(MINT_PRICE);
    });

    it('Should preserve treasury after upgrade', async () => {
      const { arkadaMapBoostContract, treasury } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      expect(await arkadaMapBoostContract.treasury()).to.equal(
        treasury.address,
      );
    });

    it('Should preserve minting active state after upgrade', async () => {
      const { arkadaMapBoostContract } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      expect(await arkadaMapBoostContract.s_isMintingActive()).to.equal(true);
    });

    it('Should preserve base URI after upgrade', async () => {
      const { arkadaMapBoostContract, BASE_URI } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      expect(await arkadaMapBoostContract.tokenURI(0)).to.equal(BASE_URI);
    });

    it('Should preserve token state minted before upgrade', async () => {
      const {
        arkadaMapBoostContract,
        owner,
        treasury,
        MINT_PRICE,
        NAME,
        SYMBOL,
      } = await loadFixture(arkadaMapBoostV2Deploy);

      // Tokens minted on V1 before upgrade are preserved
      expect(await arkadaMapBoostContract.name()).to.equal(NAME);
      expect(await arkadaMapBoostContract.symbol()).to.equal(SYMBOL);
    });
  });

  describe('adminMint', () => {
    it('Should allow owner to adminMint to any address', async () => {
      const { arkadaMapBoostContract, owner, user } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
    });

    it('Should allow owner to adminMint to themselves', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      await adminMintTest({ arkadaMapBoostContract, owner, to: owner.address });
    });

    it('Should not allow non-owner to adminMint', async () => {
      const { arkadaMapBoostContract, owner, user, regularAccounts } =
        await loadFixture(arkadaMapBoostV2Deploy);
      await adminMintTest(
        { arkadaMapBoostContract, owner, to: regularAccounts[0].address },
        { from: user, revertMessage: 'OwnableUnauthorizedAccount' },
      );
    });

    it('Should not allow adminMint to zero address', async () => {
      const { arkadaMapBoostContract, owner } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      await adminMintTest(
        { arkadaMapBoostContract, owner, to: ethers.constants.AddressZero },
        { revertMessage: 'ArkadaMapBoost__InvalidAddress' },
      );
    });

    it('Should not transfer ETH to treasury on adminMint', async () => {
      const { arkadaMapBoostContract, owner, user, treasury } =
        await loadFixture(arkadaMapBoostV2Deploy);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
      const treasuryBalanceAfter = await ethers.provider.getBalance(
        treasury.address,
      );

      expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore);
    });

    it('Should work when minting is inactive', async () => {
      const { arkadaMapBoostContract, owner, user } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );

      await setMintingActiveTest({
        arkadaMapBoostContract,
        owner,
        isActive: false,
      });
      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
    });

    it('Should increment token ID correctly across adminMint and mint', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostV2Deploy);

      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
      expect(await arkadaMapBoostContract.ownerOf(0)).to.equal(user.address);

      await mintTest({ arkadaMapBoostContract, owner, value: MINT_PRICE });
      expect(await arkadaMapBoostContract.ownerOf(1)).to.equal(owner.address);

      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
      expect(await arkadaMapBoostContract.ownerOf(2)).to.equal(user.address);
    });

    it('Should allow activating adminMinted token', async () => {
      const { arkadaMapBoostContract, owner, user } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );

      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
      await activateTest(
        { arkadaMapBoostContract, owner, tokenId: 0 },
        { from: user },
      );
      expect(await arkadaMapBoostContract.isActivated(0)).to.equal(true);
    });

    it('Should not allow transfer of adminMinted token after activation', async () => {
      const { arkadaMapBoostContract, owner, user, regularAccounts } =
        await loadFixture(arkadaMapBoostV2Deploy);

      await adminMintTest({ arkadaMapBoostContract, owner, to: user.address });
      await activateTest(
        { arkadaMapBoostContract, owner, tokenId: 0 },
        { from: user },
      );

      await expect(
        arkadaMapBoostContract
          .connect(user)
          .transferFrom(user.address, regularAccounts[0].address, 0),
      ).revertedWithCustomError(
        arkadaMapBoostContract,
        'ArkadaMapBoost__CannotTransferActivated',
      );
    });

    it('Should allow batch adminMints to multiple recipients', async () => {
      const { arkadaMapBoostContract, owner, regularAccounts } =
        await loadFixture(arkadaMapBoostV2Deploy);

      for (let i = 0; i < 3; i++) {
        await adminMintTest({
          arkadaMapBoostContract,
          owner,
          to: regularAccounts[i].address,
        });
        expect(await arkadaMapBoostContract.ownerOf(i)).to.equal(
          regularAccounts[i].address,
        );
      }

      expect(
        await arkadaMapBoostContract.balanceOf(regularAccounts[0].address),
      ).to.equal(1);
      expect(
        await arkadaMapBoostContract.balanceOf(regularAccounts[1].address),
      ).to.equal(1);
      expect(
        await arkadaMapBoostContract.balanceOf(regularAccounts[2].address),
      ).to.equal(1);
    });
  });

  describe('V1 Functionality Preserved', () => {
    it('Should allow public mint with correct payment', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      await mintTest({ arkadaMapBoostContract, owner, value: MINT_PRICE });
    });

    it('Should reject public mint with wrong payment', async () => {
      const { arkadaMapBoostContract, owner, MINT_PRICE } = await loadFixture(
        arkadaMapBoostV2Deploy,
      );
      await mintTest(
        { arkadaMapBoostContract, owner, value: MINT_PRICE.sub(1) },
        { revertMessage: 'ArkadaMapBoost__InvalidPayment' },
      );
    });

    it('Should reject public mint when minting inactive', async () => {
      const { arkadaMapBoostContract, owner, user, MINT_PRICE } =
        await loadFixture(arkadaMapBoostV2Deploy);
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

    it('Should transfer payment to treasury on public mint', async () => {
      const { arkadaMapBoostContract, owner, treasury, MINT_PRICE } =
        await loadFixture(arkadaMapBoostV2Deploy);

      const treasuryBalanceBefore = await ethers.provider.getBalance(
        treasury.address,
      );
      await mintTest({ arkadaMapBoostContract, owner, value: MINT_PRICE });
      const treasuryBalanceAfter = await ethers.provider.getBalance(
        treasury.address,
      );

      expect(treasuryBalanceAfter).to.equal(
        treasuryBalanceBefore.add(MINT_PRICE),
      );
    });
  });
});
