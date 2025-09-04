import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { OptionalCommonParams } from './common.helpers';

import { GlobalEscrow } from '../../typechain-types';

type CommonParams = {
  globalEscrow: GlobalEscrow;
  owner: SignerWithAddress;
};

interface IAddTokenToWhitelistTest extends CommonParams {
  token: string;
}
export const addTokenToWhitelistTest = async (
  { globalEscrow, owner, token }: IAddTokenToWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      globalEscrow.connect(sender).addTokenToWhitelist(token),
    ).revertedWithCustomError(globalEscrow, opt?.revertMessage);
    return;
  }

  await expect(globalEscrow.connect(sender).addTokenToWhitelist(token)).to.not
    .reverted;
};

interface IRemoveTokenFromWhitelistTest extends CommonParams {
  token: string;
}
export const removeTokenFromWhitelistTest = async (
  { globalEscrow, owner, token }: IRemoveTokenFromWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      globalEscrow.connect(sender).removeTokenFromWhitelist(token),
    ).revertedWithCustomError(globalEscrow, opt?.revertMessage);
    return;
  }

  await expect(globalEscrow.connect(sender).removeTokenFromWhitelist(token)).to
    .not.reverted;
};

interface IWithdrawFundsTest extends CommonParams {
  to: string;
  token: string;
  tokenId: number;
  tokenType: number;
}
export const withdrawFundsTest = async (
  { globalEscrow, owner, to, token, tokenId, tokenType }: IWithdrawFundsTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      globalEscrow.connect(sender).withdrawFunds(to, token, tokenId, tokenType),
    ).revertedWithCustomError(globalEscrow, opt?.revertMessage);
    return;
  }

  await expect(
    globalEscrow.connect(sender).withdrawFunds(to, token, tokenId, tokenType),
  ).to.not.reverted;
};

interface IDistributeRewardsTest extends CommonParams {
  token: string;
  to: string;
  amount: BigNumber;
  rewardTokenId: number;
  tokenType: number;
  rakeBps: number;
}
export const distributeRewardsTest = async (
  {
    globalEscrow,
    owner,
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
      globalEscrow
        .connect(sender)
        .distributeRewards(
          token,
          to,
          amount,
          rewardTokenId,
          tokenType,
          rakeBps,
        ),
    ).revertedWithCustomError(globalEscrow, opt?.revertMessage);
    return;
  }

  await expect(
    globalEscrow
      .connect(sender)
      .distributeRewards(token, to, amount, rewardTokenId, tokenType, rakeBps),
  ).to.not.reverted;
};
