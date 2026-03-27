import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  ERC1155Mock,
  ERC20Mock,
  ERC721Mock,
  Factory__factory,
  GlobalEscrow__factory,
  PyramidEscrowLatest__factory,
} from '../typechain-types';
import { IMintPyramidData, signMintDataTypedV4 } from './common/common.helpers';

async function deployLatest() {
  const [owner, user, treasury, questSigner, admin, ...regularAccounts] =
    await ethers.getSigners();

  const domain = {
    name: 'pyramid',
    version: '1',
  };

  const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
  const erc20Token = (await ERC20MockFactory.deploy(
    'Test Token',
    'TEST',
  )) as ERC20Mock;
  await erc20Token.deployed();

  const ERC721MockFactory = await ethers.getContractFactory('ERC721Mock');
  const erc721Token = (await ERC721MockFactory.deploy(
    'Test NFT',
    'TNFT',
  )) as ERC721Mock;
  await erc721Token.deployed();

  const ERC1155MockFactory = await ethers.getContractFactory('ERC1155Mock');
  const erc1155Token = (await ERC1155MockFactory.deploy()) as ERC1155Mock;
  await erc1155Token.deployed();

  const globalEscrowContract = await new GlobalEscrow__factory(owner).deploy();
  await globalEscrowContract.initialize(
    owner.address,
    [erc20Token.address, erc721Token.address, erc1155Token.address],
    treasury.address,
  );
  await globalEscrowContract.grantRole(
    await globalEscrowContract.WITHDRAWER_ROLE(),
    owner.address,
  );
  await globalEscrowContract.grantRole(
    await globalEscrowContract.DISTRIBUTOR_ROLE(),
    owner.address,
  );

  const pyramidContract = await new PyramidEscrowLatest__factory(
    owner,
  ).deploy();
  await pyramidContract.initialize(
    'Pyramid',
    'PYR',
    domain.name,
    domain.version,
    owner.address,
  );

  await globalEscrowContract.grantRole(
    await globalEscrowContract.DISTRIBUTOR_ROLE(),
    pyramidContract.address,
  );
  await pyramidContract.grantRole(
    await pyramidContract.SIGNER_ROLE(),
    questSigner.address,
  );
  await pyramidContract.setTreasury(treasury.address);

  const { chainId } = await ethers.provider.getNetwork();

  const factoryContract = await new Factory__factory(owner).deploy();
  await factoryContract.initialize(owner.address, pyramidContract.address);

  const QUEST_ID = 'test';
  const QUEST_ID_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(QUEST_ID),
  );

  await factoryContract.createEscrow(
    QUEST_ID_HASH,
    admin.address,
    [erc20Token.address, erc721Token.address, erc1155Token.address],
    treasury.address,
  );

  const escrowAddress = await factoryContract.s_escrows(QUEST_ID_HASH);
  await erc20Token.mint(escrowAddress, parseEther('1000'));
  await erc721Token.mint(escrowAddress, 1);
  await erc1155Token.mint(escrowAddress, 1, 100, '0x');
  await user.sendTransaction({ to: escrowAddress, value: parseEther('10') });

  await erc20Token.mint(globalEscrowContract.address, parseEther('1000'));
  await erc721Token.mint(globalEscrowContract.address, 2);
  await erc1155Token.mint(globalEscrowContract.address, 2, 100, '0x');
  await user.sendTransaction({
    to: globalEscrowContract.address,
    value: parseEther('1000'),
  });

  const domainEscrow = {
    ...domain,
    chainId,
    verifyingContract: pyramidContract.address,
  };

  return {
    owner,
    user,
    treasury,
    questSigner,
    admin,
    regularAccounts,
    pyramidContract,
    factoryContract,
    globalEscrowContract,
    tokens: { erc20Token, erc721Token, erc1155Token },
    domainEscrow,
    QUEST_ID,
    QUEST_ID_HASH,
  };
}

function buildMintData(
  questId: string,
  questIdHash: string,
  toAddress: string,
  overrides: Partial<IMintPyramidData> = {},
): IMintPyramidData {
  return {
    questId,
    nonce: 1,
    price: parseEther('0.1'),
    toAddress,
    walletProvider: 'walletProvider',
    tokenURI: 'tokenURI',
    embedOrigin: 'embedOrigin',
    transactions: [{ txHash: '0x123', networkChainId: 'evm:1' }],
    recipients: [],
    reward: {
      questIdHash,
      tokenAddress: ethers.constants.AddressZero,
      chainId: 0,
      amount: 0,
      tokenId: 0,
      tokenType: 0,
      rakeBps: 0,
      factoryAddress: ethers.constants.AddressZero,
    },
    globalReward: {
      tokenAddress: ethers.constants.AddressZero,
      amount: 0,
      tokenId: 0,
      tokenType: 0,
      rakeBps: 0,
      escrowAddress: ethers.constants.AddressZero,
    },
    ...overrides,
  };
}

