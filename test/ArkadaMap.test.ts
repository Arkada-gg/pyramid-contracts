import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { arkadaMapDeploy } from './common/arkada-map.fixtures';
import {
  mintTest,
  safeBatchTransferFromTest,
  safeTransferFromTest,
  setTokenURITest,
  setWhitelistTest,
} from './common/arkada-map.helpers';

describe('ArkadaMap', () => {
  it('deployment', async () => {
    await loadFixture(arkadaMapDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { arkadaMapContract, owner } = await loadFixture(arkadaMapDeploy);
      expect(
        await arkadaMapContract.hasRole(
          await arkadaMapContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set correct MAX_PIECES constant', async () => {
      const { arkadaMapContract } = await loadFixture(arkadaMapDeploy);
      expect(await arkadaMapContract.MAX_PIECES()).to.equal(12);
    });

    it('Should not allow initialization with zero admin', async () => {
      const { BASE_URI } = await loadFixture(arkadaMapDeploy);

      const ArkadaMapFactory = await ethers.getContractFactory('ArkadaMap');
      const newContract = await ArkadaMapFactory.deploy();

      await expect(
        newContract.initialize(ethers.constants.AddressZero, BASE_URI),
      ).to.be.revertedWithCustomError(newContract, 'ArkadaMap__InvalidAddress');
    });

    it('Should not allow double initialization', async () => {
      const { arkadaMapContract, owner, BASE_URI } = await loadFixture(
        arkadaMapDeploy,
      );

      await expect(
        arkadaMapContract.initialize(owner.address, BASE_URI),
      ).to.be.revertedWithCustomError(
        arkadaMapContract,
        'InvalidInitialization',
      );
    });
  });

  describe('Minting', () => {
    it('Should allow minter to mint pieces', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );
    });

    it('Should not allow non-minter to mint', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await mintTest(
        {
          arkadaMapContract,
          owner,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow minting to zero address', async () => {
      const { arkadaMapContract, minter } = await loadFixture(arkadaMapDeploy);

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: { address: ethers.constants.AddressZero } as any,
          tokenId: 0,
          amount: 1,
        },
        { from: minter, revertMessage: 'ArkadaMap__InvalidAddress' },
      );
    });

    it('Should not allow minting invalid token ID', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 12,
          amount: 1,
        },
        { from: minter, revertMessage: 'ArkadaMap__TokenIdOutOfRange' },
      );
    });

    it('Should allow minting multiple pieces of same token', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 5,
        },
        { from: minter },
      );

      expect(await arkadaMapContract.balanceOf(user.address, 0)).to.equal(5);
    });

    it('Should allow minting different token IDs', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 5,
          amount: 1,
        },
        { from: minter },
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 11,
          amount: 1,
        },
        { from: minter },
      );

      expect(await arkadaMapContract.balanceOf(user.address, 0)).to.equal(1);
      expect(await arkadaMapContract.balanceOf(user.address, 5)).to.equal(1);
      expect(await arkadaMapContract.balanceOf(user.address, 11)).to.equal(1);
    });

    it('Should emit PieceMinted event', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await expect(arkadaMapContract.connect(minter).mint(user.address, 0, 1))
        .to.emit(arkadaMapContract, 'PieceMinted')
        .withArgs(user.address, 0, 1);
    });
  });

  describe('Token URI Management', () => {
    it('Should allow admin to set token URI', async () => {
      const { arkadaMapContract, owner } = await loadFixture(arkadaMapDeploy);

      const customURI = 'https://api.arkada.com/map/piece-0.json';
      await setTokenURITest({
        arkadaMapContract,
        owner,
        tokenId: 0,
        tokenURI: customURI,
      });
    });

    it('Should not allow non-admin to set token URI', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await setTokenURITest(
        {
          arkadaMapContract,
          owner,
          tokenId: 0,
          tokenURI: 'https://api.arkada.com/map/piece-0.json',
        },
        {
          from: user,
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('Should not allow setting URI for invalid token ID', async () => {
      const { arkadaMapContract, owner } = await loadFixture(arkadaMapDeploy);

      await setTokenURITest(
        {
          arkadaMapContract,
          owner,
          tokenId: 12,
          tokenURI: 'https://api.arkada.com/map/piece-12.json',
        },
        { revertMessage: 'ArkadaMap__TokenIdOutOfRange' },
      );
    });

    it('Should return custom URI when set', async () => {
      const { arkadaMapContract, owner, BASE_URI } = await loadFixture(
        arkadaMapDeploy,
      );

      // Initially returns base URI
      const uriBefore = await arkadaMapContract.uri(0);
      expect(uriBefore).to.equal(BASE_URI);

      // Set custom URI
      const customURI = 'https://api.arkada.com/map/piece-0.json';
      await setTokenURITest({
        arkadaMapContract,
        owner,
        tokenId: 0,
        tokenURI: customURI,
      });

      // Now returns custom URI
      expect(await arkadaMapContract.uri(0)).to.equal(customURI);
    });

    it('Should return base URI when custom URI not set', async () => {
      const { arkadaMapContract, BASE_URI } = await loadFixture(
        arkadaMapDeploy,
      );

      expect(await arkadaMapContract.uri(5)).to.equal(BASE_URI);
    });

    it('Should allow setting different URIs for different tokens', async () => {
      const { arkadaMapContract, owner } = await loadFixture(arkadaMapDeploy);

      const uri0 = 'https://api.arkada.com/map/piece-0.json';
      const uri1 = 'https://api.arkada.com/map/piece-1.json';
      const uri11 = 'https://api.arkada.com/map/piece-11.json';

      await setTokenURITest({
        arkadaMapContract,
        owner,
        tokenId: 0,
        tokenURI: uri0,
      });

      await setTokenURITest({
        arkadaMapContract,
        owner,
        tokenId: 1,
        tokenURI: uri1,
      });

      await setTokenURITest({
        arkadaMapContract,
        owner,
        tokenId: 11,
        tokenURI: uri11,
      });

      expect(await arkadaMapContract.uri(0)).to.equal(uri0);
      expect(await arkadaMapContract.uri(1)).to.equal(uri1);
      expect(await arkadaMapContract.uri(11)).to.equal(uri11);
    });
  });

  describe('Whitelist Management', () => {
    it('Should allow admin to add address to whitelist', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });
    });

    it('Should allow admin to remove address from whitelist', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      // Add to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Remove from whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: false,
      });
    });

    it('Should not allow non-admin to manage whitelist', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await setWhitelistTest(
        {
          arkadaMapContract,
          owner,
          account: user.address,
          isWhitelisted: true,
        },
        {
          from: user,
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('Should not allow setting whitelist for zero address', async () => {
      const { arkadaMapContract, owner } = await loadFixture(arkadaMapDeploy);

      await setWhitelistTest(
        {
          arkadaMapContract,
          owner,
          account: ethers.constants.AddressZero,
          isWhitelisted: true,
        },
        { revertMessage: 'ArkadaMap__InvalidAddress' },
      );
    });

    it('Should emit WhitelistUpdated event', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await expect(
        arkadaMapContract.connect(owner).setWhitelist(user.address, true),
      )
        .to.emit(arkadaMapContract, 'WhitelistUpdated')
        .withArgs(user.address, true);
    });
  });

  describe('Transfers', () => {
    it('Should not allow transfer from non-whitelisted address', async () => {
      const { arkadaMapContract, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Try to transfer (user is not whitelisted)
      await safeTransferFromTest(
        {
          arkadaMapContract,
          owner: user,
          from: user,
          to: regularAccounts[0],
          tokenId: 0,
          amount: 1,
        },
        { revertMessage: 'ArkadaMap__TransferNotAllowed' },
      );
    });

    it('Should allow transfer from whitelisted address', async () => {
      const { arkadaMapContract, owner, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Add user to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Transfer should work
      await safeTransferFromTest({
        arkadaMapContract,
        owner: user,
        from: user,
        to: regularAccounts[0],
        tokenId: 0,
        amount: 1,
      });
    });

    it('Should allow batch transfer from whitelisted address', async () => {
      const { arkadaMapContract, owner, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint multiple tokens
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 2,
        },
        { from: minter },
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 1,
          amount: 3,
        },
        { from: minter },
      );

      // Add user to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Batch transfer should work
      await safeBatchTransferFromTest({
        arkadaMapContract,
        owner: user,
        from: user,
        to: regularAccounts[0],
        tokenIds: [0, 1],
        amounts: [1, 2],
      });
    });

    it('Should allow transfer to any address from whitelisted', async () => {
      const { arkadaMapContract, owner, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Add user to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Transfer to non-whitelisted address should work
      await safeTransferFromTest({
        arkadaMapContract,
        owner: user,
        from: user,
        to: regularAccounts[0],
        tokenId: 0,
        amount: 1,
      });

      expect(
        await arkadaMapContract.balanceOf(regularAccounts[0].address, 0),
      ).to.equal(1);
    });

    it('Should allow transfer between whitelisted addresses', async () => {
      const { arkadaMapContract, owner, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Add both to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: regularAccounts[0].address,
        isWhitelisted: true,
      });

      // Transfer should work
      await safeTransferFromTest({
        arkadaMapContract,
        owner: user,
        from: user,
        to: regularAccounts[0],
        tokenId: 0,
        amount: 1,
      });
    });

    it('Should allow approved operator to transfer from whitelisted', async () => {
      const { arkadaMapContract, owner, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Add user to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Approve operator
      await arkadaMapContract
        .connect(user)
        .setApprovalForAll(regularAccounts[0].address, true);

      // Operator can transfer
      await safeTransferFromTest(
        {
          arkadaMapContract,
          owner: user,
          from: user,
          to: regularAccounts[1],
          tokenId: 0,
          amount: 1,
        },
        { from: regularAccounts[0] },
      );
    });

    it('Should not allow approved operator to transfer from non-whitelisted', async () => {
      const { arkadaMapContract, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Approve operator (but user is not whitelisted)
      await arkadaMapContract
        .connect(user)
        .setApprovalForAll(regularAccounts[0].address, true);

      // Operator cannot transfer
      await safeTransferFromTest(
        {
          arkadaMapContract,
          owner: user,
          from: user,
          to: regularAccounts[1],
          tokenId: 0,
          amount: 1,
        },
        {
          from: regularAccounts[0],
          revertMessage: 'ArkadaMap__TransferNotAllowed',
        },
      );
    });
  });

  describe('Burning', () => {
    it('Should not allow burning tokens', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Try to burn (transfer to address(0))
      // ERC1155 checks for zero address first, so we get ERC1155InvalidReceiver
      await expect(
        arkadaMapContract
          .connect(user)
          ['safeTransferFrom(address,address,uint256,uint256,bytes)'](
            user.address,
            ethers.constants.AddressZero,
            0,
            1,
            '0x',
          ),
      ).to.be.revertedWithCustomError(
        arkadaMapContract,
        'ERC1155InvalidReceiver',
      );
    });

    it('Should not allow burning even from whitelisted address', async () => {
      const { arkadaMapContract, owner, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Add user to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Try to burn (transfer to address(0))
      // ERC1155 checks for zero address first, so we get ERC1155InvalidReceiver
      await expect(
        arkadaMapContract
          .connect(user)
          ['safeTransferFrom(address,address,uint256,uint256,bytes)'](
            user.address,
            ethers.constants.AddressZero,
            0,
            1,
            '0x',
          ),
      ).to.be.revertedWithCustomError(
        arkadaMapContract,
        'ERC1155InvalidReceiver',
      );
    });
  });

  describe('ERC1155 Standard', () => {
    it('Should support ERC1155 interface', async () => {
      const { arkadaMapContract } = await loadFixture(arkadaMapDeploy);

      // ERC165 interface ID for ERC1155
      const ERC1155_INTERFACE_ID = '0xd9b67a26';
      expect(
        await arkadaMapContract.supportsInterface(ERC1155_INTERFACE_ID),
      ).to.equal(true);
    });

    it('Should support ERC1155MetadataURI interface', async () => {
      const { arkadaMapContract } = await loadFixture(arkadaMapDeploy);

      // ERC165 interface ID for ERC1155MetadataURI
      const ERC1155_METADATA_URI_INTERFACE_ID = '0x0e89341c';
      expect(
        await arkadaMapContract.supportsInterface(
          ERC1155_METADATA_URI_INTERFACE_ID,
        ),
      ).to.equal(true);
    });

    it('Should support AccessControl interface', async () => {
      const { arkadaMapContract } = await loadFixture(arkadaMapDeploy);

      // ERC165 interface ID for AccessControl
      const ACCESS_CONTROL_INTERFACE_ID = '0x7965db0b';
      expect(
        await arkadaMapContract.supportsInterface(ACCESS_CONTROL_INTERFACE_ID),
      ).to.equal(true);
    });

    it('Should support ERC165 interface', async () => {
      const { arkadaMapContract } = await loadFixture(arkadaMapDeploy);

      // ERC165 interface ID
      const ERC165_INTERFACE_ID = '0x01ffc9a7';
      expect(
        await arkadaMapContract.supportsInterface(ERC165_INTERFACE_ID),
      ).to.equal(true);
    });

    it('Should return false for unsupported interface', async () => {
      const { arkadaMapContract } = await loadFixture(arkadaMapDeploy);

      const UNSUPPORTED_INTERFACE_ID = '0x12345678';
      expect(
        await arkadaMapContract.supportsInterface(UNSUPPORTED_INTERFACE_ID),
      ).to.equal(false);
    });

    it('Should return correct balanceOf', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      expect(await arkadaMapContract.balanceOf(user.address, 0)).to.equal(0);

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 5,
        },
        { from: minter },
      );

      expect(await arkadaMapContract.balanceOf(user.address, 0)).to.equal(5);
    });

    it('Should return correct balanceOfBatch', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 1,
          amount: 2,
        },
        { from: minter },
      );

      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 2,
          amount: 3,
        },
        { from: minter },
      );

      const balances = await arkadaMapContract.balanceOfBatch(
        [user.address, user.address, user.address],
        [0, 1, 2],
      );

      expect(balances[0]).to.equal(1);
      expect(balances[1]).to.equal(2);
      expect(balances[2]).to.equal(3);
    });
  });

  describe('Edge Cases', () => {
    it('Should handle minting all 12 pieces', async () => {
      const { arkadaMapContract, minter, user } = await loadFixture(
        arkadaMapDeploy,
      );

      for (let i = 0; i < 12; i++) {
        await mintTest(
          {
            arkadaMapContract,
            owner: minter,
            to: user,
            tokenId: i,
            amount: 1,
          },
          { from: minter },
        );
      }

      for (let i = 0; i < 12; i++) {
        expect(await arkadaMapContract.balanceOf(user.address, i)).to.equal(1);
      }
    });

    it('Should handle multiple whitelist updates', async () => {
      const { arkadaMapContract, owner, user } = await loadFixture(
        arkadaMapDeploy,
      );

      // Add
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Remove
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: false,
      });

      // Add again
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      expect(await arkadaMapContract.isWhitelisted(user.address)).to.equal(
        true,
      );
    });

    it('Should handle transfer after whitelist removal', async () => {
      const { arkadaMapContract, owner, minter, user, regularAccounts } =
        await loadFixture(arkadaMapDeploy);

      // Mint to user
      await mintTest(
        {
          arkadaMapContract,
          owner: minter,
          to: user,
          tokenId: 0,
          amount: 1,
        },
        { from: minter },
      );

      // Add to whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: true,
      });

      // Remove from whitelist
      await setWhitelistTest({
        arkadaMapContract,
        owner,
        account: user.address,
        isWhitelisted: false,
      });

      // Transfer should fail
      await safeTransferFromTest(
        {
          arkadaMapContract,
          owner: user,
          from: user,
          to: regularAccounts[0],
          tokenId: 0,
          amount: 1,
        },
        { revertMessage: 'ArkadaMap__TransferNotAllowed' },
      );
    });

    it('Should handle setting URI for all tokens', async () => {
      const { arkadaMapContract, owner } = await loadFixture(arkadaMapDeploy);

      for (let i = 0; i < 12; i++) {
        const customURI = `https://api.arkada.com/map/piece-${i}.json`;
        await setTokenURITest({
          arkadaMapContract,
          owner,
          tokenId: i,
          tokenURI: customURI,
        });

        expect(await arkadaMapContract.uri(i)).to.equal(customURI);
      }
    });
  });
});
