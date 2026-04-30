import { parseEther } from 'ethers/lib/utils';
import { ethers, upgrades } from 'hardhat';

import { ArkadaMapBoost, ArkadaMapBoostV2 } from '../../typechain-types';

export async function arkadaMapBoostV2Deploy() {
  const [owner, user, treasury, ...regularAccounts] = await ethers.getSigners();

  const NAME = 'ArkadaMapBoost';
  const SYMBOL = 'ARKADAMAPBOOST';
  const BASE_URI = 'https://api.arkada.com/mapboost/';
  const MINT_PRICE = parseEther('0.1');

  // Deploy V1 as upgradeable proxy
  const ArkadaMapBoostFactory = await ethers.getContractFactory('ArkadaMapBoost');
  const arkadaMapBoostV1 = (await upgrades.deployProxy(
    ArkadaMapBoostFactory,
    [NAME, SYMBOL, BASE_URI, owner.address, treasury.address, MINT_PRICE],
    { unsafeAllow: ['constructor'] },
  )) as ArkadaMapBoost;
  await arkadaMapBoostV1.deployed();

  // Upgrade to V2
  const ArkadaMapBoostV2Factory = await ethers.getContractFactory('ArkadaMapBoostV2');
  const arkadaMapBoostContract = (await upgrades.upgradeProxy(
    arkadaMapBoostV1.address,
    ArkadaMapBoostV2Factory,
    { unsafeAllow: ['constructor'] },
  )) as ArkadaMapBoostV2;

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
