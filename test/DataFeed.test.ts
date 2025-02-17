import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import { defaultDeploy } from './common/fixtures';
import { DailyCheck__factory } from '../typechain-types';
import { checkTest } from './common/daily-check.helpers';

describe('DailyCheck', function () {
  it('deployment', async () => {
    await loadFixture(defaultDeploy);
  });

  it('initialize', async () => {
    const { dailyCheck, owner } = await loadFixture(defaultDeploy);

    await expect(dailyCheck.initialize()).revertedWith(
      'Initializable: contract is already initialized',
    );

    const dataFeedNew = await new DailyCheck__factory(owner).deploy();

    await expect(dataFeedNew.initialize()).to.be.not.reverted;
  });

  describe('check()', () => {
    it('should fail: call from address which already checked', async () => {
      const { dailyCheck, regularAccounts } = await loadFixture(defaultDeploy);

      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 1,
        },
      });

      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 2,
        },
      }, {
        revertMessage: "checked today"
      });
    });

    it('check single time', async () => {
      const { dailyCheck, regularAccounts } = await loadFixture(defaultDeploy);
      
      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 1,
        },
      });
    });

    it('streak count should be 2 when next check in next day', async () => {
      const { dailyCheck, regularAccounts } = await loadFixture(defaultDeploy);

      console.log("User A: first check");
      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 1,
        },
      });

      console.log("waiting for 1 day...");
      await time.increase(86400);

      console.log("User A: second check");
      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 2,
        },
      });
    });

    it('streak count should be 1 again when next check in 2 days', async () => {
      const { dailyCheck, regularAccounts } = await loadFixture(defaultDeploy);

      console.log("User A: first check");
      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 1,
        },
      });

      console.log("waiting for 2 day...");
      await time.increase(86400 * 2);

      console.log("User A: second check");
      await checkTest({
        dailyCheckContract: dailyCheck,
        owner: regularAccounts[0],
        expected: {
          streak: 1,
        },
      });
    });
  });

  describe('getDaysCountByTs()', () => {
    it('check calculations', async () => {
      const { dailyCheck } = await loadFixture(defaultDeploy);
      const timestamp = 1739786145;
      const expectedDaysNum = Math.floor(timestamp / 86400)
      expect(await dailyCheck.getDaysCountByTs(timestamp)).eq(expectedDaysNum)
    });
  });
});
