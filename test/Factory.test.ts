import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import {
  addTokenToWhitelistTest,
  createEscrowTest,
  distributeRewardsTest,
  removeTokenFromWhitelistTest,
  updateEscrowAdminTest,
  withdrawFundsTest,
} from './common/factory.helpers';

import {
  ERC1155Mock,
  ERC20Mock,
  ERC721Mock,
  Factory,
  PyramidEscrow,
} from '../typechain-types';

describe('Factory', () => {
  let factoryContract: Factory;
  let factoryContractDisributeTester: Factory;
  let pyramidContract: PyramidEscrow;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let admin: SignerWithAddress;
  let treasury: SignerWithAddress;
  let signer: SignerWithAddress;
  let erc20Token: ERC20Mock;
  let erc721Token: ERC721Mock;
  let erc1155Token: ERC1155Mock;
  let questId: string;
  let whitelistedTokens: string[];

  beforeEach(async () => {
    [owner, user, admin, treasury, signer] = await ethers.getSigners();
    questId = 'test';

    // Deploy mock tokens
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    erc20Token = (await ERC20Mock.deploy('Test Token', 'TEST')) as ERC20Mock;
    await erc20Token.deployed();

    const ERC721Mock = await ethers.getContractFactory('ERC721Mock');
    erc721Token = (await ERC721Mock.deploy('Test NFT', 'TNFT')) as ERC721Mock;
    await erc721Token.deployed();

    const ERC1155Mock = await ethers.getContractFactory('ERC1155Mock');
    erc1155Token = (await ERC1155Mock.deploy()) as ERC1155Mock;
    await erc1155Token.deployed();

    // Deploy Pyramid contract
    const PyramidEscrow = await ethers.getContractFactory('PyramidEscrow');
    pyramidContract = (await PyramidEscrow.deploy()) as PyramidEscrow;
    await pyramidContract.deployed();

    await pyramidContract.initialize(
      'Pyramid',
      'PYR',
      'test',
      '1',
      owner.address,
      owner.address, // Using owner as arkadaRewarder for testing
    );
    await pyramidContract.grantRole(
      await pyramidContract.SIGNER_ROLE(),
      signer.address,
    );

    // Deploy Factory contract
    const Factory = await ethers.getContractFactory('Factory');
    factoryContract = (await Factory.deploy()) as Factory;
    await factoryContract.deployed();

    // Initialize Factory
    await factoryContract.initialize(owner.address, pyramidContract.address);

    factoryContractDisributeTester = (await Factory.deploy()) as Factory;
    await factoryContractDisributeTester.deployed();

    // Initialize Factory
    await factoryContractDisributeTester.initialize(
      owner.address,
      owner.address, // owner like pyramid contract
    );

    whitelistedTokens = [
      erc20Token.address,
      erc721Token.address,
      erc1155Token.address,
    ];
  });

  describe('createEscrow', () => {
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
          revertMessage: 'AccessControlUnauthorizedAccount',
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
      await updateEscrowAdminTest(
        {
          factoryContract,
          owner,
          questId,
          newAdmin: user.address,
        },
        {
          from: admin,
        },
      );

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
          from: admin,
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
          questId: '2',
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
          questId: '2',
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
      const escrowAddress = await factoryContract.s_escrows(questId);
      // Setup initial balances
      await erc20Token.mint(escrowAddress, ethers.utils.parseEther('1000'));
      await erc721Token.mint(escrowAddress, 1);
      await erc1155Token.mint(escrowAddress, 1, 100, '0x');

      // Send native tokens
      await user.sendTransaction({
        to: escrowAddress,
        value: ethers.utils.parseEther('1'),
      });
    });

    it('should withdraw native tokens', async () => {
      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId,
          to: user.address,
          token: ethers.constants.AddressZero,
          tokenId: 0,
          tokenType: 3, // NATIVE
        },
        {
          from: admin,
        },
      );

      const balance = await user.getBalance();
      expect(balance).gt(0);
    });

    it('should withdraw ERC20 tokens', async () => {
      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId,
          to: user.address,
          token: erc20Token.address,
          tokenId: 0,
          tokenType: 0, // ERC20
        },
        {
          from: admin,
        },
      );

      expect(await erc20Token.balanceOf(user.address)).gt(0);
    });

    it('should withdraw ERC721 tokens', async () => {
      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId,
          to: user.address,
          token: erc721Token.address,
          tokenId: 1,
          tokenType: 1, // ERC721
        },
        {
          from: admin,
        },
      );

      expect(await erc721Token.ownerOf(1)).eq(user.address);
    });

    it('should withdraw ERC1155 tokens', async () => {
      const escrowAddress = await factoryContract.s_escrows(questId);
      const balanceBefore = await erc1155Token.balanceOf(escrowAddress, 1);
      expect(balanceBefore).eq(100);

      await withdrawFundsTest(
        {
          factoryContract,
          owner,
          questId,
          to: user.address,
          token: erc1155Token.address,
          tokenId: 1,
          tokenType: 2, // ERC1155
        },
        {
          from: admin,
        },
      );

      const balanceAfter = await erc1155Token.balanceOf(user.address, 1);
      expect(balanceAfter).eq(100);
    });

    it('should revert if quest is active', async () => {
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
          questId: '2',
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
        factoryContract: factoryContractDisributeTester,
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

      const escrowAddress = await factoryContractDisributeTester.s_escrows(
        questId,
      );

      // Setup initial balances
      await erc20Token.mint(escrowAddress, ethers.utils.parseEther('1000'));
      await erc721Token.mint(escrowAddress, 1);
      await erc1155Token.mint(escrowAddress, 1, 100, '0x');

      // Send native tokens
      await user.sendTransaction({
        to: escrowAddress,
        value: ethers.utils.parseEther('1'),
      });
    });

    it('should distribute native tokens', async () => {
      await distributeRewardsTest({
        factoryContract: factoryContractDisributeTester,
        owner,
        questId,
        token: ethers.constants.AddressZero,
        to: user.address,
        amount: ethers.utils.parseEther('0.5'),
        rewardTokenId: 0,
        tokenType: 3, // NATIVE
        rakeBps: 1000,
      });

      const balance = await user.getBalance();
      expect(balance).gt(0);
    });

    it('should distribute ERC20 tokens', async () => {
      await distributeRewardsTest({
        factoryContract: factoryContractDisributeTester,
        owner,
        questId,
        token: erc20Token.address,
        to: user.address,
        amount: ethers.utils.parseEther('100'),
        rewardTokenId: 0,
        tokenType: 0, // ERC20
        rakeBps: 1000,
      });

      expect(await erc20Token.balanceOf(user.address)).gt(0);
    });

    it('should distribute ERC721 tokens', async () => {
      await distributeRewardsTest({
        factoryContract: factoryContractDisributeTester,
        owner,
        questId,
        token: erc721Token.address,
        to: user.address,
        amount: BigNumber.from(1),
        rewardTokenId: 1,
        tokenType: 1, // ERC721
        rakeBps: 0,
      });

      expect(await erc721Token.ownerOf(1)).eq(user.address);
    });

    it('should distribute ERC1155 tokens', async () => {
      await distributeRewardsTest({
        factoryContract: factoryContractDisributeTester,
        owner,
        questId,
        token: erc1155Token.address,
        to: user.address,
        amount: BigNumber.from(50),
        rewardTokenId: 1,
        tokenType: 2, // ERC1155
        rakeBps: 1000,
      });

      expect(await erc1155Token.balanceOf(user.address, 1)).gt(0);
    });

    it('should revert if not called by Pyramid', async () => {
      await distributeRewardsTest(
        {
          factoryContract: factoryContractDisributeTester,
          owner,
          questId,
          token: erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('100'),
          rewardTokenId: 0,
          tokenType: 0, // ERC20
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
          factoryContract: factoryContractDisributeTester,
          owner,
          questId: '2',
          token: erc20Token.address,
          to: user.address,
          amount: ethers.utils.parseEther('100'),
          rewardTokenId: 0,
          tokenType: 0, // ERC20
          rakeBps: 1000,
        },
        {
          revertMessage: 'Factory__NoQuestEscrowFound',
        },
      );
    });
  });
});
