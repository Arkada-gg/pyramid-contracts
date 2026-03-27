import * as hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { PYRAMID_ESCROW_LATEST_CONTRACT_NAME } from '../../config';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying PyramidEscrowLatest...');

  // ============ initialise params ============
  const TOKEN_NAME = 'Pyramid';
  const TOKEN_SYMBOL = 'PYR';
  const SIGNING_DOMAIN = 'pyramid';
  const SIGNATURE_VERSION = '1';
  const ADMIN = deployer; // replace with multisig / ops wallet before mainnet
  // ===========================================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(
      PYRAMID_ESCROW_LATEST_CONTRACT_NAME,
      owner,
    ),
    [TOKEN_NAME, TOKEN_SYMBOL, SIGNING_DOMAIN, SIGNATURE_VERSION, ADMIN],
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
    PYRAMID_ESCROW_LATEST_CONTRACT_NAME,
    deployment.address,
  );
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
