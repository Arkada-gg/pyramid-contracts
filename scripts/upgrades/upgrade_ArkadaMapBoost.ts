import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { getCurrentAddresses } from '../../config/constants/addresses';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const ARKADA_MAP_BOOST_V2_CONTRACT_NAME = 'ArkadaMapBoostV2';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  const proxyAddress = addresses?.arkadaMapBoost ?? '';
  if (!proxyAddress) {
    throw new Error('arkadaMapBoost address not configured for this network');
  }

  console.log('Upgrading ArkadaMapBoost to V2...');

  const deployment = await hre.upgrades.upgradeProxy(
    proxyAddress,
    await hre.ethers.getContractFactory(ARKADA_MAP_BOOST_V2_CONTRACT_NAME, owner),
    {
      unsafeAllow: ['constructor'],
    },
  );

  if (deployment.deployTransaction) {
    console.log('Waiting 5 blocks...');
    await deployment.deployTransaction.wait(5);
    console.log('Waited.');
  }

  await logDeployProxy(hre, ARKADA_MAP_BOOST_V2_CONTRACT_NAME, deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
