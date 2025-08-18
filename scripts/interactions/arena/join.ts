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

  const ARENA_ID = 96;

  const arenaInfo = await arenaContract.arenas(ARENA_ID);
  console.log(arenaInfo);

  await arenaContract['joinArena(uint256)'](ARENA_ID, {
    value: arenaInfo.entryFee,
  });
};

func(hre).then(console.log).catch(console.error);
