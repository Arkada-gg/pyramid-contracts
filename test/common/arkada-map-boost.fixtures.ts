import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { ArkadaMapBoost__factory } from '../../typechain-types';

export async function arkadaMapBoostDeploy() {
  const [owner, user, treasury, ...regularAccounts] = await ethers.getSigners();

  const NAME = 'ArkadaMapBoost';
  const SYMBOL = 'ARKADAMAPBOOST';
  const BASE_URI = 'https://api.arkada.com/mapboost/';
  const MINT_PRICE = parseEther('0.1');

  // -----------------------------------------------> ARKADA MAP BOOST

  const arkadaMapBoostContract = await new ArkadaMapBoost__factory(
    owner,
  ).deploy();

  // Test invalid initialization - zero treasury
  await expect(
    arkadaMapBoostContract.initialize(
      NAME,
      SYMBOL,
      BASE_URI,
      owner.address,
      ethers.constants.AddressZero,
      MINT_PRICE,
    ),
  ).to.be.revertedWithCustomError(
    arkadaMapBoostContract,
    'ArkadaMapBoost__InvalidAddress',
  );

  // Test invalid initialization - zero mint price
  await expect(
    arkadaMapBoostContract.initialize(
      NAME,
      SYMBOL,
      BASE_URI,
      owner.address,
      treasury.address,
      0,
    ),
  ).to.be.revertedWithCustomError(
    arkadaMapBoostContract,
    'ArkadaMapBoost__InvalidAmount',
  );

  // Valid initialization
  await arkadaMapBoostContract.initialize(
    NAME,
    SYMBOL,
    BASE_URI,
    owner.address,
    treasury.address,
    MINT_PRICE,
  );

  return {
    owner,
    user,
    treasury,
    regularAccounts,
    arkadaMapBoostContract,
    NAME,
    SYMBOL,
    BASE_URI,
    MINT_PRICE,
  };
}
