import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { parseEther } from 'ethers/lib/utils';
import { ARKADA_MAP_BOOST_CONTRACT_NAME } from '../../config';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  console.log('Deploying ArkadaMapBoost...');

  // initialise params <=========
  const NAME = 'Field Medkit';
  const SYMBOL = 'MEDKIT';
  const BASE_URI = 'https://bafybeihcnyjhb7bk2vgvwiwep5eur67hda3vioi2pnquti37cqr2aetzea.ipfs.w3s.link/metadata.json';
  const ADMIN = deployer; // Set admin address here
  const TREASURY = '0x4a665E6785556624324637695C4A20465D5D7b74';
  const MINT_PRICE = parseEther('0.01'); // 0.01 ETH
  // const MINT_PRICE = 1; // 0.1 ETH
  // =====================

  const deployment = await hre.upgrades.deployProxy(
    await hre.ethers.getContractFactory(ARKADA_MAP_BOOST_CONTRACT_NAME, owner),
    [NAME, SYMBOL, BASE_URI, ADMIN, TREASURY, MINT_PRICE],
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

  await logDeployProxy(hre, ARKADA_MAP_BOOST_CONTRACT_NAME, deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
