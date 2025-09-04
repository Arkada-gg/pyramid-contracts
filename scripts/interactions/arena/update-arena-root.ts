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

  const ARENA_ID = 54;
  const NEW_ROOT =
    '0x37c5a6ee1b350e547fd2221f6ffe760c62c770fa30eed9bb79615362e1aa3267';

  await arenaContract.updateMerkleRoot(ARENA_ID, NEW_ROOT);

  const submittedRoot = await arenaContract.rootProofByArena(ARENA_ID);
  console.log('Arena submitted root: ', submittedRoot);
};

func(hre).then(console.log).catch(console.error);
