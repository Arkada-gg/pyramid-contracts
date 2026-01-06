import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';

import { OptionalCommonParams } from './common.helpers';

import { ArkadaMap } from '../../typechain-types';

type CommonParams = {
  arkadaMapContract: ArkadaMap;
  owner: SignerWithAddress;
};

// ================================ Mint Tests ================================

interface IMintTest extends CommonParams {
  to: SignerWithAddress;
  tokenId: BigNumberish;
  amount: BigNumberish;
}

export const mintTest = async (
  { arkadaMapContract, owner, to, tokenId, amount }: IMintTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapContract.connect(sender).mint(to.address, tokenId, amount),
    ).revertedWithCustomError(arkadaMapContract, opt?.revertMessage);
    return;
  }

  const balanceBefore = await arkadaMapContract.balanceOf(to.address, tokenId);

  await expect(
    arkadaMapContract.connect(sender).mint(to.address, tokenId, amount),
  )
    .to.emit(arkadaMapContract, 'PieceMinted')
    .withArgs(to.address, tokenId, amount).to.not.reverted;

  const balanceAfter = await arkadaMapContract.balanceOf(to.address, tokenId);
  expect(balanceAfter).to.equal(balanceBefore.add(amount));
};

// ================================ Set Token URI Tests ================================

interface ISetTokenURITest extends CommonParams {
  tokenId: BigNumberish;
  tokenURI: string;
}

export const setTokenURITest = async (
  { arkadaMapContract, owner, tokenId, tokenURI }: ISetTokenURITest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapContract.connect(sender).setTokenURI(tokenId, tokenURI),
    ).revertedWithCustomError(arkadaMapContract, opt?.revertMessage);
    return;
  }

  await expect(arkadaMapContract.connect(sender).setTokenURI(tokenId, tokenURI))
    .to.emit(arkadaMapContract, 'TokenURIUpdated')
    .withArgs(sender.address, tokenId, tokenURI).to.not.reverted;

  expect(await arkadaMapContract.uri(tokenId)).to.equal(tokenURI);
};

// ================================ Set Whitelist Tests ================================

interface ISetWhitelistTest extends CommonParams {
  account: string;
  isWhitelisted: boolean;
}

export const setWhitelistTest = async (
  { arkadaMapContract, owner, account, isWhitelisted }: ISetWhitelistTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapContract.connect(sender).setWhitelist(account, isWhitelisted),
    ).revertedWithCustomError(arkadaMapContract, opt?.revertMessage);
    return;
  }

  await expect(
    arkadaMapContract.connect(sender).setWhitelist(account, isWhitelisted),
  )
    .to.emit(arkadaMapContract, 'WhitelistUpdated')
    .withArgs(account, isWhitelisted).to.not.reverted;

  expect(await arkadaMapContract.isWhitelisted(account)).to.equal(
    isWhitelisted,
  );
};

// ================================ Transfer Tests ================================

interface ITransferTest extends CommonParams {
  from: SignerWithAddress;
  to: SignerWithAddress;
  tokenId: BigNumberish;
  amount: BigNumberish;
}

export const safeTransferFromTest = async (
  { arkadaMapContract, owner, from, to, tokenId, amount }: ITransferTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? from;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapContract
        .connect(sender)
        ['safeTransferFrom(address,address,uint256,uint256,bytes)'](
          from.address,
          to.address,
          tokenId,
          amount,
          '0x',
        ),
    ).revertedWithCustomError(arkadaMapContract, opt?.revertMessage);
    return;
  }

  const fromBalanceBefore = await arkadaMapContract.balanceOf(
    from.address,
    tokenId,
  );
  const toBalanceBefore = await arkadaMapContract.balanceOf(
    to.address,
    tokenId,
  );

  await expect(
    arkadaMapContract
      .connect(sender)
      ['safeTransferFrom(address,address,uint256,uint256,bytes)'](
        from.address,
        to.address,
        tokenId,
        amount,
        '0x',
      ),
  ).to.not.reverted;

  const fromBalanceAfter = await arkadaMapContract.balanceOf(
    from.address,
    tokenId,
  );
  const toBalanceAfter = await arkadaMapContract.balanceOf(to.address, tokenId);

  expect(fromBalanceAfter).to.equal(fromBalanceBefore.sub(amount));
  expect(toBalanceAfter).to.equal(toBalanceBefore.add(amount));
};

interface IBatchTransferTest extends CommonParams {
  from: SignerWithAddress;
  to: SignerWithAddress;
  tokenIds: BigNumberish[];
  amounts: BigNumberish[];
}

export const safeBatchTransferFromTest = async (
  { arkadaMapContract, owner, from, to, tokenIds, amounts }: IBatchTransferTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? from;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapContract
        .connect(sender)
        ['safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)'](
          from.address,
          to.address,
          tokenIds,
          amounts,
          '0x',
        ),
    ).revertedWithCustomError(arkadaMapContract, opt?.revertMessage);
    return;
  }

  await expect(
    arkadaMapContract
      .connect(sender)
      ['safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)'](
        from.address,
        to.address,
        tokenIds,
        amounts,
        '0x',
      ),
  ).to.not.reverted;
};
