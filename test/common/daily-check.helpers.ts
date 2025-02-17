import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import { OptionalCommonParams } from './common.helpers';
import { DailyCheck } from '../../typechain-types';

type CommonParamsCheckTest = {
  dailyCheckContract: DailyCheck;
  owner: SignerWithAddress;
  expected: {
    streak: number
  }
};

export const checkTest = async (
  { dailyCheckContract, owner, expected }: CommonParamsCheckTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      dailyCheckContract
        .connect(sender)
        .check(),
    ).revertedWith(opt?.revertMessage);
    return;
  }

  await expect(
    dailyCheckContract
      .connect(sender)
      .check(),
  ).to.emit(
    dailyCheckContract,
    dailyCheckContract.interface.events['DailyCheck(address,uint256,uint256)'].name,
  ).to.not.reverted;

  const postData = await dailyCheckContract.checkDatas(sender.address)

  expect(+postData.streak).eq(expected.streak)
};