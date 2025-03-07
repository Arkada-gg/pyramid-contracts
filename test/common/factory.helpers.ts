import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { Factory } from '../../typechain-types';
import { OptionalCommonParams } from './common.helpers';

type CommonParams = {
  factoryContract: Factory;
  owner: SignerWithAddress;
};

interface ICreateEscrowTest extends CommonParams {
  questId: number;
  admin: string;
  whitelistedTokens: string[];
  treasury: string;
}
export const createEscrowTest = async (
  {
    factoryContract,
    owner,
    questId,
    admin,
    whitelistedTokens,
    treasury,
  }: ICreateEscrowTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      factoryContract
        .connect(sender)
        .createEscrow(questId, admin, whitelistedTokens, treasury),
    ).revertedWithCustomError(factoryContract, opt?.revertMessage);
    return;
  }

  await expect(
    factoryContract
      .connect(sender)
      .createEscrow(questId, admin, whitelistedTokens, treasury),
  )
    .to.emit(factoryContract, 'EscrowRegistered')
    .withArgs(sender.address, await factoryContract.s_escrows(questId), questId)
    .to.not.reverted;

  expect(await factoryContract.s_escrow_admin(questId)).eq(admin);
};

interface IUpdateEscrowAdminTest extends CommonParams {
  questId: number;
  newAdmin: string;
}
export const updateEscrowAdminTest = async (
  { factoryContract, owner, questId, newAdmin }: IUpdateEscrowAdminTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      factoryContract.connect(sender).updateEscrowAdmin(questId, newAdmin),
    ).revertedWithCustomError(factoryContract, opt?.revertMessage);
    return;
  }

  await expect(
    factoryContract.connect(sender).updateEscrowAdmin(questId, newAdmin),
  )
    .to.emit(factoryContract, 'EscrowAdminUpdated')
    .withArgs(sender.address, questId, newAdmin).to.not.reverted;

  expect(await factoryContract.s_escrow_admin(questId)).eq(newAdmin);
};

interface IAddTokenToWhitelistTest extends CommonParams {
  questId: number;
  token: string;
}
export const addTokenToWhitelistTest = async (
  { factoryContract, owner, questId, token }: IAddTokenToWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      factoryContract.connect(sender).addTokenToWhitelist(questId, token),
    ).revertedWithCustomError(factoryContract, opt?.revertMessage);
    return;
  }

  await expect(
    factoryContract.connect(sender).addTokenToWhitelist(questId, token),
  ).to.not.reverted;
};

interface IRemoveTokenFromWhitelistTest extends CommonParams {
  questId: number;
  token: string;
}
export const removeTokenFromWhitelistTest = async (
  { factoryContract, owner, questId, token }: IRemoveTokenFromWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      factoryContract.connect(sender).removeTokenFromWhitelist(questId, token),
    ).revertedWithCustomError(factoryContract, opt?.revertMessage);
    return;
  }

  await expect(
    factoryContract.connect(sender).removeTokenFromWhitelist(questId, token),
  ).to.not.reverted;
};

interface IWithdrawFundsTest extends CommonParams {
  questId: number;
  to: string;
  token: string;
  tokenId: number;
  tokenType: number;
}
export const withdrawFundsTest = async (
  {
    factoryContract,
    owner,
    questId,
    to,
    token,
    tokenId,
    tokenType,
  }: IWithdrawFundsTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      factoryContract
        .connect(sender)
        .withdrawFunds(questId, to, token, tokenId, tokenType),
    ).revertedWithCustomError(factoryContract, opt?.revertMessage);
    return;
  }

  await expect(
    factoryContract
      .connect(sender)
      .withdrawFunds(questId, to, token, tokenId, tokenType),
  )
    .to.emit(factoryContract, 'EscrowWithdrawal')
    .withArgs(
      sender.address,
      to,
      token,
      tokenId,
      BigNumber.from(0),
      tokenType,
      questId,
    ).to.not.reverted;
};

interface IDistributeRewardsTest extends CommonParams {
  questId: number;
  token: string;
  to: string;
  amount: BigNumber;
  rewardTokenId: number;
  tokenType: number;
  rakeBps: number;
}
export const distributeRewardsTest = async (
  {
    factoryContract,
    owner,
    questId,
    token,
    to,
    amount,
    rewardTokenId,
    tokenType,
    rakeBps,
  }: IDistributeRewardsTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      factoryContract
        .connect(sender)
        .distributeRewards(
          questId,
          token,
          to,
          amount,
          rewardTokenId,
          tokenType,
          rakeBps,
        ),
    ).revertedWithCustomError(factoryContract, opt?.revertMessage);
    return;
  }

  await expect(
    factoryContract
      .connect(sender)
      .distributeRewards(
        questId,
        token,
        to,
        amount,
        rewardTokenId,
        tokenType,
        rakeBps,
      ),
  )
    .to.emit(factoryContract, 'TokenPayout')
    .withArgs(to, token, rewardTokenId, amount, tokenType, questId).to.not
    .reverted;
};
