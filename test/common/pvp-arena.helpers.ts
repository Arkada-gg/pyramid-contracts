import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

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
          { value: opt?.value },
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
      { value: opt?.value },
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
        { value: opt?.value },
      ),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['ArenaCreated(uint256,address,uint8,bool)']
      .name,
  ).to.not.reverted;

  const arenaData = await arenaContract.arenas(arenaId);

  const hasAdminRole = await arenaContract.hasRole(
    await arenaContract.ADMIN_ROLE(),
    sender.address,
  );

  expect(arenaData.id).eq(arenaId);
  expect(arenaData.creator).eq(sender.address);
  expect(arenaData.entryFee).eq(entryFee);
  expect(arenaData.duration).eq(duration);
  if (type === ArenaType.TIME) expect(arenaData.startTime).eq(startTime);
  if (type === ArenaType.TIME)
    expect(arenaData.endTime).eq(Number(startTime) + Number(duration));
  expect(arenaData.arenaType).eq(type);
  expect(arenaData.requiredPlayers).eq(requiredPlayers);
  expect(arenaData.players).eq(hasAdminRole ? 0 : 1);
  expect(arenaData.initialPrizePool).eq(
    hasAdminRole
      ? opt?.value ?? 0
      : BigNumber.from(opt?.value ?? 0).sub(arenaData.entryFee),
  );
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
  const senderBalanceBefore = await sender.getBalance();

  await expect(
    arenaContract.connect(sender)['joinArena(uint256)'](arenaId, { value }),
  ).to.emit(
    arenaContract,
    arenaContract.interface.events['PlayerJoined(uint256,address)'].name,
  ).to.not.reverted;

  const arenaDataAfter = await arenaContract.arenas(arenaId);
  const feeByArenaAfter = await arenaContract.feesByArena(arenaId);
  const senderBalanceAfter = await sender.getBalance();

  expect(senderBalanceAfter).eq(senderBalanceBefore.sub(value));
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
  freeFromFee: boolean;
  discountBps: BigNumberish;
  nonce: BigNumberish;
  signer: SignerWithAddress;
}

