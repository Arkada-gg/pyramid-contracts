import { expect } from 'chai';
import { ethers } from 'hardhat';

import {
  // eslint-disable-next-line camelcase
  ArkadaERC721Royalty__factory,
  // eslint-disable-next-line camelcase
  DailyCheck__factory,
} from '../../typechain-types';

export const defaultDeploy = async () => {
  const [owner, paymentsRecipient, operator, ...regularAccounts] =
    await ethers.getSigners();

  // main contracts
  const dailyCheck = await new DailyCheck__factory(owner).deploy();
  await dailyCheck.initialize();

  const mintPrice = ethers.utils.parseEther('0.1');
  const mintDeadline = Math.floor(Date.now() / 1000) + 86400 * 5;

  const arkadaERC721Royalty = await new ArkadaERC721Royalty__factory(
    owner,
  ).deploy();
  await expect(
    arkadaERC721Royalty.initialize(
      'ArkadaNFT',
      'ARK',
      'ipfs://base_uri/',
      0,
      mintDeadline,
      paymentsRecipient.address,
    ),
  ).to.be.revertedWith('invalid price');
  await expect(
    arkadaERC721Royalty.initialize(
      'ArkadaNFT',
      'ARK',
      'ipfs://base_uri/',
      mintPrice,
      mintDeadline,
      ethers.constants.AddressZero,
    ),
  ).to.be.revertedWith('invalid recipient');

  await arkadaERC721Royalty.initialize(
    'ArkadaNFT',
    'ARK',
    'ipfs://base_uri/',
    mintPrice,
    mintDeadline,
    paymentsRecipient.address,
  );

  await arkadaERC721Royalty.setOperator(operator.address);

  return {
    owner,
    regularAccounts,
    dailyCheck,
    mintPrice,
    mintDeadline,
    paymentsRecipient,
    operator,
    arkadaERC721Royalty,
  };
};
