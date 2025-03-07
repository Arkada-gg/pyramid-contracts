import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import { Factory, Pyramid } from '../typechain-types';
import {
  addTokenToWhitelistTest,
  createEscrowTest,
  distributeRewardsTest,
  removeTokenFromWhitelistTest,
  updateEscrowAdminTest,
  withdrawFundsTest,
} from './common/factory.helpers';

describe.only('Factory', () => {
  let factoryContract: Factory;
  let pyramidContract: Pyramid;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let admin: SignerWithAddress;
  let treasury: SignerWithAddress;
  let erc20Token: any;
  let erc721Token: any;
  let erc1155Token: any;
  let questId: number;

  beforeEach(async () => {
    [owner, user, admin, treasury] = await ethers.getSigners();
    questId = 1;

    // Deploy mock tokens
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    erc20Token = await ERC20Mock.deploy('Test Token', 'TEST');
    await erc20Token.deployed();

    const ERC721Mock = await ethers.getContractFactory('ERC721Mock');
    erc721Token = await ERC721Mock.deploy('Test NFT', 'TNFT');
    await erc721Token.deployed();

    const ERC1155Mock = await ethers.getContractFactory('ERC1155Mock');
    erc1155Token = await ERC1155Mock.deploy();
    await erc1155Token.deployed();

    // Deploy Pyramid contract
    const Pyramid = await ethers.getContractFactory('Pyramid');
    pyramidContract = (await Pyramid.deploy()) as Pyramid;
    await pyramidContract.deployed();

    // Deploy Factory contract
    const Factory = await ethers.getContractFactory('Factory');
    factoryContract = (await Factory.deploy()) as Factory;
    await factoryContract.deployed();

    // Initialize Factory
    await factoryContract.initialize(owner.address, pyramidContract.address);
  });

  describe('createEscrow', () => {
    const whitelistedTokens = [
      erc20Token.address,
      erc721Token.address,
      erc1155Token.address,
    ];

    it('should create escrow', async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens,
        treasury: treasury.address,
      });

      const escrowAddress = await factoryContract.s_escrows(questId);
      expect(escrowAddress).to.not.eq(ethers.constants.AddressZero);
      expect(await factoryContract.s_escrow_admin(questId)).eq(admin.address);
    });

    it('should revert if not admin', async () => {
      await createEscrowTest(
        {
          factoryContract,
          owner,
          questId,
          admin: admin.address,
          whitelistedTokens,
          treasury: treasury.address,
        },
        {
          from: user,
          revertMessage: 'AccessControl: account',
        },
      );
    });

    it('should revert if escrow already exists', async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens,
        treasury: treasury.address,
      });

      await createEscrowTest(
        {
          factoryContract,
          owner,
          questId,
          admin: admin.address,
          whitelistedTokens,
          treasury: treasury.address,
        },
        {
          revertMessage: 'Factory__EscrowAlreadyExists',
        },
      );
    });
  });

  describe('updateEscrowAdmin', () => {
    beforeEach(async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens: [erc20Token.address],
        treasury: treasury.address,
      });
    });

    it('should update escrow admin', async () => {
      await updateEscrowAdminTest({
        factoryContract,
        owner,
        questId,
        newAdmin: user.address,
      });

      expect(await factoryContract.s_escrow_admin(questId)).eq(user.address);
    });

    it('should revert if not admin', async () => {
      await updateEscrowAdminTest(
        {
          factoryContract,
          owner,
          questId,
          newAdmin: user.address,
        },
        {
          from: user,
          revertMessage: 'Factory__OnlyCallableByAdmin',
        },
      );
    });

    it('should revert if zero address', async () => {
      await updateEscrowAdminTest(
        {
          factoryContract,
          owner,
          questId,
          newAdmin: ethers.constants.AddressZero,
        },
        {
          revertMessage: 'Factory__ZeroAddress',
        },
      );
    });
  });

  describe('addTokenToWhitelist', () => {
    beforeEach(async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens: [erc20Token.address],
        treasury: treasury.address,
      });
    });

    it('should add token to whitelist', async () => {
      await addTokenToWhitelistTest({
        factoryContract,
        owner,
        questId,
        token: erc721Token.address,
      });
    });

    it('should revert if not admin', async () => {
      await addTokenToWhitelistTest(
        {
          factoryContract,
          owner,
          questId,
          token: erc721Token.address,
        },
        {
          from: user,
          revertMessage: 'Factory__OnlyCallableByAdmin',
        },
      );
    });

    it('should revert if escrow not found', async () => {
      await addTokenToWhitelistTest(
        {
          factoryContract,
          owner,
          questId: 2,
          token: erc721Token.address,
        },
        {
          revertMessage: 'Factory__NoQuestEscrowFound',
        },
      );
    });
  });

  describe('removeTokenFromWhitelist', () => {
    beforeEach(async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens: [erc20Token.address, erc721Token.address],
        treasury: treasury.address,
      });
    });

    it('should remove token from whitelist', async () => {
      await removeTokenFromWhitelistTest({
        factoryContract,
        owner,
        questId,
        token: erc721Token.address,
      });
    });

    it('should revert if not admin', async () => {
      await removeTokenFromWhitelistTest(
        {
          factoryContract,
          owner,
          questId,
          token: erc721Token.address,
        },
        {
          from: user,
          revertMessage: 'Factory__OnlyCallableByAdmin',
        },
      );
    });

    it('should revert if escrow not found', async () => {
      await removeTokenFromWhitelistTest(
        {
          factoryContract,
          owner,
          questId: 2,
          token: erc721Token.address,
        },
        {
          revertMessage: 'Factory__NoQuestEscrowFound',
        },
      );
    });
  });

  describe('withdrawFunds', () => {
    beforeEach(async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens: [
          erc20Token.address,
          erc721Token.address,
          erc1155Token.address,
        ],
        treasury: treasury.address,
      });

      // Setup initial balances
      await erc20Token.mint(
        await factoryContract.s_escrows(questId),
        ethers.utils.parseEther('1000'),
      );
      await erc721Token.mint(await factoryContract.s_escrows(questId), 1);
      await erc1155Token.mint(
        await factoryContract.s_escrows(questId),
        1,
        100,
        '0x',
      );

      // Send native tokens
      await user.sendTransaction({
        to: await factoryContract.s_escrows(questId),
        value: ethers.utils.parseEther('1'),
      });
    });

    it('should withdraw native tokens', async () => {
      await withdrawFundsTest({
        factoryContract,
        owner,
        questId,
        to: user.address,
        token: ethers.constants.AddressZero,
        tokenId: 0,
        tokenType: 0, // NATIVE
      });

      const balance = await user.getBalance();
      expect(balance).gt(0);
    });

    it('should withdraw ERC20 tokens', async () => {
      await withdrawFundsTest({
        factoryContract,
        owner,
        questId,
        to: user.address,
        token: erc20Token.address,
        tokenId: 0,
        tokenType: 1, // ERC20
      });

      expect(await erc20Token.balanceOf(user.address)).gt(0);
    });

    it('should withdraw ERC721 tokens', async () => {
      await withdrawFundsTest({
        factoryContract,
        owner,
        questId,
        to: user.address,
        token: erc721Token.address,
        tokenId: 1,
        tokenType: 2, // ERC721
      });

      expect(await erc721Token.ownerOf(1)).eq(user.address);
    });

    it('should withdraw ERC1155 tokens', async () => {
      await withdrawFundsTest({
        factoryContract,
        owner,
        questId,
        to: user.address,
        token: erc1155Token.address,
        tokenId: 1,
        tokenType: 3, // ERC1155
      });

      expect(await erc1155Token.balanceOf(user.address, 1)).gt(0);
    });

    it('should revert if quest is active', async () => {
      await pyramidContract.connect(owner).initializeQuest(
        questId,
        ['test'],
        'Test Quest',
        0, // BEGINNER
        0, // QUEST
        ['test'],
      );

      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId,
          to: user.address,
          token: erc20Token.address,
          tokenId: 0,
          tokenType: 1,
        },
        {
          revertMessage: 'Factory__PYRAMIDQuestIsActive',
        },
      );
    });

    it('should revert if not admin', async () => {
      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId,
          to: user.address,
          token: erc20Token.address,
          tokenId: 0,
          tokenType: 1,
        },
        {
          from: user,
          revertMessage: 'Factory__OnlyCallableByAdmin',
        },
      );
    });

    it('should revert if escrow not found', async () => {
      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId: 2,
          to: user.address,
          token: erc20Token.address,
          tokenId: 0,
          tokenType: 1,
        },
        {
          revertMessage: 'Factory__NoQuestEscrowFound',
        },
      );
    });
  });

  describe('distributeRewards', () => {
    beforeEach(async () => {
      await createEscrowTest({
        factoryContract,
        owner,
        questId,
        admin: admin.address,
        whitelistedTokens: [
          erc20Token.address,
          erc721Token.address,
          erc1155Token.address,
        ],
        treasury: treasury.address,
      });

      // Setup initial balances
      await erc20Token.mint(
        await factoryContract.s_escrows(questId),
        ethers.utils.parseEther('1000'),
      );
      await erc721Token.mint(await factoryContract.s_escrows(questId), 1);
      await erc1155Token.mint(
        await factoryContract.s_escrows(questId),
        1,
        100,
        '0x',
      );

      // Send native tokens
      await user.sendTransaction({
        to: await factoryContract.s_escrows(questId),
        value: ethers.utils.parseEther('1'),
      });
    });

    it('should distribute native tokens', async () => {
      await distributeRewardsTest({
        factoryContract,
        owner,
        questId,
        token: ethers.constants.AddressZero,
        to: user.address,
        amount: ethers.utils.parseEther('0.5'),
        rewardTokenId: 0,
        tokenType: 0,
        rakeBps: 1000,
      });

      const balance = await user.getBalance();
      expect(balance).gt(0);
    });

    it('should distribute ERC20 tokens', async () => {
      await distributeRewardsTest({
        factoryContract,
        owner,
        questId,
        token: erc20Token.address,
        to: user.address,
        amount: ethers.utils.parseEther('100'),
        rewardTokenId: 0,
        tokenType: 1,
        rakeBps: 1000,
      });

      expect(await erc20Token.balanceOf(user.address)).gt(0);
    });

    it('should distribute ERC721 tokens', async () => {
      await distributeRewardsTest({
        factoryContract,
        owner,
        questId,
        token: erc721Token.address,
        to: user.address,
        amount: BigNumber.from(1),
        rewardTokenId: 1,
        tokenType: 2,
        rakeBps: 0,
      });

      expect(await erc721Token.ownerOf(1)).eq(user.address);
    });

    it('should distribute ERC1155 tokens', async () => {
      await distributeRewardsTest({
        factoryContract,
        owner,
        questId,
        token: erc1155Token.address,
        to: user.address,
        amount: BigNumber.from(50),
        rewardTokenId: 1,
        tokenType: 3,
        rakeBps: 1000,
      });

      expect(await erc1155Token.balanceOf(user.address, 1)).gt(0);
    });

    it('should revert if not called by Pyramid', async () => {
      await distributeRewardsTest(
        {
          factoryContract,
          owner,
          questId,
          token: erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('100'),
          rewardTokenId: 0,
          tokenType: 1,
          rakeBps: 1000,
        },
        {
          from: user,
          revertMessage: 'Factory__OnlyCallableByPYRAMID',
        },
      );
    });

    it('should revert if escrow not found', async () => {
      await distributeRewardsTest(
        {
          factoryContract,
          owner,
          questId: 2,
          token: erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('100'),
          rewardTokenId: 0,
          tokenType: 1,
          rakeBps: 1000,
        },
        {
          revertMessage: 'Factory__NoQuestEscrowFound',
        },
      );
    });
  });
});
