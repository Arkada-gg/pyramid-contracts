import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { OptionalCommonParams } from './common.helpers';

import { Escrow, GlobalEscrow } from '../../typechain-types';

type CommonParams = {
  escrowContract: Escrow | GlobalEscrow;
  owner: SignerWithAddress;
};

interface IAddTokenToWhitelistTest extends CommonParams {
  token: string;
}
export const addTokenToWhitelistTest = async (
  { escrowContract, owner, token }: IAddTokenToWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      escrowContract.connect(sender).addTokenToWhitelist(token),
    ).revertedWithCustomError(escrowContract, opt?.revertMessage);
    return;
  }

  await expect(escrowContract.connect(sender).addTokenToWhitelist(token))
    .to.emit(escrowContract, 'TokenWhitelisted')
    .withArgs(token).to.not.reverted;

  expect(await escrowContract.s_whitelistedTokens(token)).eq(true);
};

interface IRemoveTokenFromWhitelistTest extends CommonParams {
  token: string;
}
export const removeTokenFromWhitelistTest = async (
  { escrowContract, owner, token }: IRemoveTokenFromWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      escrowContract.connect(sender).removeTokenFromWhitelist(token),
    ).revertedWithCustomError(escrowContract, opt?.revertMessage);
    return;
  }

  await expect(escrowContract.connect(sender).removeTokenFromWhitelist(token))
    .to.emit(escrowContract, 'TokenRemovedFromWhitelist')
    .withArgs(token).to.not.reverted;

  expect(await escrowContract.s_whitelistedTokens(token)).eq(false);
};

interface IWithdrawERC20Test extends CommonParams {
  token: string;
  to: string;
  amount: BigNumber;
  rakeBps: number;
}
export const withdrawERC20Test = async (
  { escrowContract, owner, token, to, amount, rakeBps }: IWithdrawERC20Test,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      escrowContract.connect(sender).withdrawERC20(token, to, amount, rakeBps),
    ).revertedWithCustomError(escrowContract, opt?.revertMessage);
    return;
  }

  const rake = amount.mul(rakeBps).div(10000);

  await expect(
    escrowContract.connect(sender).withdrawERC20(token, to, amount, rakeBps),
  )
    .to.emit(escrowContract, 'EscrowERC20Transfer')
    .withArgs(token, to, amount, rake, await escrowContract.i_treasury()).to.not
    .reverted;
};

interface IWithdrawERC721Test extends CommonParams {
  token: string;
  to: string;
  tokenId: number;
}
export const withdrawERC721Test = async (
  { escrowContract, owner, token, to, tokenId }: IWithdrawERC721Test,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      escrowContract.connect(sender).withdrawERC721(token, to, tokenId),
    ).revertedWithCustomError(escrowContract, opt?.revertMessage);
    return;
  }

  await expect(
    escrowContract.connect(sender).withdrawERC721(token, to, tokenId),
  )
    .to.emit(escrowContract, 'EscrowERC721Transfer')
    .withArgs(token, to, tokenId).to.not.reverted;
};

interface IWithdrawERC1155Test extends CommonParams {
  token: string;
  to: string;
  amount: BigNumber;
  tokenId: number;
}
export const withdrawERC1155Test = async (
  { escrowContract, owner, token, to, amount, tokenId }: IWithdrawERC1155Test,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      escrowContract
        .connect(sender)
        .withdrawERC1155(token, to, amount, tokenId),
    ).revertedWithCustomError(escrowContract, opt?.revertMessage);
    return;
  }

  await expect(
    escrowContract.connect(sender).withdrawERC1155(token, to, amount, tokenId),
  )
    .to.emit(escrowContract, 'EscrowERC1155Transfer')
    .withArgs(token, to, amount, tokenId).to.not.reverted;
};

interface IWithdrawNativeTest extends CommonParams {
  to: string;
  amount: BigNumber;
  rakeBps: number;
}
export const withdrawNativeTest = async (
  { escrowContract, owner, to, amount, rakeBps }: IWithdrawNativeTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      escrowContract.connect(sender).withdrawNative(to, amount, rakeBps),
    ).revertedWithCustomError(escrowContract, opt?.revertMessage);
    return;
  }

  const rake = amount.mul(rakeBps).div(10000);

  await expect(
    escrowContract.connect(sender).withdrawNative(to, amount, rakeBps),
  )
    .to.emit(escrowContract, 'EscrowNativeTransfer')
    .withArgs(to, amount, rake, await escrowContract.i_treasury()).to.not
    .reverted;
};
