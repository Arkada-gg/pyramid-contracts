import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { IMintPyramidEscrowData, OptionalCommonParams } from './common.helpers';

import { PyramidEscrow } from '../../typechain-types';
import { PyramidV2Escrow } from '../../typechain-types/contracts/upgrades/PyramidV2Escrow';

type CommonParams = {
  pyramidEscrowContract: PyramidEscrow | PyramidV2Escrow;
  owner: SignerWithAddress;
};

interface ISetIsMintingActiveTest extends CommonParams {
  isActive: boolean;
}
export const setIsMintingActiveTest = async (
  {
    pyramidEscrowContract: pyramidContract,
    owner,
    isActive,
  }: ISetIsMintingActiveTest,
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
  { pyramidEscrowContract: pyramidContract, owner, treasury }: ISetTreasuryTest,
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
  { pyramidEscrowContract: pyramidContract, owner }: CommonParams,
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
  data: IMintPyramidEscrowData;
  signature: string;
  value?: BigNumber;
}
export const mintPyramidTest = async (
  {
    pyramidEscrowContract: pyramidContract,
    owner,
    data,
    signature,
    value,
  }: IMintPyramidTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).mintPyramid(data, signature, { value }),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  // await pyramidContract.connect(sender).mintPyramid(data, signature, { value })

  await expect(
    pyramidContract.connect(sender).mintPyramid(data, signature, { value }),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events[
      'PyramidClaim(string,uint256,address,uint256,uint256,uint256,string,string)'
    ].name,
  ).to.not.reverted;
};
