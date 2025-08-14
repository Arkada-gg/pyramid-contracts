import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { GLOBAL_ESCROW_CONTRACT_NAME } from '../../../config';
import { getCurrentAddresses } from '../../../config/constants/addresses';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  const escrowContract = await hre.ethers.getContractAt(
    GLOBAL_ESCROW_CONTRACT_NAME,
    addresses?.globalEscrow ?? '',
    owner,
  );
  console.log(
    GLOBAL_ESCROW_CONTRACT_NAME,
    ' address:',
    addresses?.globalEscrow,
  );

  const info = await escrowContract.escrowNativeBalance();
  console.log('ETH reserves: ', +info);
};

func(hre).then(console.log).catch(console.error);
