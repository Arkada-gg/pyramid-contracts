import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  addTokenToWhitelistTest,
  removeTokenFromWhitelistTest,
  withdrawERC1155Test,
  withdrawERC20Test,
  withdrawERC721Test,
  withdrawNativeTest,
} from './common/escrow.helpers';
import { defaultDeploy } from './common/fixtures';

describe('GlobalEscrow', () => {
  describe('addTokenToWhitelist', () => {
    it('should add token to whitelist', async () => {
      const { globalEscrowContract, owner, tokens } = await loadFixture(
        defaultDeploy,
      );
      await addTokenToWhitelistTest({
        escrowContract: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
      });
    });

    it('should revert if not owner', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      await addTokenToWhitelistTest(
        {
          escrowContract: globalEscrowContract,
          owner,
          token: tokens.erc20Token.address,
        },
        {
          from: regularAccounts[0],
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });

    it('should revert if zero address', async () => {
      const { globalEscrowContract, owner } = await loadFixture(defaultDeploy);
      await addTokenToWhitelistTest(
        {
          escrowContract: globalEscrowContract,
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
    it('should remove token from whitelist', async () => {
      const { globalEscrowContract, owner, tokens } = await loadFixture(
        defaultDeploy,
      );
      await addTokenToWhitelistTest({
        escrowContract: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
      });
      await removeTokenFromWhitelistTest({
        escrowContract: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
      });
    });

    it('should revert if not owner', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      await removeTokenFromWhitelistTest(
        {
          escrowContract: globalEscrowContract,
          owner,
          token: tokens.erc20Token.address,
        },
        {
          from: regularAccounts[0],
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });
  });

  describe('withdrawERC20', () => {
    const amount = ethers.utils.parseEther('100');
    const rakeBps = 1000; // 10%

    it('should withdraw ERC20 tokens with rake', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts, treasury } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      const erc20Token = tokens.erc20Token;
      await withdrawERC20Test({
        escrowContract: globalEscrowContract,
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
      const { globalEscrowContract, owner, regularAccounts, pyramidContract } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      await withdrawERC20Test(
        {
          escrowContract: globalEscrowContract,
          owner,
          token: pyramidContract.address, // using a non-whitelisted token
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
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      const erc20Token = tokens.erc20Token;
      await withdrawERC20Test(
        {
          escrowContract: globalEscrowContract,
          owner,
          token: erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('10000000'),
          rakeBps,
        },
        {
          revertMessage: 'Escrow__InsufficientEscrowBalance',
        },
      );
    });

    it('should revert if invalid rake BPS', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      const erc20Token = tokens.erc20Token;
      await withdrawERC20Test(
        {
          escrowContract: globalEscrowContract,
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
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      const erc721Token = tokens.erc721Token;
      await withdrawERC721Test({
        escrowContract: globalEscrowContract,
        owner,
        token: erc721Token.address,
        to: user.address,
        tokenId: 2,
      });

      expect(await erc721Token.ownerOf(2)).eq(user.address);
    });

    it('should revert if token not whitelisted', async () => {
      const { globalEscrowContract, owner, pyramidContract, regularAccounts } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      await withdrawERC721Test(
        {
          escrowContract: globalEscrowContract,
          owner,
          token: pyramidContract.address, // using a non-whitelisted token
          to: user.address,
          tokenId: 2,
        },
        {
          revertMessage: 'Escrow__TokenNotWhitelisted',
        },
      );
    });
  });

  describe('withdrawERC1155', () => {
    const amount = BigNumber.from(50);
    const tokenId = 2;

    it('should withdraw ERC1155 tokens', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      const erc1155Token = tokens.erc1155Token;
      await withdrawERC1155Test({
        escrowContract: globalEscrowContract,
        owner,
        token: erc1155Token.address,
        to: user.address,
        amount,
        tokenId,
      });

      expect(await erc1155Token.balanceOf(user.address, tokenId)).eq(amount);
    });

    it('should revert if token not whitelisted', async () => {
      const { globalEscrowContract, owner, pyramidContract, regularAccounts } =
        await loadFixture(defaultDeploy);
      const user = regularAccounts[0];
      await withdrawERC1155Test(
        {
          escrowContract: globalEscrowContract,
          owner,
          token: pyramidContract.address, // using a non-whitelisted token
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

    let globalEscrowContract: any,
      owner: any,
      tokens: any,
      regularAccounts: any,
      treasury: any,
      user: any;

    beforeEach(async () => {
      ({ globalEscrowContract, owner, tokens, regularAccounts, treasury } =
        await loadFixture(defaultDeploy));
      user = regularAccounts[0];
      await user.sendTransaction({
        to: globalEscrowContract.address,
        value: amount,
      });
    });

    it('should withdraw native tokens with rake', async () => {
      const balanceBefore = await user.getBalance();
      const treasuryBalanceBefore = await treasury.getBalance();

      await withdrawNativeTest({
        escrowContract: globalEscrowContract,
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
          escrowContract: globalEscrowContract,
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
          escrowContract: globalEscrowContract,
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
          escrowContract: globalEscrowContract,
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
