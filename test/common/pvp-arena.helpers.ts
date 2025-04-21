import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish, ethers } from 'ethers';

import { OptionalCommonParams } from './common.helpers';

import { ArkadaPVPArena } from '../../typechain-types';

export enum ArenaType {
  TIME,
  PLACES,
}

export interface MinMax {
  min: BigNumberish;
  max: BigNumberish;
}

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

interface ISetPlayersConfigTest extends CommonParams {
  newConfig: MinMax;
}
export const setPlayersConfigTest = async (
  { arenaContract, owner, newConfig }: ISetPlayersConfigTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).setPlayersConfig(newConfig),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(
    arenaContract.connect(sender).setPlayersConfig(newConfig),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['PlayersConfigSet(address,uint256,uint256)']
      .name,
  ).to.not.reverted;

  const playersConfig = await arenaContract.playersConfig();
  expect(playersConfig.min).eq(newConfig.min);
  expect(playersConfig.max).eq(newConfig.max);
};

interface ISetIntervalToStartConfigTest extends CommonParams {
  newConfig: MinMax;
}
export const setIntervalToStartConfigTest = async (
  { arenaContract, owner, newConfig }: ISetIntervalToStartConfigTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).setIntervalToStartConfig(newConfig),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(
    arenaContract.connect(sender).setIntervalToStartConfig(newConfig),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events[
      'IntervalToStartConfigSet(address,uint256,uint256)'
    ].name,
  ).to.not.reverted;

  const intervalConfig = await arenaContract.intervalToStartConfig();
  expect(intervalConfig.min).eq(newConfig.min);
  expect(intervalConfig.max).eq(newConfig.max);
};

interface ISetDurationConfigTest extends CommonParams {
  newConfig: MinMax;
}
export const setDurationConfigTest = async (
  { arenaContract, owner, newConfig }: ISetDurationConfigTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).setDurationConfig(newConfig),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  await expect(
    arenaContract.connect(sender).setDurationConfig(newConfig),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['DurationConfigSet(address,uint256,uint256)']
      .name,
  ).to.not.reverted;

  const durationConfig = await arenaContract.durationConfig();
  expect(durationConfig.min).eq(newConfig.min);
  expect(durationConfig.max).eq(newConfig.max);
};

interface ICreateArenaTest extends CommonParams {
  type: ArenaType;
  entryFee: BigNumberish;
  duration: BigNumberish;
  startTime: BigNumberish;
  requiredPlayers: BigNumberish;
  signatured?: boolean;
}
export const createArenaTest = async (
  {
    arenaContract,
    owner,
    type,
    duration,
    entryFee,
    requiredPlayers,
    signatured,
    startTime,
  }: ICreateArenaTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract
        .connect(sender)
        .createArena(
          type,
          entryFee,
          duration,
          startTime,
          requiredPlayers,
          signatured ?? false,
        ),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const arenaId = await arenaContract
    .connect(sender)
    .callStatic.createArena(
      type,
      entryFee,
      duration,
      startTime,
      requiredPlayers,
      signatured ?? false,
    );

  await expect(
    arenaContract
      .connect(sender)
      .createArena(
        type,
        entryFee,
        duration,
        startTime,
        requiredPlayers,
        signatured ?? false,
      ),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['ArenaCreated(uint256,address,uint8,bool)']
      .name,
  ).to.not.reverted;

  const arenaData = await arenaContract.arenas(arenaId);

  expect(arenaData.id).eq(arenaId);
  expect(arenaData.creator).eq(sender.address);
  expect(arenaData.entryFee).eq(entryFee);
  expect(arenaData.duration).eq(duration);
  expect(arenaData.startTime).eq(startTime);
  expect(arenaData.endTime).eq(
    type === ArenaType.PLACES ? 0 : Number(startTime) + Number(duration),
  );
  expect(arenaData.arenaType).eq(type);
  expect(arenaData.requiredPlayers).eq(requiredPlayers);
  expect(arenaData.players).eq(0);
  expect(arenaData.signatured).eq(signatured);
};

