import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { PYRAMID_ESCROW_FEE_TOKEN_CONTRACT_NAME } from '../../config';
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

  console.log('Deploying PyramidEscrowFeeToken...');

  // initialise params <=========
  const TOKEN_NAME = 'Pyramid';
  const TOKEN_SYMBOL = 'PYR';
  const SIGNING_DOMAIN = 'Pyramid';
  const SIGNATURE_VERSION = '1';
  const ADMIN = '0xd0623f1fC15d9cb59D0dc81f3498F30bcaE6B97C'; // Set admin address here
  const FEE_TOKEN = '0x20C000000000000000000000b9537d11c60E8b50'; // Set ERC20 fee token address here
  // =====================

  if (!FEE_TOKEN) {
    throw new Error('FEE_TOKEN address must be set before deploying');
  }

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(
      PYRAMID_ESCROW_FEE_TOKEN_CONTRACT_NAME,
      owner,
    ),
    [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      SIGNING_DOMAIN,
      SIGNATURE_VERSION,
      ADMIN,
      FEE_TOKEN,
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

  await logDeployProxy(
    hre,
    PYRAMID_ESCROW_FEE_TOKEN_CONTRACT_NAME,
    deployment.address,
  );
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
