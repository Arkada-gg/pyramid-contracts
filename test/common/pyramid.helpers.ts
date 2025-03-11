import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { IMintPyramidData, OptionalCommonParams } from './common.helpers';

import { Pyramid } from '../../typechain-types';

type CommonParams = {
  pyramidContract: Pyramid;
  owner: SignerWithAddress;
};

interface ISetIsMintingActiveTest extends CommonParams {
  isActive: boolean;
}
export const setIsMintingActiveTest = async (
  { pyramidContract, owner, isActive }: ISetIsMintingActiveTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).setIsMintingActive(isActive),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(
    pyramidContract.connect(sender).setIsMintingActive(isActive),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events['MintingSwitch(bool)'].name,
  ).to.not.reverted;

  expect(await pyramidContract.s_isMintingActive()).eq(isActive);
};

interface ISetTreasuryTest extends CommonParams {
  treasury: string;
}
export const setTreasuryTest = async (
  { pyramidContract, owner, treasury }: ISetTreasuryTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).setTreasury(treasury),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(pyramidContract.connect(sender).setTreasury(treasury)).to.emit(
    pyramidContract,
    pyramidContract.interface.events['UpdatedTreasury(address)'].name,
  ).to.not.reverted;

  expect(await pyramidContract.s_treasury()).eq(treasury);
};

export const withdrawTest = async (
  { pyramidContract, owner }: CommonParams,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).withdraw(),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  const balanceBefore = await pyramidContract.provider.getBalance(
    sender.address,
  );

  await expect(pyramidContract.connect(sender).withdraw()).to.emit(
    pyramidContract,
    pyramidContract.interface.events['ContractWithdrawal(uint256)'].name,
  ).to.not.reverted;

  const balanceAfter = await pyramidContract.provider.getBalance(
    sender.address,
  );
  expect(balanceAfter).gt(balanceBefore);
};

interface IMintPyramidTest extends CommonParams {
  data: IMintPyramidData;
  signature: string;
  value?: BigNumber;
}
export const mintPyramidTest = async (
  { pyramidContract, owner, data, signature, value }: IMintPyramidTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).mintPyramid(data, signature, { value }),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(
    pyramidContract.connect(sender).mintPyramid(data, signature, { value }),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events[
      'PyramidClaim(string,uint256,address,uint256,uint256,uint256,string,string)'
    ].name,
  ).to.not.reverted;
};

interface ISetArkadaRewarderTest extends CommonParams {
  arkadaRewarder: string;
}
export const setArkadaRewarderTest = async (
  { pyramidContract, owner, arkadaRewarder }: ISetArkadaRewarderTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).setArkadaRewarder(arkadaRewarder),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(
    pyramidContract.connect(sender).setArkadaRewarder(arkadaRewarder),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events['UpdatedArkadaRewarder(address)'].name,
  ).to.not.reverted;

  expect(await pyramidContract.s_arkadaRewarder()).eq(arkadaRewarder);
};
