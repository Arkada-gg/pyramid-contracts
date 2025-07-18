import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { GLOBAL_ESCROW_CONTRACT_NAME } from '../../config';
import { getCurrentAddresses } from '../../config/constants/addresses';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying GlobalEscrow...');

  // initialise params <=========
  const WHITELISTED_TOKENS: string[] = [];
  // const ADMIN = '0x4a665E6785556624324637695C4A20465D5D7b74'; // Set admin address here
  const ADMIN = '0xd0623f1fC15d9cb59D0dc81f3498F30bcaE6B97C'; // Set admin address here
  const TREASURY = ADMIN;
  // =====================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(GLOBAL_ESCROW_CONTRACT_NAME, owner),
    [ADMIN, WHITELISTED_TOKENS, TREASURY],
    {
      unsafeAllow: ['constructor'],
      timeout: 5000,
    },
  );

  if (deployment.deployTransaction) {
    console.log('Waiting 5 blocks...');
    await deployment.deployTransaction.wait(5);
    console.log('Waited.');
  }

  await logDeployProxy(hre, GLOBAL_ESCROW_CONTRACT_NAME, deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
