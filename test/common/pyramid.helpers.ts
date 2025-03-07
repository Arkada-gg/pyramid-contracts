import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import { Pyramid } from '../../typechain-types';
import { OptionalCommonParams } from './common.helpers';

type CommonParams = {
  pyramidContract: Pyramid;
  owner: SignerWithAddress;
};

interface ISetIsMintingActiveTest extends CommonParams {
  isActive: boolean;
}
export const setIsMintingActiveTest = async (
  { pyramidContract, owner, isActive }: ISetIsMintingActiveTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).setIsMintingActive(isActive),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(
    pyramidContract.connect(sender).setIsMintingActive(isActive),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events['MintingSwitch(bool)'].name,
  ).to.not.reverted;

  expect(await pyramidContract.s_isMintingActive()).eq(isActive);
};

interface ISetTreasuryTest extends CommonParams {
  treasury: string;
}
export const setTreasuryTest = async (
  { pyramidContract, owner, treasury }: ISetTreasuryTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).setTreasury(treasury),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(pyramidContract.connect(sender).setTreasury(treasury)).to.emit(
    pyramidContract,
    pyramidContract.interface.events['UpdatedTreasury(address)'].name,
  ).to.not.reverted;

  expect(await pyramidContract.s_treasury()).eq(treasury);
};

interface IWithdrawTest extends CommonParams {
  value: BigNumber;
}
export const withdrawTest = async (
  { pyramidContract, owner, value }: IWithdrawTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(pyramidContract.connect(sender).withdraw()).revertedWith(
      opt?.revertMessage,
    );
    return;
  }

  const balanceBefore = await pyramidContract.provider.getBalance(
    sender.address,
  );

  await expect(pyramidContract.connect(sender).withdraw()).to.emit(
    pyramidContract,
    pyramidContract.interface.events['ContractWithdrawal(uint256)'].name,
  ).to.not.reverted;

  const balanceAfter = await pyramidContract.provider.getBalance(
    sender.address,
  );
  expect(balanceAfter).gt(balanceBefore);
};

interface IInitializeQuestTest extends CommonParams {
  questId: number;
  communities: string[];
  title: string;
  difficulty: number;
  questType: number;
  tags: string[];
}
export const initializeQuestTest = async (
  {
    pyramidContract,
    owner,
    questId,
    communities,
    title,
    difficulty,
    questType,
    tags,
  }: IInitializeQuestTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract
        .connect(sender)
        .initializeQuest(
          questId,
          communities,
          title,
          difficulty,
          questType,
          tags,
        ),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(
    pyramidContract
      .connect(sender)
      .initializeQuest(
        questId,
        communities,
        title,
        difficulty,
        questType,
        tags,
      ),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events[
      'QuestMetadata(uint256,uint8,uint8,string,string[],string[])'
    ].name,
  ).to.not.reverted;

  expect(await pyramidContract.isQuestActive(questId)).eq(true);
};

interface IUnpublishQuestTest extends CommonParams {
  questId: number;
}
export const unpublishQuestTest = async (
  { pyramidContract, owner, questId }: IUnpublishQuestTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).unpublishQuest(questId),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(pyramidContract.connect(sender).unpublishQuest(questId)).to.emit(
    pyramidContract,
    pyramidContract.interface.events['QuestDisabled(uint256)'].name,
  ).to.not.reverted;

  expect(await pyramidContract.isQuestActive(questId)).eq(false);
};

interface IMintPyramidTest extends CommonParams {
  data: any;
  signature: string;
  value?: BigNumber;
}
export const mintPyramidTest = async (
  { pyramidContract, owner, data, signature, value }: IMintPyramidTest,
  opt?: OptionalCommonParams,
) => {
  const sender = opt?.from ?? owner;

  if (opt?.revertMessage) {
    await expect(
      pyramidContract.connect(sender).mintPyramid(data, signature, { value }),
    ).revertedWithCustomError(pyramidContract, opt?.revertMessage);
    return;
  }

  await expect(
    pyramidContract.connect(sender).mintPyramid(data, signature, { value }),
  ).to.emit(
    pyramidContract,
    pyramidContract.interface.events[
      'PyramidClaim(uint256,uint256,address,uint256,uint256,string,string)'
    ].name,
  ).to.not.reverted;
};
