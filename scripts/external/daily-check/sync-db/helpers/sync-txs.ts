import { Client } from 'pg';

import fs from 'fs';
import path from 'path';

import { sleep } from './sleep';

export interface ITxData {
  hash: string;
  event_name: string;
  block_number: number;
  args: string;
  created_at: string;
}

const BATCH_SIZE = 250;

export const syncTxs = async () => {
  const client = new Client({
    connectionString: process.env.POSTGRES_CONNECTION_URL,
  });
  console.log('--------> Connecting to postgres...');
  await client.connect();
  console.log('--------> Postgres client connected.\n');

  const dir = 'scripts-data';
  const filePath = path.join(dir, 'tx.json');

  const txsJson = fs.readFileSync(filePath, 'utf-8');

  const txs: ITxData[] = JSON.parse(txsJson);
  console.log(`Total transactions count: ${txs.length} \n`);

  try {
    await client.query('BEGIN');

    console.log('Truncating transactions table...');
    await client.query(`TRUNCATE TABLE transactions`);
    console.log('Transactions table truncated.\n');

    console.log('Syncing transactions in batches...\n');

    // Process in batches
    for (let i = 0; i < txs.length; i += BATCH_SIZE) {
      const batch = txs.slice(i, i + BATCH_SIZE);
      const query = `
      INSERT INTO transactions (hash, event_name, block_number, args, created_at)
      VALUES 
        ${batch
          .map(
            (_, index) =>
              `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${
                index * 5 + 4
              }, $${index * 5 + 5})`,
          )
          .join(', ')}
    `;
      console.log(
        `Inserting batch ${i / BATCH_SIZE + 1} batch size: ${batch.length}...`,
      );
      await client.query(
        query,
        batch.flatMap((tx) => [
          tx.hash,
          tx.event_name,
          tx.block_number,
          tx.args,
          tx.created_at,
        ]),
      );

      if (batch.length === BATCH_SIZE) {
        console.log('Waiting for 3 sec before next batch');
        await sleep(3000);
      }
    }

    console.log('\nTransactions synced!\n');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error((error as Error).message);
  }
};
