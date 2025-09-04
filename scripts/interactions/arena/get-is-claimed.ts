import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ethers } from 'ethers';
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

  const ARENA_ID = 57;
  const ADDRESS_TO_CHECK = '0x94a9edc38388f1ea1eca824210f28465cca570ce';

  // Calculate the hash for participant and claimed mappings
  const arenaIdHash = ethers.utils.solidityKeccak256(['uint256'], [ARENA_ID]);
  const arenaIdAndAddressHash = ethers.utils.solidityKeccak256(
    ['bytes32', 'address'],
    [arenaIdHash, ADDRESS_TO_CHECK],
  );

  const claimed = await arenaContract.claimed(arenaIdAndAddressHash);
  console.log('Is claimed: ', claimed);
};

func(hre).then(console.log).catch(console.error);
