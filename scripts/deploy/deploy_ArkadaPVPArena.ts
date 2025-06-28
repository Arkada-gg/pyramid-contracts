import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ARENA_CONTRACT_NAME } from '../../config';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying ArkadaPVPArena...');

  // initialise params <=========
  const SIGNING_DOMAIN = 'ArkadaPVPArena';
  const SIGNATURE_VERSION = '1';
  const ADMIN = deployer; // Set admin address here
  const TREASURY = deployer; // Set treasury address here
  // const SIGNER = '0xA3F1D90b5227A128A65AcbE223dbe01870e4AbF3'; // Set signer address here
  const SIGNER = '0xDE91c31f1b9c3dc4270cADaec8ab4C4C5aCAD93f'; // Set signer address here  PROD
  const FEE_BPS = 1000; // fee percent to treasury send (10000 = 100%)
  const TIME_LEFT_TO_REBUY_BPS = 2500; // fee percent to treasury send (10000 = 100%)
  const PLAYERS_CONFIG = {
    min: 3,
    max: 10000,
  }; // required players config to start arena with PLACES type
  const INTERVAL_TO_START_CONFIG = {
    min: 60 * 60,
    max: 7 * 24 * 60 * 60,
  }; // interval to start in seconds config for arenas with TIME type
  const DURATION_CONFIG = {
    min: 60 * 60,
    max: 7 * 24 * 60 * 60,
  }; // arenas duration config in seconds

  // =====================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(ARENA_CONTRACT_NAME, owner),
    [
      SIGNING_DOMAIN,
      SIGNATURE_VERSION,
      TREASURY,
      SIGNER,
      ADMIN,
      FEE_BPS,
      TIME_LEFT_TO_REBUY_BPS,
      PLAYERS_CONFIG,
      INTERVAL_TO_START_CONFIG,
      DURATION_CONFIG,
    ],
    {
      unsafeAllow: ['constructor'],
    },
  );

  if (deployment.deployTransaction) {
    console.log('Waiting 5 blocks...');
    await deployment.deployTransaction.wait(5);
    console.log('Waited.');
  }

  await logDeployProxy(hre, ARENA_CONTRACT_NAME, deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
