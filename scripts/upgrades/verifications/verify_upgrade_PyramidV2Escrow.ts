import hre, { ethers } from 'hardhat';
import { ENV } from '../../../config';

async function main() {
  console.log('Starting Pyramid contract upgrade verification...');

  // Get the deployed PyramidV2Escrow contract
  const pyramidAddress = '0x30410050CB1eBCF21741c9D3F817C386401f82fd';
  const adminAddress = '0x4a665E6785556624324637695C4A20465D5D7b74';

  // Get owner signer
  const ownerSigner = new ethers.Wallet(
    ENV.PRIVATE_KEY_DEPLOYER,
    ethers.provider,
  );
  console.log('Using owner address:', ownerSigner.address);

  // Fund the owner account
  const [deployer] = await ethers.getSigners();
  const fundTx = await deployer.sendTransaction({
    to: ownerSigner.address,
    value: ethers.utils.parseEther('50.0'),
  });
  await fundTx.wait();
  console.log('Funded owner account with 50 ETH');

  // Get initial state before upgrade
  const pyramidV2Before = await ethers.getContractAt(
    'PyramidV2Escrow',
    pyramidAddress,
  );
  console.log('\nChecking state before upgrade:');

  const treasuryBefore = await pyramidV2Before.s_treasury();
  const arkadaRewarderBefore = await pyramidV2Before.s_arkadaRewarder();
  const isMintingActiveBefore = await pyramidV2Before.s_isMintingActive();
  const versionBefore = await pyramidV2Before.pyramidVersion();

  console.log('Initial state:', {
    treasury: treasuryBefore,
    arkadaRewarder: arkadaRewarderBefore,
    isMintingActive: isMintingActiveBefore,
    version: versionBefore,
  });

  // Perform the upgrade
  console.log('\nPerforming contract upgrade...');
  const PyramidV2Escrow = await ethers.getContractFactory(
    'PyramidV2Escrow',
    ownerSigner,
  );
  const deployment = await hre.upgrades.upgradeProxy(
    pyramidAddress,
    PyramidV2Escrow,
    {
      unsafeAllow: ['constructor'],
    },
  );

  if (deployment.deployTransaction) {
    console.log('Waiting for upgrade transaction to be mined...');
    await deployment.deployTransaction.wait(5);
    console.log('Upgrade transaction completed');
  }

  // Get the upgraded contract instance
  const pyramidV2After = await ethers.getContractAt(
    'PyramidV2Escrow',
    pyramidAddress,
  );
  console.log('\nVerifying state after upgrade:');

  // 1. Verify contract version
  const versionAfter = await pyramidV2After.pyramidVersion();
  console.log('Contract version:', versionAfter);
  if (versionAfter !== '2') {
    throw new Error(
      'Invalid contract version. Expected 2, got ' + versionAfter,
    );
  }

  // 2. Verify treasury
  const treasuryAfter = await pyramidV2After.s_treasury();
  console.log('Treasury address:', treasuryAfter);
  if (treasuryAfter !== treasuryBefore) {
    throw new Error('Treasury address changed after upgrade');
  }

  // 3. Verify arkadaRewarder
  const arkadaRewarderAfter = await pyramidV2After.s_arkadaRewarder();
  console.log('ArkadaRewarder address:', arkadaRewarderAfter);
  if (arkadaRewarderAfter !== arkadaRewarderBefore) {
    throw new Error('ArkadaRewarder address changed after upgrade');
  }

  // 4. Verify minting state
  const isMintingActiveAfter = await pyramidV2After.s_isMintingActive();
  console.log('Minting active:', isMintingActiveAfter);
  if (isMintingActiveAfter !== isMintingActiveBefore) {
    throw new Error('Minting state changed after upgrade');
  }

  // 5. Verify admin roles
  const DEFAULT_ADMIN_ROLE = await pyramidV2After.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await pyramidV2After.hasRole(
    DEFAULT_ADMIN_ROLE,
    adminAddress,
  );
  console.log(`${adminAddress} has admin role:`, hasAdminRole);
  if (!hasAdminRole) {
    throw new Error(`${adminAddress} does not have admin role`);
  }

  // 6. Verify contract is upgradeable
  const implementation = await ethers.provider.getStorageAt(
    pyramidAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  );
  console.log('Implementation address:', implementation);
  if (implementation === ethers.constants.AddressZero) {
    throw new Error('Contract is not upgradeable');
  }

  // 7. Verify contract balance
  const balance = await ethers.provider.getBalance(pyramidAddress);
  console.log('Contract balance:', ethers.utils.formatEther(balance), 'ETH');

  // 8. Verify contract code
  const code = await ethers.provider.getCode(pyramidAddress);
  if (code === '0x') {
    throw new Error('No contract code found at address');
  }
  console.log('Contract code verified');

  // 9. Verify contract events
  console.log('\nChecking recent events...');
  const filter = pyramidV2After.filters.PyramidClaim();
  const events = await pyramidV2After.queryFilter(filter, -10000, 'latest');
  console.log('Recent PyramidClaim events:', events.length);

  console.log(
    '\nUpgrade verification completed successfully! All states are preserved and contract is functioning correctly.',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Upgrade verification failed:', error);
    process.exit(1);
  });
