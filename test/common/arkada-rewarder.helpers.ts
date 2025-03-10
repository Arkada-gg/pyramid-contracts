import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { OptionalCommonParams } from './common.helpers';

import { ArkadaRewarder } from '../../typechain-types';

type CommonParams = {
  arkadaRewarderContract: ArkadaRewarder;
  owner: SignerWithAddress;
};

interface ISetRewardsTest extends CommonParams {
  users: string[];
  amounts: BigNumber[];
}
export const setRewardsTest = async (
  {
    arkadaRewarderContract: rewarderContract,
    owner,
    users,
    amounts,
  }: ISetRewardsTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      rewarderContract.connect(sender).setRewards(users, amounts),
    ).revertedWithCustomError(rewarderContract, opt?.revertMessage);
    return;
  }

  await expect(
    rewarderContract.connect(sender).setRewards(users, amounts),
  ).to.emit(rewarderContract, 'RewardsSet').to.not.reverted;

  for (let i = 0; i < users.length; i++) {
    expect(await rewarderContract.userRewards(users[i])).eq(amounts[i]);
  }
};

interface IAddRewardsTest extends CommonParams {
  user: string;
  amount: BigNumber;
}
export const addRewardsTest = async (
  {
    arkadaRewarderContract: rewarderContract,
    owner,
    user,
    amount,
  }: IAddRewardsTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      rewarderContract.connect(sender).addRewards(user, amount),
    ).revertedWithCustomError(rewarderContract, opt?.revertMessage);
    return;
  }

  const rewardsBefore = await rewarderContract.userRewards(user);

  await expect(
    rewarderContract.connect(sender).addRewards(user, amount),
  ).to.emit(rewarderContract, 'RewardsAdded').to.not.reverted;

  expect(await rewarderContract.userRewards(user)).eq(
    rewardsBefore.add(amount),
  );
};

interface IClaimRewardTest extends CommonParams {
  user: SignerWithAddress;
}
export const claimRewardTest = async (
  { arkadaRewarderContract: rewarderContract, user }: IClaimRewardTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? user;

  if (opt?.revertMessage) {
    await expect(
      rewarderContract.connect(sender).claimReward(),
    ).revertedWithCustomError(rewarderContract, opt?.revertMessage);
    return;
  }

  const balanceBefore = await user.getBalance();

  await expect(rewarderContract.connect(sender).claimReward()).to.emit(
    rewarderContract,
    'RewardsClaimed',
  ).to.not.reverted;

  expect(await rewarderContract.userRewards(user.address)).eq(0);
  expect(await user.getBalance()).gt(balanceBefore);
};

export const withdrawTest = async (
  { arkadaRewarderContract: rewarderContract, owner }: CommonParams,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      rewarderContract.connect(sender).withdraw(),
    ).revertedWithCustomError(rewarderContract, opt?.revertMessage);
    return;
  }

  const balanceBefore = await owner.getBalance();

  await expect(rewarderContract.connect(sender).withdraw()).to.not.reverted;

  expect(await owner.getBalance()).gt(balanceBefore);
};
