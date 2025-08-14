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

  const ARENA_ID = 101;

  const info = await arenaContract.arenas(ARENA_ID);
  console.log('Arena required players: ', +info.requiredPlayers);
  console.log('Arena joined players: ', +info.players);
  console.log('Arena initial pool: ', +info.initialPrizePool);

  console.log('Full info: ', info);
};

func(hre).then(console.log).catch(console.error);
