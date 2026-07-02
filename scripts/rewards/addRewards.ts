import * as fs from 'fs';
import * as path from 'path';

import * as hre from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ARKADA_REWARDER_CONTRACT_NAME } from '../../config';
import { getCurrentAddresses } from '../../config/constants/addresses';

/**
 * Adds (accumulates) rewards on the ArkadaRewarder contract and sends the tx.
 *
 * The contract only exposes `setRewards`, which OVERWRITES userRewards[user].
 * To get "add" semantics this script reads each user's current on-chain reward,
 * adds the tier amount, and submits the new total. Existing pending rewards are
 * therefore preserved and increased, not replaced.
 *
 * Reward tiers (ETH) by leaderboard rank (CSV sorted by points DESC):
 *   1 -> 0.1 | 2 -> 0.05 | 3 -> 0.03 | 4-10 -> 0.02 | 11-50 -> 0.01
 *
 * Run:
 *   yarn hh:run scripts/rewards/addRewards.ts --network soneium
 *
 * Env / args:
 *   CSV=path/to/leaderboard.csv         (default: scripts/rewards/05.26.csv)
 *   REWARDER_ADDRESS=0x...              (default: config arkadaRewarder for the network)
 *   DRY_RUN=true                        (compute & print, do NOT send tx)
 */

/** Returns the reward (ETH string) for a 1-based rank, or null to skip. */
function rewardForRank(rank: number): string | null {
  if (rank === 1) return '0.1';
  if (rank === 2) return '0.05';
  if (rank === 3) return '0.03';
  if (rank >= 4 && rank <= 10) return '0.02';
  if (rank >= 11 && rank <= 50) return '0.01';
  return null;
}

function parseCsv(csvPath: string): { address: string; deltaEth: string }[] {
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  if (lines[0] && lines[0].toLowerCase().includes('address')) lines.shift();

  const rows: { address: string; deltaEth: string }[] = [];
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const eth = rewardForRank(idx + 1);
    if (eth === null) return;
    const address = line
      .split(',')
      .pop()!
      .replace(/"/g, '')
      .trim()
      .toLowerCase();
    rows.push({ address, deltaEth: eth });
  });
  return rows;
}

const func = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers } = hre;
  const { parseEther, formatEther } = ethers.utils;

  const csvPath = process.env.CSV || path.join(__dirname, '06.26.csv');
  const dryRun = false;

  const rewarderAddress =
    process.env.REWARDER_ADDRESS || getCurrentAddresses(hre)?.arkadaRewarder;

  if (!rewarderAddress) {
    throw new Error(
      'ArkadaRewarder address not found. Set REWARDER_ADDRESS env var ' +
        'or arkadaRewarder in config/constants/addresses.ts',
    );
  }

  const { deployer } = await hre.getNamedAccounts();
  const signer = await ethers.getSigner(deployer);
  console.log('Network :', hre.network.name);
  console.log('Signer  :', deployer);
  console.log('Rewarder:', rewarderAddress);

  const rewarder = await ethers.getContractAt(
    ARKADA_REWARDER_CONTRACT_NAME,
    rewarderAddress,
    signer,
  );

  const rows = parseCsv(csvPath);
  console.log(`\nLeaderboard rows: ${rows.length}\n`);

  // Read current on-chain rewards, then compute new totals = current + delta.
  const currents = await Promise.all(
    rows.map((r) => rewarder.userRewards(r.address)),
  );

  const users: string[] = [];
  const newTotals: ReturnType<typeof ethers.BigNumber.from>[] = [];
  let totalDelta = ethers.BigNumber.from(0);

  rows.forEach((r, i) => {
    const delta = parseEther(r.deltaEth);
    const current = currents[i];
    const next = current.add(delta);
    users.push(r.address);
    newTotals.push(next);
    totalDelta = totalDelta.add(delta);
    console.log(
      `${(i + 1).toString().padStart(2)}. ${r.address}  ` +
        `current=${formatEther(current)}  +${r.deltaEth}  => ${formatEther(
          next,
        )}`,
    );
  });

  console.log(`\nTotal NEW rewards added: ${formatEther(totalDelta)} ETH`);

  // The contract must hold enough ETH to cover ALL pending claims.
  const balance = await ethers.provider.getBalance(rewarderAddress);
  const totalOwed = newTotals.reduce(
    (acc, v) => acc.add(v),
    ethers.BigNumber.from(0),
  );
  console.log(`Contract balance       : ${formatEther(balance)} ETH`);
  console.log(`Total owed (these users): ${formatEther(totalOwed)} ETH`);
  if (balance.lt(totalDelta)) {
    console.warn(
      `\n⚠️  Contract balance is below the newly added amount ` +
        `(${formatEther(
          totalDelta,
        )} ETH). Fund the contract so users can claim.`,
    );
  }

  if (dryRun) {
    console.log('\nDRY_RUN=true → not sending transaction.');
    return;
  }

  console.log('\nSending addRewards transaction...');
  const tx = await rewarder['addRewards(address[],uint256[])'](
    users,
    newTotals,
  );
  console.log('tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}. Done.`);
};

func(hre).catch((e) => {
  console.error(e);
  process.exit(1);
});
