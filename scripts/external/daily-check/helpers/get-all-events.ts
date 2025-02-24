import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { DailyCheck } from '../../../../typechain-types';
import { DailyCheckEvent } from '../../../../typechain-types/contracts/DailyCheck';

const DAILY_CHECK_ADDRESS = '0x98826e728977B25279ad7629134FD0e96bd5A7b2';

export const getAllDailyCheckEvents = async (
  hre: HardhatRuntimeEnvironment,
): Promise<DailyCheckEvent[]> => {
  const dailyCheckContract: DailyCheck = await hre.ethers.getContractAt(
    'DailyCheck',
    DAILY_CHECK_ADDRESS,
  );

  const filter =
    dailyCheckContract.filters['DailyCheck(address,uint256,uint256)']();

  const events = await dailyCheckContract.queryFilter(filter);

  const sortedByBlockNumber = events.sort(
    (a, b) => b.blockNumber - a.blockNumber,
  );

  return sortedByBlockNumber;
};
