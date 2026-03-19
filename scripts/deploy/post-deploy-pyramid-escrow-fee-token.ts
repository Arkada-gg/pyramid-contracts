import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { PYRAMID_ESCROW_FEE_TOKEN_CONTRACT_NAME } from '../../config';
import { getCurrentAddresses } from '../../config/constants/addresses';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('executor', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  // pre-requisites
  const PROXY_ADDRESS = addresses?.pyramid; // Set deployed proxy address here
  const TREASURY_ADDRESS = '0x2b412BfEaEfaeFC03134fF62D86CA5bB3359F68a';
  const SIGNER_ADDRESS = '0xDE91c31f1b9c3dc4270cADaec8ab4C4C5aCAD93f';
  const NEW_ADMIN = undefined;

  if (!PROXY_ADDRESS) {
    throw new Error('PROXY_ADDRESS must be set');
  }

  const pyramid = await hre.ethers.getContractAt(
    PYRAMID_ESCROW_FEE_TOKEN_CONTRACT_NAME,
    PROXY_ADDRESS,
    owner,
  );

  console.log('PyramidEscrowFeeToken address: ', pyramid.address);

  let tx = await pyramid.connect(owner).setTreasury(TREASURY_ADDRESS);
  await tx.wait();
  console.log('Treasury address set to: ', TREASURY_ADDRESS);

  const SIGNER_ROLE = await pyramid.SIGNER_ROLE();
  tx = await pyramid.connect(owner).grantRole(SIGNER_ROLE, SIGNER_ADDRESS);
  await tx.wait();
  console.log('Signer role granted to: ', SIGNER_ADDRESS);

  if (NEW_ADMIN) {
    const DEFAULT_ADMIN_ROLE = await pyramid.DEFAULT_ADMIN_ROLE();
    let tx = await pyramid.grantRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN);
    await tx.wait();
    tx = await pyramid.revokeRole(DEFAULT_ADMIN_ROLE, owner.address);
    await tx.wait();
    console.log('Admin set to: ', NEW_ADMIN);
    console.log('Admin revoked from: ', owner.address);
  }
};

func(hre).then(console.log).catch(console.error);
