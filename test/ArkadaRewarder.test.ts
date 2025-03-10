import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  addRewardsMultipleTest,
  addRewardsTest,
  claimRewardTest,
  setRewardsTest,
  withdrawTest,
} from './common/arkada-rewarder.helpers';
import { defaultDeploy } from './common/fixtures';

describe('ArkadaRewarder', () => {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { arkadaRewarderContract, owner } = await loadFixture(
        defaultDeploy,
      );
      expect(
        await arkadaRewarderContract.hasRole(
          await arkadaRewarderContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should not allow initialization with zero address', async () => {
      const ArkadaRewarder = await ethers.getContractFactory('ArkadaRewarder');
      const arkadaRewarderContract = await ArkadaRewarder.deploy();
      await expect(
        arkadaRewarderContract.initialize(ethers.constants.AddressZero),
      ).to.be.revertedWithCustomError(
        arkadaRewarderContract,
        'ArkadaRewarder__InvalidAddress',
      );
    });
  });

  describe('Rewards Management', () => {
    it('Should allow operator to set rewards for multiple users', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address];
      const amounts = [parseEther('0.1')];

      await setRewardsTest({
        arkadaRewarderContract,
        owner,
        users,
        amounts,
      });
    });

    it('Should not allow non-operator to set rewards', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address];
      const amounts = [parseEther('0.1')];

      await setRewardsTest(
        {
          arkadaRewarderContract,
          owner,
          users,
          amounts,
        },
        { from: user, revertMessage: 'ArkadaRewarder__NotAuthorized' },
      );
    });

    it('Should not allow setting rewards with mismatched array lengths', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address];
      const amounts = [parseEther('0.1'), parseEther('0.2')];

      await setRewardsTest(
        {
          arkadaRewarderContract,
          owner,
          users,
          amounts,
        },
        { revertMessage: 'ArkadaRewarder__ArrayLengthMismatch' },
      );
    });

    it('Should not allow setting rewards with zero address', async () => {
      const { arkadaRewarderContract, owner } = await loadFixture(
        defaultDeploy,
      );
      const users = [ethers.constants.AddressZero];
      const amounts = [parseEther('0.1')];

      await setRewardsTest(
        {
          arkadaRewarderContract,
          owner,
          users,
          amounts,
        },
        { revertMessage: 'ArkadaRewarder__InvalidAddress' },
      );
    });

    it('Should allow operator to add rewards for a user', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0.1');

      await addRewardsTest({
        arkadaRewarderContract,
        owner,
        user: user.address,
        amount,
      });
    });

    it('Should not allow non-operator to add rewards', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0.1');

      await addRewardsTest(
        {
          arkadaRewarderContract,
          owner,
          user: user.address,
          amount,
        },
        { from: user, revertMessage: 'ArkadaRewarder__NotAuthorized' },
      );
    });

    it('Should not allow adding rewards with zero address', async () => {
      const { arkadaRewarderContract, owner } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0.1');

      await addRewardsTest(
        {
          arkadaRewarderContract,
          owner,
          user: ethers.constants.AddressZero,
          amount,
        },
        { revertMessage: 'ArkadaRewarder__InvalidAddress' },
      );
    });

    it('Should not allow adding zero rewards', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0');

      await addRewardsTest(
        {
          arkadaRewarderContract,
          owner,
          user: user.address,
          amount,
        },
        { revertMessage: 'ArkadaRewarder__InvalidAmount' },
      );
    });

    it('Should allow operator to add rewards for multiple users', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address, owner.address];
      const amounts = [parseEther('0.1'), parseEther('0.2')];

      await addRewardsMultipleTest({
        arkadaRewarderContract,
        owner,
        users,
        amounts,
      });
    });

    it('Should not allow non-operator to add rewards for multiple users', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address, owner.address];
      const amounts = [parseEther('0.1'), parseEther('0.2')];

      await addRewardsMultipleTest(
        {
          arkadaRewarderContract,
          owner,
          users,
          amounts,
        },
        { from: user, revertMessage: 'ArkadaRewarder__NotAuthorized' },
      );
    });

    it('Should not allow adding rewards with zero address for multiple users', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address, ethers.constants.AddressZero];
      const amounts = [parseEther('0.1'), parseEther('0.2')];

      await addRewardsMultipleTest(
        { arkadaRewarderContract, owner, users, amounts },
        { revertMessage: 'ArkadaRewarder__InvalidAddress' },
      );
    });

    it('Should not allow adding zero rewards for multiple users', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const users = [user.address, owner.address];
      const amounts = [parseEther('0'), parseEther('0.2')];

      await addRewardsMultipleTest(
        { arkadaRewarderContract, owner, users, amounts },
        { revertMessage: 'ArkadaRewarder__InvalidAmount' },
      );
    });
  });

  describe('Reward Claims', () => {
    it('Should allow user to claim their rewards', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0.1');

      // Send some ETH to the contract
      await owner.sendTransaction({
        to: arkadaRewarderContract.address,
        value: parseEther('1'),
      });

      // First add some rewards
      await addRewardsTest({
        arkadaRewarderContract,
        owner,
        user: user.address,
        amount,
      });

      // Then claim them
      await claimRewardTest({
        arkadaRewarderContract,
        owner,
        user,
      });
    });

    it('Should not allow user to claim their rewards if contract has no balance', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0.1');

      // First add some rewards
      await addRewardsTest({
        arkadaRewarderContract,
        owner,
        user: user.address,
        amount,
      });

      // Then claim them
      await claimRewardTest(
        {
          arkadaRewarderContract,
          owner,
          user,
        },
        { revertMessage: 'ArkadaRewarder__TransferFailed' },
      );
    });

    it('Should not allow claiming zero rewards', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );

      await claimRewardTest(
        {
          arkadaRewarderContract,
          owner,
          user,
        },
        { revertMessage: 'ArkadaRewarder__NoRewardsToClaim' },
      );
    });

    it('Should not allow non-reward owner to claim rewards', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );
      const amount = parseEther('0.1');

      // First add some rewards
      await addRewardsTest({
        arkadaRewarderContract,
        owner,
        user: user.address,
        amount,
      });

      // Try to claim with different user
      await claimRewardTest(
        {
          arkadaRewarderContract,
          owner,
          user: owner,
        },
        { revertMessage: 'ArkadaRewarder__NoRewardsToClaim' },
      );
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds', async () => {
      const { arkadaRewarderContract, owner } = await loadFixture(
        defaultDeploy,
      );

      // Send some ETH to the contract
      await owner.sendTransaction({
        to: arkadaRewarderContract.address,
        value: parseEther('0.1'),
      });

      await withdrawTest({
        arkadaRewarderContract,
        owner,
      });
    });

    it('Should not allow non-owner to withdraw funds', async () => {
      const { arkadaRewarderContract, owner, user } = await loadFixture(
        defaultDeploy,
      );

      // Send some ETH to the contract
      await owner.sendTransaction({
        to: arkadaRewarderContract.address,
        value: parseEther('0.1'),
      });

      await withdrawTest(
        {
          arkadaRewarderContract,
          owner,
        },
        { from: user, revertMessage: 'AccessControlUnauthorizedAccount' },
      );
    });

    it('Should not allow withdrawing zero balance', async () => {
      const { arkadaRewarderContract, owner } = await loadFixture(
        defaultDeploy,
      );

      await withdrawTest(
        {
          arkadaRewarderContract,
          owner,
        },
        { revertMessage: 'ArkadaRewarder__NoBalanceToWithdraw' },
      );
    });
  });
});
