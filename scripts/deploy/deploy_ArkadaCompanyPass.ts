import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ARKADA_COMPANY_PASS_CONTRACT_NAME } from '../../config';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying ArkadaCompanyPass...');

  // initialise params <=========
  const NAME = 'Arkada Company Pass';
  const SYMBOL = 'ARKADAPASS';
  const SIGNING_DOMAIN = 'ARKADA_COMPANY_PASS';
  const SIGNATURE_VERSION = '1';
  const ADMIN = deployer; // Set admin address here
  const TREASURY = '0x4a665E6785556624324637695C4A20465D5D7b74';
  // =====================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(
      ARKADA_COMPANY_PASS_CONTRACT_NAME,
      owner,
    ),
    [NAME, SYMBOL, SIGNING_DOMAIN, SIGNATURE_VERSION, ADMIN, TREASURY],
    {
      unsafeAllow: ['constructor'],
    },
  );

  console.log('TX Hash:', deployment.deployTransaction?.hash);

  if (deployment.deployTransaction) {
    console.log('Waiting 5 blocks...');
    await deployment.deployTransaction.wait(5);
    console.log('Waited.');
  }

  await logDeployProxy(
    hre,
    ARKADA_COMPANY_PASS_CONTRACT_NAME,
    deployment.address,
  );
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
