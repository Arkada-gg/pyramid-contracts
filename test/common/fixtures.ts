import { ethers } from 'hardhat';

import {
  // eslint-disable-next-line camelcase
  DailyCheck__factory,
} from '../../typechain-types';

export const defaultDeploy = async () => {
  const [owner, ...regularAccounts] = await ethers.getSigners();

  // main contracts
  const dailyCheck = await new DailyCheck__factory(owner).deploy();
  await dailyCheck.initialize();

  return {
    owner,
    regularAccounts,
    dailyCheck,
  };
};
