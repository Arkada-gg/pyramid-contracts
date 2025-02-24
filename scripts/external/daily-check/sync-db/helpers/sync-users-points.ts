import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { ITxData } from './sync-txs';
import { BigNumber } from 'ethers';
import { sleep } from './sleep';

interface IUserData {
  points: number;
  maxStreak: number;
  address: string;
  checksCount: number;
}

const BATCH_SIZE = 250;

const getDailyPointsUserAddresses = async (client: Client) => {
  const result = await client.query(`
    SELECT DISTINCT user_address
    FROM user_points
    WHERE point_type = 'daily';
  `);

  return result.rows.map((row) => row.user_address);
};

export const syncUsersPoints = async () => {

  const client = new Client({
    connectionString: process.env.POSTGRES_CONNECTION_URL,
  });
  console.log("--------> Connecting to postgres...")
  await client.connect()
  console.log("--------> Postgres client connected.\n")

  const dir = 'scripts-data';
  const filePathPoints = path.join(dir, 'users-points.json');
  const filePathTxs = path.join(dir, 'tx.json');

  const usersPointsJson = fs.readFileSync(filePathPoints, 'utf-8');
  const usersPointsObj: Record<string, IUserData> = JSON.parse(usersPointsJson);
  const usersPoints = Object.values(usersPointsObj);

  const txsJson = fs.readFileSync(filePathTxs, 'utf-8');
  const txs: ITxData[] = JSON.parse(txsJson);

  try {
    await client.query('BEGIN');

    console.log('Removing daily points from users.points...\n');

    const userAddresses = await getDailyPointsUserAddresses(client);

    for (let i = 0; i < userAddresses.length; i += BATCH_SIZE) {
      const batch = userAddresses.slice(i, i + BATCH_SIZE);

      await client.query(
        `
        CREATE TEMP TABLE temp_users_backup AS
        SELECT address, points AS old_points FROM users
        WHERE address = ANY($1);
      `,
        [batch],
      );

      const updateResult = await client.query(
        `
        UPDATE users
        SET points = GREATEST(0, users.points - COALESCE((
            SELECT SUM(up.points)
            FROM user_points up
            WHERE up.user_address = users.address
            AND up.point_type = 'daily'
        ), 0))
        WHERE address = ANY($1);
      `,
        [batch],
      );

      const result = await client.query(
        `
        SELECT u.address, 
               ub.old_points, 
               u.points AS new_points, 
               (ub.old_points - u.points) AS points_deducted
        FROM users u
        JOIN temp_users_backup ub ON u.address = ub.address
        WHERE ub.old_points <> u.points
        AND (ub.old_points - u.points) > 0;
      `,
      );

      console.log(`Removed daily points for batch of size ${batch.length}`);
      const updatedUsersPointsCount = updateResult.rowCount;
      const checkHowMuchUpdatedCorrect = result.rowCount;
      if (updatedUsersPointsCount !== checkHowMuchUpdatedCorrect)
        throw new Error('Check failed');

      await client.query('DROP TABLE temp_users_backup');

      if (batch.length === BATCH_SIZE) {
        console.log('Waiting for 3 sec before next batch');
        await sleep(3000);
      }
    }
    console.log('\nDaily points removed from users.points\n');

    console.log(
      'Deleting all operated daily points from users_points table...',
    );
    await client.query("DELETE FROM user_points WHERE point_type = 'daily'");
    console.log('All operated daily points deleted from users_points table.\n');

    console.log('Updating user.points...\n');
    for (let i = 0; i < usersPoints.length; i += BATCH_SIZE) {
      const batch = usersPoints.slice(i, i + BATCH_SIZE);

      const currentPointsResult = await client.query(
        `SELECT address, points FROM users WHERE address = ANY($1)`,
        [batch.map((u) => u.address)],
      );

      const currentPointsMap = new Map(
        currentPointsResult.rows.map((row) => [row.address, row.points]),
      );

      const query = `
        UPDATE users
        SET points = users.points + data.new_points
        FROM jsonb_to_recordset($1::jsonb) 
        AS data(user_address text, new_points int)
        WHERE users.address = data.user_address
      `;
      await client.query(query, [
        JSON.stringify(
          batch.map((i) => ({
            user_address: i.address,
            new_points: i.points,
          })),
        ),
      ]);

      const updatedPointsResult = await client.query(
        `SELECT address, points FROM users WHERE address = ANY($1)`,
        [batch.map((u) => u.address)],
      );

      // Check if points were correctly updated
      const failedUpdates = [];
      for (const row of updatedPointsResult.rows) {
        const expectedPoints =
          currentPointsMap.get(row.address) +
          batch.find((u) => u.address?.toLowerCase() === row.address)?.points;
        if (row.points !== expectedPoints) {
          failedUpdates.push({
            address: row.address,
            expected: expectedPoints,
            actual: row.points,
          });
        }
      }

      if (failedUpdates.length > 0) {
        console.error('Failed updates:', failedUpdates);
        throw new Error('Points update validation failed');
      }
      console.log(`Updated points for batch of size ${batch.length}`);

      if (batch.length === BATCH_SIZE) {
        console.log('Waiting for 3 sec before next batch');
        await sleep(3000);
      }
    }
    console.log('\nUsers points updated.\n');

    console.log('Inserting points to user_points...\n');
    for (let i = 0; i < txs.length; i += BATCH_SIZE) {
      const batch = txs.slice(i, i + BATCH_SIZE);
      const query = `
        INSERT INTO user_points (user_address, points, point_type)
        VALUES 
          ${batch
            .map(
              (_, index) =>
                `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
            )
            .join(', ')}
      `;

      const values = batch.flatMap((item) => {
        const args = JSON.parse(item.args);
        const caller = args[0];
        const streakNumber = +BigNumber.from(args[1]);
        const points = streakNumber < 30 ? streakNumber : 30;
        return [caller, points, 'daily'];
      });

      await client.query(query, values);
      console.log(`Inserted for batch of size ${batch.length}`);

      if (batch.length === BATCH_SIZE) {
        console.log('Waiting for 3 sec before next batch');
        await sleep(3000);
      }
    }
    console.log('\nPoints inserted to user_points...\n');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error((error as Error).message);
  }
};
