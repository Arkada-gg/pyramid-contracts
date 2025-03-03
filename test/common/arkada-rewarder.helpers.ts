import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { ArkadaRewarder } from '../../typechain-types';

interface SetOperatorParams {
  arkadaRewarderContract: ArkadaRewarder;
  owner: SignerWithAddress;
  operator: string;
}

interface SetRewardsParams {
  arkadaRewarderContract: ArkadaRewarder;
  owner: SignerWithAddress;
  users: string[];
  amounts: string[];
}

interface ClaimRewardParams {
  arkadaRewarderContract: ArkadaRewarder;
  user: SignerWithAddress;
}

interface TestOptions {
  from?: SignerWithAddress;
  revertMessage?: string;
}

export async function setOperatorTest(
  params: SetOperatorParams,
  options: TestOptions = {},
) {
  const { arkadaRewarderContract, owner, operator } = params;
  const { from, revertMessage } = options;

  const tx = arkadaRewarderContract
    .connect(from || owner)
    .setOperator(operator);

  if (revertMessage) {
    await expect(tx).to.be.revertedWith(revertMessage);
    return;
  }

  const oldOperator = await arkadaRewarderContract.operator();
  await expect(tx)
    .to.emit(arkadaRewarderContract, 'OperatorUpdated')
    .withArgs(oldOperator, operator);

  expect(await arkadaRewarderContract.operator()).to.equal(operator);
}

export async function setRewardsTest(
  params: SetRewardsParams,
  options: TestOptions = {},
) {
  const { arkadaRewarderContract, owner, users, amounts } = params;
  const { from, revertMessage } = options;

  const tx = arkadaRewarderContract.connect(from || owner).setRewards(
    users,
    amounts.map((amount) => ethers.utils.parseEther(amount)),
  );

  if (revertMessage) {
    await expect(tx).to.be.revertedWith(revertMessage);
    return;
  }

  await expect(tx).to.not.reverted;

  for (let i = 0; i < users.length; i++) {
    expect(await arkadaRewarderContract.userRewards(users[i])).to.equal(
      ethers.utils.parseEther(amounts[i]),
    );
  }
}

export async function claimRewardTest(
  params: ClaimRewardParams,
  options: TestOptions = {},
) {
  const { arkadaRewarderContract, user } = params;
  const { revertMessage } = options;

  const initialBalance = await user.getBalance();
  const reward = await arkadaRewarderContract.userRewards(user.address);

  const tx = arkadaRewarderContract.connect(user).claimReward();

  if (revertMessage) {
    await expect(tx).to.be.revertedWith(revertMessage);
    return;
  }

  await expect(tx)
    .to.emit(arkadaRewarderContract, 'RewardsClaimed')
    .withArgs(user.address, reward);

  expect(await arkadaRewarderContract.userRewards(user.address)).to.equal(0);

  const finalBalance = await user.getBalance();
  // Account for gas costs by checking if the difference is close to reward
  expect(finalBalance.sub(initialBalance)).to.be.closeTo(
    reward,
    ethers.utils.parseEther('0.001'), // Allow for gas costs
  );
}
