import { syncTxs } from './helpers/sync-txs';
import { syncUsersPoints } from './helpers/sync-users-points';

const func = async () => {

  console.log(
    '--------> Reading txs data and syncing with pg db...',
  );
  await syncTxs();
 
  console.log('--------------------------------------------\n');

  console.log(
    '--------> Syncing users points...',
  );
  await syncUsersPoints()
  console.log("--------> Users points synced.")

  process.exit(1)
};

func().then(console.log).catch(console.error);
