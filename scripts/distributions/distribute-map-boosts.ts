import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { getCurrentAddresses } from '../../config/constants/addresses';

const ARKADA_MAP_BOOST_V2_CONTRACT_NAME = 'ArkadaMapBoostV2';

const RECIPIENTS = ['0x6b145300D4e4912F4Cc6866268d7e169b0ad8e2a'];

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();
  console.log('deployer', { deployer });

  const owner = await hre.ethers.getSigner(deployer);

  const proxyAddress = addresses?.arkadaMapBoost ?? '';
  if (!proxyAddress) {
    throw new Error('arkadaMapBoost address not configured for this network');
  }

  const boostContract = await hre.ethers.getContractAt(
    ARKADA_MAP_BOOST_V2_CONTRACT_NAME,
    proxyAddress,
    owner,
  );

  console.log(`Distributing MapBoost to ${RECIPIENTS.length} recipients...`);

  for (let i = 0; i < RECIPIENTS.length; i++) {
    const recipient = RECIPIENTS[i];
    console.log(`[${i + 1}/${RECIPIENTS.length}] Minting to ${recipient}...`);

    const tx = await boostContract.adminMint(recipient);
    await tx.wait();

    console.log(`  ✓ TX: ${tx.hash}`);
  }

  console.log(`Done. Distributed MapBoost to ${RECIPIENTS.length} addresses.`);
};

func(hre).then(console.log).catch(console.error);
