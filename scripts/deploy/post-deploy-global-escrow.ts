import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { GLOBAL_ESCROW_CONTRACT_NAME } from '../../config';
import { getCurrentAddresses } from '../../config/constants/addresses';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('executor', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  // pre-requisites
  const WITHDRAWER_ADDRESS = deployer;
  const DISTRIBUTOR_ADDRESS = '0xecB880DD8a970f347f93b87335FC5172500f2beE';

  const globalEscrow = await hre.ethers.getContractAt(
    GLOBAL_ESCROW_CONTRACT_NAME,
    addresses?.globalEscrow ?? '',
    owner,
  );

  console.log('GlobalEscrow address: ', globalEscrow.address);

  const withdrawerRole = await globalEscrow.connect(owner).WITHDRAWER_ROLE();
  const distributorRole = await globalEscrow.connect(owner).DISTRIBUTOR_ROLE();

  let tx = await globalEscrow
    .connect(owner)
    .grantRole(withdrawerRole, WITHDRAWER_ADDRESS);
  await tx.wait();
  console.log('globalEscrow WITHDRAWER_ROLE set to: ', WITHDRAWER_ADDRESS);

  tx = await globalEscrow
    .connect(owner)
    .grantRole(distributorRole, DISTRIBUTOR_ADDRESS);
  await tx.wait();
  console.log('globalEscrow DISTRIBUTOR_ROLE set to: ', DISTRIBUTOR_ADDRESS);
};

func(hre).then(console.log).catch(console.error);
