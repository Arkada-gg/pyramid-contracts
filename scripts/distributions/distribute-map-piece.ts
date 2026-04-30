import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { getCurrentAddresses } from '../../config/constants/addresses';

const ARKADA_MAP_BOOST_V2_CONTRACT_NAME = 'ArkadaMapBoostV2';

const RECIPIENTS = [
  '0x69ac7188ecb2e00b50e6e408c877acaba2b9b848',
  '0x5ba5e30b05aa61cc6114292c1abaf9929d591965',
  '0x58acd9be6b1284b5362aa340242f540f3b33df3a',
  '0x2d832b4e4b39208109f4a6ffafeaaf4d6c63b57f',
  '0x288a4e70eba5d4f92e28f8ccc561e9fc947304a1',
  '0x22d2c9e7c66178e33898febf14ab4b33135d0abc',
  '0x155a53d0c1b8b4aa0ae77116f968bca8c8e7230d',
  '0x0057be07beef5d9b4beb9e2d147906e83d1915c8',
  '0xfb44496ef7ce7dc94da1ec9f45115c80bba1778d',
  '0xf801a1c2f1be24a0278dd3a8c0b3ff3d965d9d21',
  '0xf61771b1808bf37b0d0a02d52b896c9decf2ed9e',
  '0xf614ddc260c8e72efd5aec92e3a4e3ecc4c2a116',
  '0xf572d207af78a35b0c773684c9c98e5c9b9b0ca9',
  '0xf1a3262e48eff92d41c1cb8708fc2c5f592d9e76',
  '0xeeecdf9946583e1624244df5fc399121dfb4604e',
  '0xee83ae872f88554a00fc9fae7052823cb4c07f80',
  '0xed80d5a03e833d05bf190e116f22e5e447b8e39a',
  '0xec48ec785b6bb8f298fe4f4a7868ac4f679e4c39',
  '0xeab804590011d0650fcb6c4da1870c6e9ca062d1',
  '0xea7ced71d6c91bea15860e9d83c5e850864e4433',
  '0xe961066d859d4922b51269801cd26a2351c4f1e3',
  '0xe507efaf7c2f73cbb486e9e1c690b225b265dfb9',
  '0xe4775ec96b072f77d613b6a9442dbba98237bc5b',
  '0xe431119b2248c43f48b09e93e931b90d7fb2eed0',
  '0xe3dd67e7a2579e0369ae0d449ef7e4a396000752',
  '0xddda78690198398ea24c32faba940ed9582d3681',
  '0xdd65c5e9d1d4124a4730a9bad9ba5784f9b1d1ec',
  '0xd78d0cc81356b39bbe04377e4a6060de410b7ce0',
  '0xd563e6a26a1d097da7d980bbe076c567f7fea62b',
  '0xd4bc689aca0a4a0a80f6c144f0030378c2652621',
];

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
