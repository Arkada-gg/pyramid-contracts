import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import { Escrow } from '../typechain-types';
import {
  addTokenToWhitelistTest,
  removeTokenFromWhitelistTest,
  withdrawERC1155Test,
  withdrawERC20Test,
  withdrawERC721Test,
  withdrawNativeTest,
} from './common/escrow.helpers';

describe('Escrow', () => {
  let escrowContract: Escrow;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let treasury: SignerWithAddress;
  let token: SignerWithAddress;
  let erc20Token: any;
  let erc721Token: any;
  let erc1155Token: any;

  beforeEach(async () => {
    [owner, user, treasury, token] = await ethers.getSigners();

    // Deploy mock tokens
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    erc20Token = await ERC20Mock.deploy('Test Token', 'TEST');
    await erc20Token.deployed();

    const ERC721Mock = await ethers.getContractFactory('ERC721Mock');
    erc721Token = await ERC721Mock.deploy('Test NFT', 'TNFT');
    await erc721Token.deployed();

    const ERC1155Mock = await ethers.getContractFactory('ERC1155Mock');
    erc1155Token = await ERC1155Mock.deploy();
    await erc1155Token.deployed();

    // Deploy Escrow contract
    const Escrow = await ethers.getContractFactory('Escrow');
    escrowContract = (await Escrow.deploy(
      owner.address,
      [erc20Token.address, erc721Token.address, erc1155Token.address],
      treasury.address,
    )) as Escrow;
    await escrowContract.deployed();

    // Setup initial balances
    await erc20Token.mint(
      escrowContract.address,
      ethers.utils.parseEther('1000'),
    );
    await erc721Token.mint(escrowContract.address, 1);
    await erc1155Token.mint(escrowContract.address, 1, 100, '0x');
  });

  describe('addTokenToWhitelist', () => {
    it('should add token to whitelist', async () => {
      await addTokenToWhitelistTest({
        escrowContract,
        owner,
        token: token.address,
      });
    });

    it('should revert if not owner', async () => {
      await addTokenToWhitelistTest(
        {
          escrowContract,
          owner,
          token: token.address,
        },
        {
          from: user,
          revertMessage: 'OwnableUnauthorizedAccount',
        },
      );
    });

    it('should revert if zero address', async () => {
      await addTokenToWhitelistTest(
        {
          escrowContract,
          owner,
          token: ethers.constants.AddressZero,
        },
        {
          revertMessage: 'Escrow__ZeroAddress',
        },
      );
    });
  });

  describe('removeTokenFromWhitelist', () => {
    beforeEach(async () => {
      await escrowContract.addTokenToWhitelist(token.address);
    });

    it('should remove token from whitelist', async () => {
      await removeTokenFromWhitelistTest({
        escrowContract,
        owner,
        token: token.address,
      });
    });

    it('should revert if not owner', async () => {
      await removeTokenFromWhitelistTest(
        {
          escrowContract,
          owner,
          token: token.address,
        },
        {
          from: user,
          revertMessage: 'OwnableUnauthorizedAccount',
        },
      );
    });
  });

  describe('withdrawERC20', () => {
    const amount = ethers.utils.parseEther('100');
    const rakeBps = 1000; // 10%

    it('should withdraw ERC20 tokens with rake', async () => {
      await withdrawERC20Test({
        escrowContract,
        owner,
        token: erc20Token.address,
        to: user.address,
        amount,
        rakeBps,
      });

      const rake = amount.mul(rakeBps).div(10000);
      const rewardAmount = amount.sub(rake);

      expect(await erc20Token.balanceOf(user.address)).eq(rewardAmount);
      expect(await erc20Token.balanceOf(treasury.address)).eq(rake);
    });

    it('should revert if token not whitelisted', async () => {
      await withdrawERC20Test(
        {
          escrowContract,
          owner,
          token: token.address,
          to: user.address,
          amount,
          rakeBps,
        },
        {
          revertMessage: 'Escrow__TokenNotWhitelisted',
        },
      );
    });

    it('should revert if insufficient balance', async () => {
      await withdrawERC20Test(
        {
          escrowContract,
          owner,
          token: erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('10000'),
          rakeBps,
        },
        {
          revertMessage: 'Escrow__InsufficientEscrowBalance',
        },
      );
    });

    it('should revert if invalid rake BPS', async () => {
      await withdrawERC20Test(
        {
          escrowContract,
          owner,
          token: erc20Token.address,
          to: user.address,
          amount,
          rakeBps: 10001,
        },
        {
          revertMessage: 'Escrow__InvalidRakeBps',
        },
      );
    });
  });

  describe('withdrawERC721', () => {
    it('should withdraw ERC721 token', async () => {
      await withdrawERC721Test({
        escrowContract,
        owner,
        token: erc721Token.address,
        to: user.address,
        tokenId: 1,
      });

      expect(await erc721Token.ownerOf(1)).eq(user.address);
    });

    it('should revert if token not whitelisted', async () => {
      await withdrawERC721Test(
        {
          escrowContract,
          owner,
          token: token.address,
          to: user.address,
          tokenId: 1,
        },
        {
          revertMessage: 'Escrow__TokenNotWhitelisted',
        },
      );
    });
  });

  describe('withdrawERC1155', () => {
    const amount = BigNumber.from(50);
    const tokenId = 1;

    it('should withdraw ERC1155 tokens', async () => {
      await withdrawERC1155Test({
        escrowContract,
        owner,
        token: erc1155Token.address,
        to: user.address,
        amount,
        tokenId,
      });

      expect(await erc1155Token.balanceOf(user.address, tokenId)).eq(amount);
    });

    it('should revert if token not whitelisted', async () => {
      await withdrawERC1155Test(
        {
          escrowContract,
          owner,
          token: token.address,
          to: user.address,
          amount,
          tokenId,
        },
        {
          revertMessage: 'Escrow__TokenNotWhitelisted',
        },
      );
    });
  });

  describe('withdrawNative', () => {
    const amount = ethers.utils.parseEther('1');
    const rakeBps = 1000; // 10%

    beforeEach(async () => {
      await user.sendTransaction({
        to: escrowContract.address,
        value: amount,
      });
    });

    it('should withdraw native tokens with rake', async () => {
      const balanceBefore = await user.getBalance();
      const treasuryBalanceBefore = await treasury.getBalance();

      await withdrawNativeTest({
        escrowContract,
        owner,
        to: user.address,
        amount,
        rakeBps,
      });

      const rake = amount.mul(rakeBps).div(10000);
      const rewardAmount = amount.sub(rake);

      const balanceAfter = await user.getBalance();
      const treasuryBalanceAfter = await treasury.getBalance();

      expect(balanceAfter).gt(balanceBefore);
      expect(balanceAfter).eq(balanceBefore.add(rewardAmount));
      expect(treasuryBalanceAfter).eq(treasuryBalanceBefore.add(rake));
    });

    it('should revert if insufficient balance', async () => {
      await withdrawNativeTest(
        {
          escrowContract,
          owner,
          to: user.address,
          amount: ethers.utils.parseEther('1000'),
          rakeBps,
        },
        {
          revertMessage: 'Escrow__InsufficientEscrowBalance',
        },
      );
    });

    it('should revert if invalid rake BPS', async () => {
      await withdrawNativeTest(
        {
          escrowContract,
          owner,
          to: user.address,
          amount,
          rakeBps: 10001,
        },
        {
          revertMessage: 'Escrow__InvalidRakeBps',
        },
      );
    });

    it('should revert if zero address', async () => {
      await withdrawNativeTest(
        {
          escrowContract,
          owner,
          to: ethers.constants.AddressZero,
          amount,
          rakeBps,
        },
        {
          revertMessage: 'Escrow__ZeroAddress',
        },
      );
    });
  });
});
