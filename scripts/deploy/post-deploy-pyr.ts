import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  ARKADA_REWARDER_CONTRACT_NAME,
  PYRAMID_CONTRACT_NAME,
} from '../../config';
import { getCurrentAddresses } from '../../config/constants/addresses';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('executor', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  // pre-requisites
  const TREASURY_ADDRESS = '0x2b412BfEaEfaeFC03134fF62D86CA5bB3359F68a';
  const SIGNER_ADDRESS = '0xDE91c31f1b9c3dc4270cADaec8ab4C4C5aCAD93f';
  const NEW_ADMIN = '0x4a665E6785556624324637695C4A20465D5D7b74';

  const arkadaRewarder = await hre.ethers.getContractAt(
    ARKADA_REWARDER_CONTRACT_NAME,
    addresses?.arkadaRewarder ?? '',
    owner,
  );
  const pyramid = await hre.ethers.getContractAt(
    PYRAMID_CONTRACT_NAME,
    addresses?.pyramid ?? '',
    owner,
  );

  console.log('ArkadaRewarder address: ', arkadaRewarder.address);
  console.log('Pyramid address: ', pyramid.address);

  let tx = await pyramid.connect(owner).setTreasury(TREASURY_ADDRESS);
  await tx.wait();
  console.log('Pyramid Treasury address set to: ', TREASURY_ADDRESS);

  const OPERATOR_ROLE = await arkadaRewarder.OPERATOR_ROLE();
  console.log('OPERATOR_ROLE: ', OPERATOR_ROLE);
  tx = await arkadaRewarder
    .connect(owner)
    .grantRole(OPERATOR_ROLE, pyramid.address);
  await tx.wait();
  console.log('Arkada Rewarder operator role set to: ', pyramid.address);

  const SIGNER_ROLE = await pyramid.SIGNER_ROLE();
  tx = await pyramid.connect(owner).grantRole(SIGNER_ROLE, SIGNER_ADDRESS);
  await tx.wait();
  console.log('Pyramid signer role set to: ', SIGNER_ADDRESS);

  if (NEW_ADMIN) {
    const DEFAULT_ADMIN_ROLE = await pyramid.DEFAULT_ADMIN_ROLE();
    let tx = await pyramid.grantRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN);
    await tx.wait();
    tx = await pyramid.revokeRole(DEFAULT_ADMIN_ROLE, owner.address);
    await tx.wait();
    console.log('Pyramid admin set to: ', NEW_ADMIN);
    console.log('Pyramid admin revoked from: ', owner.address);

    tx = await arkadaRewarder.grantRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN);
    await tx.wait();
    tx = await arkadaRewarder.revokeRole(DEFAULT_ADMIN_ROLE, owner.address);
    await tx.wait();
    console.log('Arkada Rewarder admin set to: ', NEW_ADMIN);
    console.log('Arkada Rewarder admin revoked from: ', owner.address);
  }
};

func(hre).then(console.log).catch(console.error);