interface IJoinArenaTest extends CommonParams {
  arenaId: BigNumberish;
  value: BigNumberish;
}
export const joinArenaTest = async (
  { arenaContract, owner, arenaId, value }: IJoinArenaTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender)['joinArena(uint256)'](arenaId, { value }),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const arenaDataBefore = await arenaContract.arenas(arenaId);
  const feeByArenaBefore = await arenaContract.feesByArena(arenaId);

  await expect(
    arenaContract.connect(sender)['joinArena(uint256)'](arenaId, { value }),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['PlayerJoined(uint256,address)'].name,
  ).to.not.reverted;

  const arenaDataAfter = await arenaContract.arenas(arenaId);
  const feeByArenaAfter = await arenaContract.feesByArena(arenaId);

  expect(arenaDataAfter.players).eq(arenaDataBefore.players.add(1));

  if (arenaDataAfter.players.eq(arenaDataAfter.requiredPlayers)) {
    expect(arenaDataAfter.startTime).gt(arenaDataBefore.startTime);
    expect(arenaDataAfter.endTime).gt(arenaDataBefore.endTime);
  }

  const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
    ['bytes32', 'address'],
    [ethers.utils.solidityKeccak256(['uint256'], [arenaId]), sender.address],
  );
  expect(await arenaContract.participants(arenaIdAndAddressHash)).eq(true);

  expect(feeByArenaAfter).eq(feeByArenaBefore.add(value));
};

interface IJoinArenaWithSignatureTest extends CommonParams {
  arenaId: BigNumberish;
  player: SignerWithAddress;
  nonce: BigNumberish;
  signer: SignerWithAddress;
}

export const joinArenaWithSignatureTest = async (
  {
    arenaContract,
    arenaId,
    player,
    nonce,
    signer,
  }: IJoinArenaWithSignatureTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? player;
  const domain = {
    name: 'ArenaPVP',
    version: '1',
    chainId: 31337, // Hardhat default chainId
    verifyingContract: arenaContract.address,
  };

  const types = {
    JoinData: [
      { name: 'arenaId', type: 'uint256' },
      { name: 'player', type: 'address' },
      { name: 'nonce', type: 'uint256' },
    ],
  };

  const value = {
    arenaId,
    player: player.address,
    nonce,
  };

  const signature = await signer._signTypedData(domain, types, value);

  if (opt?.revertMessage) {
    await expect(
      arenaContract
        .connect(sender)
        ['joinArena((uint256,address,uint256),bytes)'](
          { arenaId, player: player.address, nonce },
          signature,
        ),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const arenaDataBefore = await arenaContract.arenas(arenaId);
  const feeByArenaBefore = await arenaContract.feesByArena(arenaId);

  await expect(
    arenaContract
      .connect(sender)
      ['joinArena((uint256,address,uint256),bytes)'](
        { arenaId, player: player.address, nonce },
        signature,
      ),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['PlayerJoined(uint256,address)'].name,
  ).to.not.reverted;

  const arenaDataAfter = await arenaContract.arenas(arenaId);
  const feeByArenaAfter = await arenaContract.feesByArena(arenaId);

  expect(arenaDataAfter.players).eq(arenaDataBefore.players.add(1));

  if (arenaDataAfter.players.eq(arenaDataAfter.requiredPlayers)) {
    expect(arenaDataAfter.startTime).gt(arenaDataBefore.startTime);
    expect(arenaDataAfter.endTime).gt(arenaDataBefore.endTime);
  }

  const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
    ['bytes32', 'address'],
    [ethers.utils.solidityKeccak256(['uint256'], [arenaId]), player.address],
  );
  expect(await arenaContract.participants(arenaIdAndAddressHash)).eq(true);

  // Free join with signature doesn't increase fees
  expect(feeByArenaAfter).eq(feeByArenaBefore);
};
