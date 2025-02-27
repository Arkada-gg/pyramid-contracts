import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ARKADA_ERC721_ROYALTY_CONTRACT_NAME } from '../../config';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying ArkadaERC721Royalty...');

  // initialise params <=========
  const NAME = '';
  const SYMBOL = '';
  const BASE_URI = '';
  const MINT_PRICE = hre.ethers.utils.parseEther('1');
  const MINT_DEADLINE = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
  const PAYMENT_RECIPIENT = '';
  // =====================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(
      ARKADA_ERC721_ROYALTY_CONTRACT_NAME,
      owner,
    ),
    [NAME, SYMBOL, BASE_URI, MINT_PRICE, MINT_DEADLINE, PAYMENT_RECIPIENT],
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
    ARKADA_ERC721_ROYALTY_CONTRACT_NAME,
    deployment.address,
  );
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
