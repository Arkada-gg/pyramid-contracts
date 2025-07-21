import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ARENA_CONTRACT_NAME } from '../../../config';
import { getCurrentAddresses } from '../../../config/constants/addresses';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  const arenaContract = await hre.ethers.getContractAt(
    ARENA_CONTRACT_NAME,
    addresses?.arena ?? '',
    owner,
  );

  const ACCOUNT = '0xDE91c31f1b9c3dc4270cADaec8ab4C4C5aCAD93f';

  const operatorRole = await arenaContract.OPERATOR_ROLE();
  await arenaContract.grantRole(operatorRole, ACCOUNT);
  console.log(
    'Is Granted: ',
    await arenaContract.hasRole(operatorRole, ACCOUNT),
  );
  console.log('OPERATOR_ROLE granted to: ', ACCOUNT);
};

func(hre).then(console.log).catch(console.error);
