import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import { OptionalCommonParams } from './common.helpers';

import { BigNumberish } from 'ethers';
import { ArkadaPVPArena } from '../../typechain-types';

type CommonParams = {
  arenaContract: ArkadaPVPArena;
  owner: SignerWithAddress;
};

interface ISetTreasuryTest extends CommonParams {
  newTreasuryAddress: string;
}
export const setTreasuryTest = async (
  { arenaContract, owner, newTreasuryAddress }: ISetTreasuryTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).setTreasury(newTreasuryAddress),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(
    arenaContract.connect(sender).setTreasury(newTreasuryAddress),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['TreasurySet(address,address)'].name,
  ).to.not.reverted;

  expect(await arenaContract.treasury()).eq(newTreasuryAddress);
};

interface ISetFeeBPSTest extends CommonParams {
  newFeeBPS: BigNumberish;
}
export const setFeeBPSTest = async (
  { arenaContract, owner, newFeeBPS }: ISetFeeBPSTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).setFeeBPS(newFeeBPS),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(arenaContract.connect(sender).setFeeBPS(newFeeBPS)).to.emit(
    arenaContract,
    arenaContract.interface.events['FeeBpsSet(address,uint16)'].name,
  ).to.not.reverted;

  expect(await arenaContract.feeBPS()).eq(newFeeBPS);
};

interface ISetMinPlayersCountTest extends CommonParams {
  newMinPlayersCount: BigNumberish;
}
export const setMinPlayersCountTest = async (
  { arenaContract, owner, newMinPlayersCount }: ISetMinPlayersCountTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).setMinPlayersCount(newMinPlayersCount),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(
    arenaContract.connect(sender).setMinPlayersCount(newMinPlayersCount),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['MinPlayersCountSet(address,uint256)'].name,
  ).to.not.reverted;

  expect(await arenaContract.minPlayersCount()).eq(newMinPlayersCount);
};

interface ISetMinIntervalToStartTest extends CommonParams {
  newMinIntervalToStart: BigNumberish;
}
export const setMinIntervalToStartTest = async (
  { arenaContract, owner, newMinIntervalToStart }: ISetMinIntervalToStartTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract
        .connect(sender)
        .setMinIntervalToStart(newMinIntervalToStart),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(
    arenaContract.connect(sender).setMinIntervalToStart(newMinIntervalToStart),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['MinIntervalToStartSet(address,uint256)']
      .name,
  ).to.not.reverted;

  expect(await arenaContract.minIntervalToStart()).eq(newMinIntervalToStart);
};
