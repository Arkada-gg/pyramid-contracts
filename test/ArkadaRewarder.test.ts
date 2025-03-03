import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import {
  claimRewardTest,
  setOperatorTest,
  setRewardsTest,
} from './common/arkada-rewarder.helpers';
import { defaultDeploy } from './common/fixtures';

// eslint-disable-next-line camelcase
import { ArkadaRewarder__factory } from '../typechain-types';

const ZeroAddress = ethers.constants.AddressZero;

describe('ArkadaRewarder', function () {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  it('initialize', async () => {
    const { owner } = await loadFixture(defaultDeploy);

    const arkadaRewarder = await new ArkadaRewarder__factory(owner).deploy();
    await arkadaRewarder.initialize(owner.address);

    await expect(arkadaRewarder.initialize(owner.address)).to.be.revertedWith(
      'Initializable: contract is already initialized',
    );
  });

  describe('setOperator()', () => {
    it('should be set', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      await setOperatorTest({
        arkadaRewarderContract: arkadaRewarder,
        owner,
        operator: regularAccounts[0].address,
      });
    });

    it('should be reverted if zero address', async () => {
      const { arkadaRewarder, owner } = await loadFixture(defaultDeploy);

      await setOperatorTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          owner,
          operator: ZeroAddress,
        },
        {
          revertMessage: 'zero address',
        },
      );
    });

    it('should be reverted if sender is not owner', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      await setOperatorTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          owner,
          operator: regularAccounts[1].address,
        },
        {
          from: regularAccounts[0],
          revertMessage: 'Ownable: caller is not the owner',
        },
      );
    });
  });

  describe('setRewards()', () => {
    it('should be set', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      await setRewardsTest({
        arkadaRewarderContract: arkadaRewarder,
        owner,
        users: [regularAccounts[0].address, regularAccounts[1].address],
        amounts: ['1.0', '2.0'],
      });
    });

    it('should be reverted if arrays length mismatch', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      await setRewardsTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          owner,
          users: [regularAccounts[0].address],
          amounts: ['1.0', '2.0'],
        },
        {
          revertMessage: 'arrays length mismatch',
        },
      );
    });

    it('should be reverted if zero address', async () => {
      const { arkadaRewarder, owner } = await loadFixture(defaultDeploy);

      await setRewardsTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          owner,
          users: [ZeroAddress],
          amounts: ['1.0'],
        },
        {
          revertMessage: 'zero address',
        },
      );
    });

    it('should be reverted if sender is not operator or owner', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      await setRewardsTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          owner,
          users: [regularAccounts[1].address],
          amounts: ['1.0'],
        },
        {
          from: regularAccounts[0],
          revertMessage: 'Not authorized',
        },
      );
    });
  });

  describe('claimReward()', () => {
    it('should be claimed', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      // Fund the contract
      await owner.sendTransaction({
        to: arkadaRewarder.address,
        value: ethers.utils.parseEther('10.0'),
      });

      // Set rewards
      await setRewardsTest({
        arkadaRewarderContract: arkadaRewarder,
        owner,
        users: [regularAccounts[0].address],
        amounts: ['1.0'],
      });

      // Claim rewards
      await claimRewardTest({
        arkadaRewarderContract: arkadaRewarder,
        user: regularAccounts[0],
      });
    });

    it('should be reverted if no rewards', async () => {
      const { arkadaRewarder, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      await claimRewardTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          user: regularAccounts[0],
        },
        {
          revertMessage: 'no rewards to claim',
        },
      );
    });

    it('should be reverted if contract has insufficient funds', async () => {
      const { arkadaRewarder, owner, regularAccounts } = await loadFixture(
        defaultDeploy,
      );

      // Set rewards without funding the contract
      await setRewardsTest({
        arkadaRewarderContract: arkadaRewarder,
        owner,
        users: [regularAccounts[0].address],
        amounts: ['1.0'],
      });

      await claimRewardTest(
        {
          arkadaRewarderContract: arkadaRewarder,
          user: regularAccounts[0],
        },
        {
          revertMessage: 'transfer failed',
        },
      );
    });
  });

  describe('receive()', () => {
    it('should receive ETH', async () => {
      const { arkadaRewarder, owner } = await loadFixture(defaultDeploy);

      const amount = ethers.utils.parseEther('1.0');
      await expect(
        owner.sendTransaction({
          to: arkadaRewarder.address,
          value: amount,
        }),
      ).to.changeEtherBalance(arkadaRewarder, amount);
    });
  });
});
