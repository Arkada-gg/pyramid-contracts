import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';

import { OptionalCommonParams } from './common.helpers';

import { ArkadaMapBoost } from '../../typechain-types';

type CommonParams = {
  arkadaMapBoostContract: ArkadaMapBoost;
  owner: SignerWithAddress;
};

// ================================ Mint Tests ================================

interface IMintTest extends CommonParams {
  value?: BigNumberish;
}

export const mintTest = async (
  { arkadaMapBoostContract, owner, value }: IMintTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;
  const mintPrice = await arkadaMapBoostContract.mintPrice();
  const expectedValue = value ?? mintPrice;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).mint({ value: expectedValue }),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  const balanceBefore = await arkadaMapBoostContract.balanceOf(sender.address);
  const treasuryBalanceBefore =
    await arkadaMapBoostContract.provider.getBalance(
      await arkadaMapBoostContract.treasury(),
    );

  // Find the next token ID by checking existing tokens
  let nextTokenId = 0;
  while (true) {
    try {
      await arkadaMapBoostContract.ownerOf(nextTokenId);
      nextTokenId++;
    } catch {
      break;
    }
  }

  const tx = await arkadaMapBoostContract
    .connect(sender)
    .mint({ value: expectedValue });

  await expect(tx)
    .to.emit(arkadaMapBoostContract, 'Minted')
    .withArgs(sender.address, nextTokenId);

  const balanceAfter = await arkadaMapBoostContract.balanceOf(sender.address);
  expect(balanceAfter).to.equal(balanceBefore.add(1));

  const treasuryBalanceAfter = await arkadaMapBoostContract.provider.getBalance(
    await arkadaMapBoostContract.treasury(),
  );
  expect(treasuryBalanceAfter).to.equal(
    treasuryBalanceBefore.add(expectedValue),
  );

  expect(await arkadaMapBoostContract.ownerOf(nextTokenId)).to.equal(
    sender.address,
  );
};

// ================================ Activate Tests ================================

interface IActivateTest extends CommonParams {
  tokenId: BigNumberish;
}

export const activateTest = async (
  { arkadaMapBoostContract, owner, tokenId }: IActivateTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).activate(tokenId),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(arkadaMapBoostContract.connect(sender).activate(tokenId))
    .to.emit(arkadaMapBoostContract, 'BoostActivated')
    .withArgs(sender.address, tokenId).to.not.reverted;

  expect(await arkadaMapBoostContract.isActivated(tokenId)).to.equal(true);
};

// ================================ Owner Functions Tests ================================

interface ISetMintPriceTest extends CommonParams {
  mintPrice: BigNumberish;
}

export const setMintPriceTest = async (
  { arkadaMapBoostContract, owner, mintPrice }: ISetMintPriceTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).setMintPrice(mintPrice),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(arkadaMapBoostContract.connect(sender).setMintPrice(mintPrice))
    .to.emit(arkadaMapBoostContract, 'MintPriceUpdated')
    .withArgs(sender.address, mintPrice).to.not.reverted;

  expect(await arkadaMapBoostContract.mintPrice()).to.equal(mintPrice);
};

interface ISetMintingActiveTest extends CommonParams {
  isActive: boolean;
}

export const setMintingActiveTest = async (
  { arkadaMapBoostContract, owner, isActive }: ISetMintingActiveTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).setMintingActive(isActive),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(
    arkadaMapBoostContract.connect(sender).setMintingActive(isActive),
  )
    .to.emit(arkadaMapBoostContract, 'MintingActiveUpdated')
    .withArgs(sender.address, isActive).to.not.reverted;

  expect(await arkadaMapBoostContract.s_isMintingActive()).to.equal(isActive);
};

interface ISetTreasuryTest extends CommonParams {
  treasury: string;
}

export const setTreasuryTest = async (
  { arkadaMapBoostContract, owner, treasury }: ISetTreasuryTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).setTreasury(treasury),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(arkadaMapBoostContract.connect(sender).setTreasury(treasury))
    .to.emit(arkadaMapBoostContract, 'TreasuryUpdated')
    .withArgs(sender.address, treasury).to.not.reverted;

  expect(await arkadaMapBoostContract.treasury()).to.equal(treasury);
};

interface ISetBaseURITest extends CommonParams {
  baseURI: string;
}

export const setBaseURITest = async (
  { arkadaMapBoostContract, owner, baseURI }: ISetBaseURITest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).setBaseURI(baseURI),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(arkadaMapBoostContract.connect(sender).setBaseURI(baseURI))
    .to.emit(arkadaMapBoostContract, 'BaseURIUpdated')
    .withArgs(sender.address, baseURI).to.not.reverted;
};

// ================================ Transfer Tests ================================

interface ITransferTest extends CommonParams {
  from: SignerWithAddress;
  to: SignerWithAddress;
  tokenId: BigNumberish;
}

export const transferFromTest = async (
  { arkadaMapBoostContract, from, to, tokenId }: ITransferTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? from;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract
        .connect(sender)
        .transferFrom(from.address, to.address, tokenId),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(
    arkadaMapBoostContract
      .connect(sender)
      .transferFrom(from.address, to.address, tokenId),
  ).to.not.reverted;

  expect(await arkadaMapBoostContract.ownerOf(tokenId)).to.equal(to.address);
};

export const safeTransferFromTest = async (
  { arkadaMapBoostContract, from, to, tokenId }: ITransferTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? from;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract
        .connect(sender)
        ['safeTransferFrom(address,address,uint256)'](
          from.address,
          to.address,
          tokenId,
        ),
    ).revertedWithCustomError(arkadaMapBoostContract, opt?.revertMessage);
    return;
  }

  await expect(
    arkadaMapBoostContract
      .connect(sender)
      ['safeTransferFrom(address,address,uint256)'](
        from.address,
        to.address,
        tokenId,
      ),
  ).to.not.reverted;

  expect(await arkadaMapBoostContract.ownerOf(tokenId)).to.equal(to.address);
};