describe.only('PyramidEscrowLatest', () => {
  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { pyramidContract, owner } = await loadFixture(deployLatest);
      expect(
        await pyramidContract.hasRole(
          await pyramidContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set initial minting state to true', async () => {
      const { pyramidContract } = await loadFixture(deployLatest);
      expect(await pyramidContract.s_isMintingActive()).to.equal(true);
    });

    it('Should set correct token name and symbol', async () => {
      const { pyramidContract } = await loadFixture(deployLatest);
      expect(await pyramidContract.name()).to.equal('Pyramid');
      expect(await pyramidContract.symbol()).to.equal('PYR');
    });

    it('Should return correct pyramid version', async () => {
      const { pyramidContract } = await loadFixture(deployLatest);
      expect(await pyramidContract.pyramidVersion()).to.equal('1');
    });

    it('Should revert if admin is zero address', async () => {
      const [owner] = await ethers.getSigners();
      const contract = await new PyramidEscrowLatest__factory(owner).deploy();
      await expect(
        contract.initialize(
          'Pyramid',
          'PYR',
          'pyramid',
          '1',
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWithCustomError(contract, 'Pyramid__InvalidAdminAddress');
    });

    it('Should support ERC721 and AccessControl interfaces', async () => {
      const { pyramidContract } = await loadFixture(deployLatest);
      expect(await pyramidContract.supportsInterface('0x80ac58cd')).to.equal(
        true,
      );
      expect(await pyramidContract.supportsInterface('0x7965db0b')).to.equal(
        true,
      );
      expect(await pyramidContract.supportsInterface('0x12345678')).to.equal(
        false,
      );
    });
  });

  describe('Minting Control', () => {
    it('Should allow owner to enable and disable minting', async () => {
      const { pyramidContract } = await loadFixture(deployLatest);

      await expect(pyramidContract.setIsMintingActive(false))
        .to.emit(pyramidContract, 'MintingSwitch')
        .withArgs(false);
      expect(await pyramidContract.s_isMintingActive()).to.equal(false);

      await expect(pyramidContract.setIsMintingActive(true))
        .to.emit(pyramidContract, 'MintingSwitch')
        .withArgs(true);
      expect(await pyramidContract.s_isMintingActive()).to.equal(true);
    });

    it('Should not allow non-owner to set minting state', async () => {
      const { pyramidContract, user } = await loadFixture(deployLatest);
      await expect(
        pyramidContract.connect(user).setIsMintingActive(false),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('Treasury Management', () => {
    it('Should allow owner to set treasury', async () => {
      const { pyramidContract, treasury } = await loadFixture(deployLatest);
      await expect(pyramidContract.setTreasury(treasury.address))
        .to.emit(pyramidContract, 'UpdatedTreasury')
        .withArgs(treasury.address);
      expect(await pyramidContract.s_treasury()).to.equal(treasury.address);
    });

    it('Should not allow non-owner to set treasury', async () => {
      const { pyramidContract, user, treasury } = await loadFixture(
        deployLatest,
      );
      await expect(
        pyramidContract.connect(user).setTreasury(treasury.address),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('Should not allow setting treasury to zero address', async () => {
      const { pyramidContract } = await loadFixture(deployLatest);
      await expect(
        pyramidContract.setTreasury(ethers.constants.AddressZero),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__ZeroAddress');
    });
  });

  describe('Withdrawal', () => {
    it('Should allow owner to withdraw funds left after overpaid mint', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      // Send 1 ETH but price is 0.1 ETH — surplus stays in contract
      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        price: parseEther('0.1'),
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );
      await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('1') });

      const contractBalance = await ethers.provider.getBalance(
        pyramidContract.address,
      );
      expect(contractBalance).to.be.gt(0);

      const ownerBalanceBefore = await ethers.provider.getBalance(
        owner.address,
      );

      await expect(pyramidContract.withdraw())
        .to.emit(pyramidContract, 'ContractWithdrawal')
        .withArgs(contractBalance);

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });

    it('Should not allow non-owner to withdraw', async () => {
      const { pyramidContract, user } = await loadFixture(deployLatest);
      await expect(
        pyramidContract.connect(user).withdraw(),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('tokenURI', () => {
    it('Should return token URI after minting', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        tokenURI: 'ipfs://test-token-uri',
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      expect(await pyramidContract.tokenURI(0)).to.equal(
        'ipfs://test-token-uri',
      );
    });
  });

  describe('Minting', () => {
    it('Should revert when minting is inactive', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      await pyramidContract.setIsMintingActive(false);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address);
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__MintingIsNotActive',
      );
    });

    it('Should revert when treasury is not set', async () => {
      const [owner, user, , questSigner] = await ethers.getSigners();
      const { chainId } = await ethers.provider.getNetwork();

      const contract = await new PyramidEscrowLatest__factory(owner).deploy();
      await contract.initialize(
        'Pyramid',
        'PYR',
        'pyramid',
        '1',
        owner.address,
      );
      await contract.grantRole(
        await contract.SIGNER_ROLE(),
        questSigner.address,
      );

      const QUEST_ID = 'test';
      const QUEST_ID_HASH = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(QUEST_ID),
      );
      const domain = {
        name: 'pyramid',
        version: '1',
        chainId,
        verifyingContract: contract.address,
      };

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address);
      const signature = await signMintDataTypedV4(data, questSigner, domain);

      await expect(
        contract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(contract, 'Pyramid__TreasuryNotSet');
    });

    it('Should revert with invalid signature (non-signer)', async () => {
      const { pyramidContract, user, QUEST_ID, QUEST_ID_HASH, domainEscrow } =
        await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address);
      // user is not a signer
      const signature = await signMintDataTypedV4(data, user, domainEscrow);

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__IsNotSigner');
    });

    it('Should revert with already used nonce', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address);
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      // Second mint with same nonce and different questId to avoid MintedForQuestId
      const data2 = buildMintData(
        'other-quest',
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes('other-quest')),
        user.address,
        { nonce: 1 },
      );
      const signature2 = await signMintDataTypedV4(
        data2,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data2, signature2, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__NonceAlreadyUsed',
      );
    });

    it('Should revert when minting the same quest twice for the same address', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        nonce: 1,
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );
      await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      const data2 = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        nonce: 2,
      });
      const signature2 = await signMintDataTypedV4(
        data2,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data2, signature2, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__MintedForQuestId',
      );
    });

    it('Should revert when BPS exceeds 10000', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        recipients: [{ recipient: user.address, BPS: 10001 }],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__BPSTooHigh');
    });

    it('Should revert when total fee payout exceeds price', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      // Two recipients each with 6000 BPS = 120% total > price
      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        recipients: [
          { recipient: user.address, BPS: 6000 },
          { recipient: questSigner.address, BPS: 6000 },
        ],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__ExcessiveFeePayout',
      );
    });

    it('Should revert when msg.value is less than price', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        price: parseEther('0.1'),
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.05') }),
      ).to.be.revertedWithCustomError(pyramidContract, 'Pyramid__FeeNotEnough');
    });

    it('Should revert when recipient transfer fails', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      // Use ERC20 contract as recipient — it has no receive(), so ETH transfer fails
      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        recipients: [{ recipient: tokens.erc20Token.address, BPS: 100 }],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__TransferFailed',
      );
    });

    it('Should revert when treasury payment fails (treasury rejects ETH)', async () => {
      const {
        pyramidContract,
        owner,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      // Set treasury to ERC20 contract — no receive(), so ETH transfer fails
      await pyramidContract
        .connect(owner)
        .setTreasury(tokens.erc20Token.address);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        recipients: [],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      await expect(
        pyramidContract
          .connect(user)
          .mintPyramid(data, signature, { value: parseEther('0.1') }),
      ).to.be.revertedWithCustomError(
        pyramidContract,
        'Pyramid__NativePaymentFailed',
      );
    });

    it('Should mint successfully without any rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const price = parseEther('0.1');
      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        price,
        transactions: [],
        recipients: [],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: price });

      await expect(tx)
        .to.emit(pyramidContract, 'PyramidClaim')
        .withArgs(
          QUEST_ID,
          0,
          user.address,
          price,
          0,
          1,
          'walletProvider',
          'embedOrigin',
        );

      await expect(tx)
        .to.emit(pyramidContract, 'TreasuryPayout')
        .withArgs(treasury.address, price);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter.sub(treasuryBefore)).to.equal(price);

      expect(await pyramidContract.ownerOf(0)).to.equal(user.address);
      expect(await pyramidContract.tokenURI(0)).to.equal('tokenURI');
    });

    it('Should mint with multiple transactions and emit PyramidTransaction events', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        transactions: [
          { txHash: '0xaaa', networkChainId: 'evm:1' },
          { txHash: '0xbbb', networkChainId: 'evm:137' },
        ],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'PyramidTransaction')
        .withArgs(0, '0xaaa', 'evm:1');
      await expect(tx)
        .to.emit(pyramidContract, 'PyramidTransaction')
        .withArgs(0, '0xbbb', 'evm:137');
    });

    it('Should correctly distribute fees to recipient and treasury', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const price = parseEther('0.1');
      const BPS = 1000; // 10%
      const MAX_BPS = 10000;

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        price,
        recipients: [{ recipient: questSigner.address, BPS }],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedRecipientPayout = price.mul(BPS).div(MAX_BPS);
      const expectedTreasuryPayout = price.sub(expectedRecipientPayout);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      const recipientBefore = await ethers.provider.getBalance(
        questSigner.address,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: price });

      await expect(tx)
        .to.emit(pyramidContract, 'FeePayout')
        .withArgs(questSigner.address, expectedRecipientPayout);
      await expect(tx)
        .to.emit(pyramidContract, 'TreasuryPayout')
        .withArgs(treasury.address, expectedTreasuryPayout);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const recipientAfter = await ethers.provider.getBalance(
        questSigner.address,
      );

      expect(treasuryAfter.sub(treasuryBefore)).to.equal(
        expectedTreasuryPayout,
      );
      expect(recipientAfter.sub(recipientBefore)).to.equal(
        expectedRecipientPayout,
      );
    });

    it('Should skip ETH transfer for zero address recipient', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        treasury,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const price = parseEther('0.1');
      const BPS = 1000; // 10%
      const MAX_BPS = 10000;

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        price,
        recipients: [{ recipient: ethers.constants.AddressZero, BPS }],
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const expectedTreasuryPayout = price.sub(price.mul(BPS).div(MAX_BPS));
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: price });

      // No FeePayout event for zero-address recipient
      const receipt = await tx.wait();
      const feePayoutEvents = receipt.events?.filter(
        (e) => e.event === 'FeePayout',
      );
      expect(feePayoutEvents?.length).to.equal(0);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter.sub(treasuryBefore)).to.equal(
        expectedTreasuryPayout,
      );
    });

    it('Should mint with native token factory rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const rewards = parseEther('0.01');

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: ethers.constants.AddressZero,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 3, // NATIVE
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const userBefore = await ethers.provider.getBalance(user.address);

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, ethers.constants.AddressZero, 1, rewards, 0, 3);

      const userAfter = await ethers.provider.getBalance(user.address);
      // user paid 0.1 ETH and received rewards from escrow
      expect(userAfter).to.be.gt(userBefore.sub(parseEther('0.1')));
    });

    it('Should mint with native token global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const rewards = parseEther('0.01');

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        globalReward: {
          tokenAddress: ethers.constants.AddressZero,
          amount: rewards,
          tokenId: 0,
          tokenType: 3, // NATIVE
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, ethers.constants.AddressZero, 0, rewards, 0, 3);
    });

    it('Should mint with ERC20 factory rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const rewards = parseEther('1');

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc20Token.address,
          chainId: 1,
          amount: rewards,
          tokenId: 0,
          tokenType: 0, // ERC20
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const userErc20Before = await tokens.erc20Token.balanceOf(user.address);

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc20Token.address, 1, rewards, 0, 0);

      const userErc20After = await tokens.erc20Token.balanceOf(user.address);
      expect(userErc20After.sub(userErc20Before)).to.equal(rewards);
    });

    it('Should mint with ERC20 global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const rewards = parseEther('1');

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        globalReward: {
          tokenAddress: tokens.erc20Token.address,
          amount: rewards,
          tokenId: 0,
          tokenType: 0, // ERC20
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const userErc20Before = await tokens.erc20Token.balanceOf(user.address);

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc20Token.address, 0, rewards, 0, 0);

      const userErc20After = await tokens.erc20Token.balanceOf(user.address);
      expect(userErc20After.sub(userErc20Before)).to.equal(rewards);
    });

    it('Should mint with ERC721 factory rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc721Token.address,
          chainId: 1,
          amount: 1,
          tokenId: 1,
          tokenType: 1, // ERC721
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc721Token.address, 1, 1, 1, 1);

      expect(await tokens.erc721Token.ownerOf(1)).to.equal(user.address);
    });

    it('Should mint with ERC721 global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        globalReward: {
          tokenAddress: tokens.erc721Token.address,
          amount: 1,
          tokenId: 2,
          tokenType: 1, // ERC721
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc721Token.address, 0, 1, 2, 1);

      expect(await tokens.erc721Token.ownerOf(2)).to.equal(user.address);
    });

    it('Should mint with ERC1155 factory rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        factoryContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const amount = 10;

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc1155Token.address,
          chainId: 1,
          amount,
          tokenId: 1,
          tokenType: 2, // ERC1155
          rakeBps: 0,
          factoryAddress: factoryContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const userBalanceBefore = await tokens.erc1155Token.balanceOf(
        user.address,
        1,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc1155Token.address, 1, amount, 1, 2);

      const userBalanceAfter = await tokens.erc1155Token.balanceOf(
        user.address,
        1,
      );
      expect(userBalanceAfter.sub(userBalanceBefore)).to.equal(amount);
    });

    it('Should mint with ERC1155 global rewards', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        globalEscrowContract,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const amount = 5;

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        globalReward: {
          tokenAddress: tokens.erc1155Token.address,
          amount,
          tokenId: 2,
          tokenType: 2, // ERC1155
          rakeBps: 0,
          escrowAddress: globalEscrowContract.address,
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const userBalanceBefore = await tokens.erc1155Token.balanceOf(
        user.address,
        2,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc1155Token.address, 0, amount, 2, 2);

      const userBalanceAfter = await tokens.erc1155Token.balanceOf(
        user.address,
        2,
      );
      expect(userBalanceAfter.sub(userBalanceBefore)).to.equal(amount);
    });

    it('Should emit TokenReward when chainId != 0 but factoryAddress is zero', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
        tokens,
      } = await loadFixture(deployLatest);

      const rewards = parseEther('1');

      const data = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        reward: {
          questIdHash: QUEST_ID_HASH,
          tokenAddress: tokens.erc20Token.address,
          chainId: 999, // non-zero chainId
          amount: rewards,
          tokenId: 0,
          tokenType: 0,
          rakeBps: 0,
          factoryAddress: ethers.constants.AddressZero, // no factory
        },
      });
      const signature = await signMintDataTypedV4(
        data,
        questSigner,
        domainEscrow,
      );

      const tx = await pyramidContract
        .connect(user)
        .mintPyramid(data, signature, { value: parseEther('0.1') });

      // TokenReward should be emitted even without factory call
      await expect(tx)
        .to.emit(pyramidContract, 'TokenReward')
        .withArgs(0, tokens.erc20Token.address, 999, rewards, 0, 0);
    });

    it('Should increment token ID and quest issue number across multiple mints', async () => {
      const {
        pyramidContract,
        user,
        questSigner,
        regularAccounts,
        QUEST_ID,
        QUEST_ID_HASH,
        domainEscrow,
      } = await loadFixture(deployLatest);

      const data1 = buildMintData(QUEST_ID, QUEST_ID_HASH, user.address, {
        nonce: 1,
      });
      const sig1 = await signMintDataTypedV4(data1, questSigner, domainEscrow);
      await pyramidContract
        .connect(user)
        .mintPyramid(data1, sig1, { value: parseEther('0.1') });

      // Mint same quest for a different address
      const user2 = regularAccounts[0];
      const data2 = buildMintData(QUEST_ID, QUEST_ID_HASH, user2.address, {
        nonce: 2,
        toAddress: user2.address,
      });
      const sig2 = await signMintDataTypedV4(data2, questSigner, domainEscrow);

      const tx = await pyramidContract
        .connect(user2)
        .mintPyramid(data2, sig2, { value: parseEther('0.1') });

      // Token ID should be 1 for second mint, issue number should be 2
      await expect(tx)
        .to.emit(pyramidContract, 'PyramidClaim')
        .withArgs(
          QUEST_ID,
          1,
          user2.address,
          parseEther('0.1'),
          0,
          2,
          'walletProvider',
          'embedOrigin',
        );

      expect(await pyramidContract.ownerOf(0)).to.equal(user.address);
      expect(await pyramidContract.ownerOf(1)).to.equal(user2.address);
    });
  });
});
