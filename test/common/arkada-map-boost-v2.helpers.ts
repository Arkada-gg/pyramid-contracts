import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';

import { OptionalCommonParams } from './common.helpers';
import { ArkadaMapBoostV2 } from '../../typechain-types';

type CommonParams = {
  arkadaMapBoostContract: ArkadaMapBoostV2;
  owner: SignerWithAddress;
};

// ================================ adminMint ================================

interface IAdminMintTest extends CommonParams {
  to: string;
}

export const adminMintTest = async (
  { arkadaMapBoostContract, owner, to }: IAdminMintTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      arkadaMapBoostContract.connect(sender).adminMint(to),
    ).revertedWithCustomError(arkadaMapBoostContract, opt.revertMessage);
    return;
  }

  const balanceBefore = await arkadaMapBoostContract.balanceOf(to);

  let nextTokenId = 0;
  while (true) {
    try {
      await arkadaMapBoostContract.ownerOf(nextTokenId);
      nextTokenId++;
    } catch {
      break;
    }
  }

  const tx = await arkadaMapBoostContract.connect(sender).adminMint(to);

  await expect(tx)
    .to.emit(arkadaMapBoostContract, 'Minted')
    .withArgs(to, nextTokenId);

  expect(await arkadaMapBoostContract.balanceOf(to)).to.equal(balanceBefore.add(1));
  expect(await arkadaMapBoostContract.ownerOf(nextTokenId)).to.equal(to);
};