export const joinArenaWithSignatureTest = async (
  {
    arenaContract,
    arenaId,
    player,
    freeFromFee,
    discountBps,
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
      { name: 'freeFromFee', type: 'bool' },
      { name: 'discountBps', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
  };

  const value = {
    arenaId,
    player: player.address,
    freeFromFee,
    discountBps,
    nonce,
  };

  const signature = await signer._signTypedData(domain, types, value);

  if (opt?.revertMessage) {
    await expect(
      arenaContract
        .connect(sender)
        ['joinArena((uint256,address,bool,uint256,uint256),bytes)'](
          { arenaId, player: player.address, freeFromFee, discountBps, nonce },
          signature,
          { value: opt?.value },
        ),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const arenaDataBefore = await arenaContract.arenas(arenaId);
  const feeByArenaBefore = await arenaContract.feesByArena(arenaId);

  await expect(
    arenaContract
      .connect(sender)
      ['joinArena((uint256,address,bool,uint256,uint256),bytes)'](
        { arenaId, player: player.address, freeFromFee, discountBps, nonce },
        signature,
        { value: opt?.value },
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
  if (freeFromFee) expect(feeByArenaAfter).eq(feeByArenaBefore);
  if (!freeFromFee) {
    const discount = arenaDataAfter.entryFee.mul(discountBps).div(10000);
    expect(feeByArenaAfter).eq(
      feeByArenaBefore.add(arenaDataAfter.entryFee.sub(discount)),
    );
  }
};

interface ILeaveArenaTest extends CommonParams {
  arenaId: BigNumberish;
}

export const leaveArenaTest = async (
  { arenaContract, owner, arenaId }: ILeaveArenaTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).leaveArena(arenaId),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const arenaDataBefore = await arenaContract.arenas(arenaId);
  const feeByArenaBefore = await arenaContract.feesByArena(arenaId);
  const senderBalanceBefore = await sender.getBalance();

  // Calculate the hash for participant mapping
  const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
    ['bytes32', 'address'],
    [ethers.utils.solidityKeccak256(['uint256'], [arenaId]), sender.address],
  );

  // Check participant status before leaving
  expect(await arenaContract.participants(arenaIdAndAddressHash)).to.equal(
    true,
  );

  // Leave arena
  const leaveTx = await arenaContract.connect(sender).leaveArena(arenaId);
  const receipt = await leaveTx.wait();
  const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

  // Check event emission
  await expect(leaveTx)
    .to.emit(
      arenaContract,
      arenaContract.interface.events['PlayerLeft(uint256,address)'].name,
    )
    .withArgs(arenaId, sender.address);

  if (arenaDataBefore.players.eq(1)) {
    // If this was the last player, the arena should be deleted
    const arenaDataAfter = await arenaContract.arenas(arenaId);
    expect(arenaDataAfter.id).to.equal(0);

    // Check ArenaDeleted event
    await expect(leaveTx)
      .to.emit(
        arenaContract,
        arenaContract.interface.events['ArenaDeleted(uint256)'].name,
      )
      .withArgs(arenaId);
  } else {
    // Check that player count has decreased
    const arenaDataAfter = await arenaContract.arenas(arenaId);
    expect(arenaDataAfter.players).to.equal(arenaDataBefore.players.sub(1));
  }

  const paidForEntry = await arenaContract.paidForParticipate(
    arenaIdAndAddressHash,
  );

  // Fees should be decreased by the entry fee
  const feeByArenaAfter = await arenaContract.feesByArena(arenaId);
  expect(feeByArenaAfter).to.equal(feeByArenaBefore.sub(paidForEntry));

  // Player should be refunded with the entry fee
  const senderBalanceAfter = await sender.getBalance();
  expect(senderBalanceAfter).to.be.closeTo(
    senderBalanceBefore.add(paidForEntry).sub(gasCost),
    1000, // Allow for a small rounding error
  );

  // Player should no longer be a participant
  expect(await arenaContract.participants(arenaIdAndAddressHash)).to.equal(
    false,
  );
};

interface IEndArenaTest extends CommonParams {
  arenaId: BigNumberish;
  root: string;
}

export const endArenaAndDistributeRewardsTest = async (
  { arenaContract, owner, arenaId, root }: IEndArenaTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).endArenaAndDistributeRewards(arenaId, root),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const feesByArena = await arenaContract.feesByArena(arenaId);
  const arena = await arenaContract.arenas(arenaId);

  const treasuryBalanceBefore = await ethers.provider.getBalance(
    await arenaContract.treasury(),
  );
  const feeBPS = await arenaContract.feeBPS();

  const amountToTreasury = feesByArena.gt(arena.initialPrizePool)
    ? arena.initialPrizePool
    : feesByArena;

  const amountForFees = feesByArena.lt(arena.initialPrizePool)
    ? arena.initialPrizePool
    : feesByArena;

  // Calculate expected fee amount
  const feeAmount = amountForFees.mul(feeBPS).div(10000);

  // End arena and distribute rewards
  const tx = await arenaContract
    .connect(sender)
    .endArenaAndDistributeRewards(arenaId, root);

  // Check event emission
  await expect(tx)
    .to.emit(
      arenaContract,
      arenaContract.interface.events['ArenaEnded(uint256,bytes32)'].name,
    )
    .withArgs(arenaId, root);

  // Root proof should be set
  expect(await arenaContract.rootProofByArena(arenaId)).to.equal(root);

  // Treasury should receive fee
  const treasuryBalanceAfter = await ethers.provider.getBalance(
    await arenaContract.treasury(),
  );
  expect(treasuryBalanceAfter).to.equal(
    treasuryBalanceBefore.add(feeAmount).add(amountToTreasury),
  );
};

interface IClaimRewardsTest extends CommonParams {
  arenaId: BigNumberish;
  amount: BigNumberish;
  proofs: string[];
}

export const claimRewardsTest = async (
  { arenaContract, owner, arenaId, amount, proofs }: IClaimRewardsTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arenaContract.connect(sender).claimRewards(arenaId, amount, proofs),
    ).revertedWithCustomError(arenaContract, opt?.revertMessage);
    return;
  }

  const senderBalanceBefore = await sender.getBalance();

  // Calculate the hash for participant and claimed mappings
  const arenaIdHash = ethers.utils.solidityKeccak256(['uint256'], [arenaId]);
  const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
    ['bytes32', 'address'],
    [arenaIdHash, sender.address],
  );

  // Check claimed status before claiming
  expect(await arenaContract.claimed(arenaIdAndAddressHash)).to.equal(false);

  // Claim rewards
  const claimTx = await arenaContract
    .connect(sender)
    .claimRewards(arenaId, amount, proofs);
  const receipt = await claimTx.wait();
  const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

  // Check event emission
  await expect(claimTx)
    .to.emit(
      arenaContract,
      arenaContract.interface.events['RewardsClaimed(uint256,address,uint256)']
        .name,
    )
    .withArgs(arenaId, sender.address, amount);

  // Participant status should be false
  expect(await arenaContract.participants(arenaIdAndAddressHash)).to.equal(
    false,
  );

  // Claimed status should be true
  expect(await arenaContract.claimed(arenaIdAndAddressHash)).to.equal(true);

  // Player should receive the reward amount
  const senderBalanceAfter = await sender.getBalance();
  expect(senderBalanceAfter).to.be.closeTo(
    senderBalanceBefore.add(amount).sub(gasCost),
    1000, // Allow for a small rounding error
  );
};
