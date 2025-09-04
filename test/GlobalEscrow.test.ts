import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { defaultDeploy } from './common/fixtures';
import {
  addTokenToWhitelistTest,
  distributeRewardsTest,
  removeTokenFromWhitelistTest,
  withdrawFundsTest,
} from './common/global-escrow.helpers';

describe('GlobalEscrow', () => {
  describe('addTokenToWhitelist', () => {
    it('should add token to whitelist', async () => {
      const { globalEscrowContract, owner, tokens } = await loadFixture(
        defaultDeploy,
      );
      await addTokenToWhitelistTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
      });
    });

    it('should revert if not owner', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      await addTokenToWhitelistTest(
        {
          globalEscrow: globalEscrowContract,
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
          globalEscrow: globalEscrowContract,
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
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
      });
      await removeTokenFromWhitelistTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
      });
    });

    it('should revert if not owner', async () => {
      const { globalEscrowContract, owner, tokens, regularAccounts } =
        await loadFixture(defaultDeploy);
      await removeTokenFromWhitelistTest(
        {
          globalEscrow: globalEscrowContract,
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

  describe('withdrawFunds', () => {
    it('should withdraw native tokens', async () => {
      const { globalEscrowContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      await withdrawFundsTest({
        globalEscrow: globalEscrowContract,
        owner,
        to: user.address,
        token: ethers.constants.AddressZero,
        tokenId: 0,
        tokenType: 3, // NATIVE
      });

      const balance = await user.getBalance();
      expect(balance).gt(0);
    });

    it('should withdraw ERC20 tokens', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await withdrawFundsTest({
        globalEscrow: globalEscrowContract,
        owner,
        to: user.address,
        token: tokens.erc20Token.address,
        tokenId: 0,
        tokenType: 0, // ERC20
      });

      expect(await tokens.erc20Token.balanceOf(user.address)).gt(0);
    });

    it('should withdraw ERC721 tokens', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await withdrawFundsTest({
        globalEscrow: globalEscrowContract,
        owner,
        to: user.address,
        token: tokens.erc721Token.address,
        tokenId: 2,
        tokenType: 1, // ERC721
      });

      expect(await tokens.erc721Token.ownerOf(2)).eq(user.address);
    });

    it('should withdraw ERC1155 tokens', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      const escrowAddress = globalEscrowContract.address;
      const balanceBefore = await tokens.erc1155Token.balanceOf(
        escrowAddress,
        2,
      );
      expect(balanceBefore).eq(100);

      await withdrawFundsTest({
        globalEscrow: globalEscrowContract,
        owner,
        to: user.address,
        token: tokens.erc1155Token.address,
        tokenId: 2,
        tokenType: 2, // ERC1155
      });

      const balanceAfter = await tokens.erc1155Token.balanceOf(user.address, 2);
      expect(balanceAfter).eq(100);
    });

    it('should revert if not admin', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await withdrawFundsTest(
        {
          globalEscrow: globalEscrowContract,
          owner,
          to: user.address,
          token: tokens.erc20Token.address,
          tokenId: 0,
          tokenType: 1,
        },
        {
          from: user,
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });
  });

  describe('distributeRewards', () => {
    it('should distribute native tokens', async () => {
      const { globalEscrowContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: ethers.constants.AddressZero,
        to: user.address,
        amount: ethers.utils.parseEther('0.5'),
        rewardTokenId: 0,
        tokenType: 3, // NATIVE
        rakeBps: 1000,
      });

      const balance = await user.getBalance();
      expect(balance).gt(0);
    });

    it('should distribute ERC20 tokens', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
        to: user.address,
        amount: ethers.utils.parseEther('100'),
        rewardTokenId: 0,
        tokenType: 0, // ERC20
        rakeBps: 1000,
      });

      expect(await tokens.erc20Token.balanceOf(user.address)).gt(0);
    });

    it('should distribute ERC721 tokens', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc721Token.address,
        to: user.address,
        amount: BigNumber.from(1),
        rewardTokenId: 2,
        tokenType: 1, // ERC721
        rakeBps: 0,
      });

      expect(await tokens.erc721Token.ownerOf(2)).eq(user.address);
    });

    it('should distribute ERC1155 tokens', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc1155Token.address,
        to: user.address,
        amount: BigNumber.from(50),
        rewardTokenId: 2,
        tokenType: 2, // ERC1155
        rakeBps: 1000,
      });

      expect(await tokens.erc1155Token.balanceOf(user.address, 2)).gt(0);
    });

    it('should distribute correct amounts with 10% rake (1000 bps)', async () => {
      const amount = ethers.utils.parseEther('100');
      const rakeBps = 1000; // 10%
      const expectedUserAmount = amount.mul(9000).div(10000); // 90%
      const expectedTreasuryAmount = amount.mul(1000).div(10000); // 10%
      const { globalEscrowContract, owner, user, tokens, treasury } =
        await loadFixture(defaultDeploy);
      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
        to: user.address,
        amount,
        rewardTokenId: 0,
        tokenType: 0, // ERC20
        rakeBps,
      });

      expect(await tokens.erc20Token.balanceOf(user.address)).to.equal(
        expectedUserAmount,
      );
      expect(await tokens.erc20Token.balanceOf(treasury.address)).to.equal(
        expectedTreasuryAmount,
      );
    });

    it('should distribute correct amounts with 5% rake (500 bps)', async () => {
      const amount = ethers.utils.parseEther('100');
      const rakeBps = 500; // 5%
      const expectedUserAmount = amount.mul(9500).div(10000); // 95%
      const expectedTreasuryAmount = amount.mul(500).div(10000); // 5%
      const { globalEscrowContract, owner, user, tokens, treasury } =
        await loadFixture(defaultDeploy);
      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
        to: user.address,
        amount,
        rewardTokenId: 0,
        tokenType: 0, // ERC20
        rakeBps,
      });

      expect(await tokens.erc20Token.balanceOf(user.address)).to.equal(
        expectedUserAmount,
      );
      expect(await tokens.erc20Token.balanceOf(treasury.address)).to.equal(
        expectedTreasuryAmount,
      );
    });

    it('should distribute full amount when rake is 0 bps', async () => {
      const amount = ethers.utils.parseEther('100');
      const rakeBps = 0; // 0%

      const { globalEscrowContract, owner, user, tokens, treasury } =
        await loadFixture(defaultDeploy);

      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
        to: user.address,
        amount,
        rewardTokenId: 0,
        tokenType: 0, // ERC20
        rakeBps,
      });

      expect(await tokens.erc20Token.balanceOf(user.address)).to.equal(amount);
      expect(await tokens.erc20Token.balanceOf(treasury.address)).to.equal(0);
    });

    it('should distribute full amount to treasury when rake is 10000 bps', async () => {
      const amount = ethers.utils.parseEther('100');
      const rakeBps = 10000; // 100%

      const { globalEscrowContract, owner, user, tokens, treasury } =
        await loadFixture(defaultDeploy);

      await distributeRewardsTest({
        globalEscrow: globalEscrowContract,
        owner,
        token: tokens.erc20Token.address,
        to: user.address,
        amount,
        rewardTokenId: 0,
        tokenType: 0, // ERC20
        rakeBps,
      });

      expect(await tokens.erc20Token.balanceOf(user.address)).to.equal(0);
      expect(await tokens.erc20Token.balanceOf(treasury.address)).to.equal(
        amount,
      );
    });

    it('should revert if not called by distributor', async () => {
      const { globalEscrowContract, owner, user, tokens } = await loadFixture(
        defaultDeploy,
      );
      await distributeRewardsTest(
        {
          globalEscrow: globalEscrowContract,
          owner,
          token: tokens.erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('100'),
          rewardTokenId: 0,
          tokenType: 0, // ERC20
          rakeBps: 1000,
        },
        {
          from: user,
          revertMessage: 'AccessControlUnauthorizedAccount',
        },
      );
    });
  });
});
