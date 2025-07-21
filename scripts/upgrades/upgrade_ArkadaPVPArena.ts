import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

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

  console.log('Upgrading ArkadaPVPArena to ArkadaPVPArenaV2...');

  const deployment = await hre.upgrades.upgradeProxy(
    addresses?.arena ?? '',
    await hre.ethers.getContractFactory('ArkadaPVPArenaV2', owner),
    {
      unsafeAllow: ['constructor'],
    },
  );

  if (deployment.deployTransaction) {
    console.log('Waiting 5 blocks...');
    await deployment.deployTransaction.wait(5);
    console.log('Waited.');
  }

  await logDeployProxy(hre, 'ArkadaPVPArenaV2', deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
