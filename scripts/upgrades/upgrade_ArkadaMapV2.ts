import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { getCurrentAddresses } from '../../config/constants/addresses';
import {
  logDeployProxy,
  tryEtherscanVerifyImplementation,
} from '../../helpers/utils';

const ARKADA_MAP_V2_CONTRACT_NAME = 'ArkadaMapV2';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  const SIGNER_ADDRESS = '0xDE91c31f1b9c3dc4270cADaec8ab4C4C5aCAD93f';

  console.log('Upgrading ArkadaMap to V2...');

  const deployment = await hre.upgrades.upgradeProxy(
    addresses?.arkadaMap ?? '',
    await hre.ethers.getContractFactory(ARKADA_MAP_V2_CONTRACT_NAME, owner),
    {
      unsafeAllow: ['constructor'],
    },
  );

  if (deployment.deployTransaction) {
    console.log('Waiting 5 blocks...');
    await deployment.deployTransaction.wait(5);
    console.log('Waited.');
  }

  console.log('Initializing V2...');
  const initTx = await deployment.connect(owner).initializeV2();
  await initTx.wait();
  console.log('V2 initialized.');

  if (SIGNER_ADDRESS) {
    const SIGNER_ROLE = await deployment.SIGNER_ROLE();
    const grantTx = await deployment
      .connect(owner)
      .grantRole(SIGNER_ROLE, SIGNER_ADDRESS);
    await grantTx.wait();
    console.log('SIGNER_ROLE granted to:', SIGNER_ADDRESS);
  } else {
    console.warn(
      'No mapSigner configured for this network — skipping SIGNER_ROLE grant.',
    );
  }

  await logDeployProxy(hre, ARKADA_MAP_V2_CONTRACT_NAME, deployment.address);
  await tryEtherscanVerifyImplementation(hre, deployment.address);
};

func(hre).then(console.log).catch(console.error);
