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
  const SIGNER_ADDRESS = '0x701858645415f04EEBc91816cA2465eAc2fdDC27';

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
  tx = await arkadaRewarder
    .connect(owner)
    .grantRole(OPERATOR_ROLE, pyramid.address);
  await tx.wait();
  console.log('Arkada Rewarder operator role set to: ', pyramid.address);

  const SIGNER_ROLE = await pyramid.SIGNER_ROLE();
  tx = await pyramid.connect(owner).grantRole(SIGNER_ROLE, SIGNER_ADDRESS);
  await tx.wait();
  console.log('Pyramid signer role set to: ', SIGNER_ADDRESS);
};

func(hre).then(console.log).catch(console.error);
