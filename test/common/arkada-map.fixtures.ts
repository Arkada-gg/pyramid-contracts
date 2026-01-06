import { expect } from 'chai';
import { ethers } from 'hardhat';

import { ArkadaMap__factory } from '../../typechain-types';

export async function arkadaMapDeploy() {
  const [owner, user, minter, ...regularAccounts] = await ethers.getSigners();

  const BASE_URI = 'https://api.arkada.com/map/';

  // -----------------------------------------------> ARKADA MAP

  const arkadaMapContract = await new ArkadaMap__factory(owner).deploy();

  // Test invalid initialization - zero admin
  await expect(
    arkadaMapContract.initialize(ethers.constants.AddressZero, BASE_URI),
  ).to.be.revertedWithCustomError(
    arkadaMapContract,
    'ArkadaMap__InvalidAddress',
  );

  // Valid initialization
  await arkadaMapContract.initialize(owner.address, BASE_URI);

  // Grant MINTER_ROLE to minter
  await arkadaMapContract.grantRole(
    await arkadaMapContract.MINTER_ROLE(),
    minter.address,
  );

  return {
    owner,
    user,
    minter,
    regularAccounts,
    arkadaMapContract,
    BASE_URI,
  };
}
