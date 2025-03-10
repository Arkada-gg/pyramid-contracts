import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { PYRAMID_CONTRACT_NAME } from '../../config';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying Pyramid...');

  // initialise params <=========
  const TOKEN_NAME = 'Pyramid';
  const TOKEN_SYMBOL = 'PYR';
  const SIGNING_DOMAIN = 'Pyramid';
  const SIGNATURE_VERSION = '1';
  const ADMIN = owner.address; // Set admin address here
  const ARKADA_REWARDER = hre.ethers.constants.AddressZero; // Set arkada rewarder address here
  // =====================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(PYRAMID_CONTRACT_NAME, owner),
    [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      SIGNING_DOMAIN,
      SIGNATURE_VERSION,
      ADMIN,
      ARKADA_REWARDER,
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

  await logDeployProxy(hre, PYRAMID_CONTRACT_NAME, deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
