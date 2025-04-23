import { expect } from 'chai';
import { ethers } from 'hardhat';

import { createEscrowTest } from './factory.helpers';

import {
  // eslint-disable-next-line
  ArkadaPVPArena__factory,
  // eslint-disable-next-line
  ArkadaRewarder__factory,
  ERC1155Mock,
  ERC20Mock,
  ERC721Mock,
  // eslint-disable-next-line
  Factory__factory,
  // eslint-disable-next-line
  Pyramid__factory,
  // eslint-disable-next-line
  PyramidEscrow__factory,
} from '../../typechain-types';

export async function defaultDeploy() {
  const [
    owner,
    user,
    treasury,
    questSigner,
    admin,
    arenaSigner,
    ...regularAccounts
  ] = await ethers.getSigners();

  const domain = {
    name: 'pyramid',
    version: '1',
  };

  const arkadaRewarderContract = await new ArkadaRewarder__factory(
    owner,
  ).deploy();
  await expect(
    arkadaRewarderContract.initialize(ethers.constants.AddressZero),
  ).to.be.revertedWithCustomError(
    arkadaRewarderContract,
    'ArkadaRewarder__InvalidAddress',
  );
  await arkadaRewarderContract.initialize(owner.address);

  const pyramidContract = await new Pyramid__factory(owner).deploy();
  await expect(
    pyramidContract.initialize(
      'Pyramid',
      'PYR',
      domain.name,
      domain.version,
      ethers.constants.AddressZero,
      arkadaRewarderContract.address,
    ),
  ).to.be.revertedWithCustomError(
    pyramidContract,
    'Pyramid__InvalidAdminAddress',
  );
  await expect(
    pyramidContract.initialize(
      'Pyramid',
      'PYR',
      domain.name,
      domain.version,
      owner.address,
      ethers.constants.AddressZero,
    ),
  ).to.be.revertedWithCustomError(
    pyramidContract,
    'Pyramid__InvalidAdminAddress',
  );
  await pyramidContract.initialize(
    'Pyramid',
    'PYR',
    domain.name,
    domain.version,
    owner.address,
    arkadaRewarderContract.address,
  );

  await pyramidContract.grantRole(
    await pyramidContract.SIGNER_ROLE(),
    questSigner.address,
  );

  await pyramidContract.setTreasury(treasury.address);

  await arkadaRewarderContract.grantRole(
    await arkadaRewarderContract.OPERATOR_ROLE(),
    pyramidContract.address,
  );

  const pyramidEscrowContract = await new PyramidEscrow__factory(
    owner,
  ).deploy();
  await expect(
    pyramidEscrowContract.initialize(
      'Pyramid',
      'PYR',
      domain.name,
      domain.version,
      ethers.constants.AddressZero,
    ),
  ).to.be.revertedWithCustomError(
    pyramidEscrowContract,
    'Pyramid__InvalidAdminAddress',
  );
  await pyramidEscrowContract.initialize(
    'Pyramid',
    'PYR',
    domain.name,
    domain.version,
    owner.address,
  );

  await pyramidEscrowContract.grantRole(
    await pyramidEscrowContract.SIGNER_ROLE(),
    questSigner.address,
  );

  await pyramidEscrowContract.setTreasury(treasury.address);

  const { chainId } = await ethers.provider.getNetwork();

  const factoryContract = await new Factory__factory(owner).deploy();
  await expect(
    factoryContract.initialize(
      ethers.constants.AddressZero,
      pyramidEscrowContract.address,
    ),
  ).to.be.revertedWithCustomError(factoryContract, 'Factory__ZeroAddress');
  await factoryContract.initialize(
    owner.address,
    pyramidEscrowContract.address,
  );

  // Deploy mock tokens
  const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
  const erc20Token = (await ERC20Mock.deploy(
    'Test Token',
    'TEST',
  )) as ERC20Mock;
  await erc20Token.deployed();

  const ERC721Mock = await ethers.getContractFactory('ERC721Mock');
  const erc721Token = (await ERC721Mock.deploy(
    'Test NFT',
    'TNFT',
  )) as ERC721Mock;
  await erc721Token.deployed();

  const ERC1155Mock = await ethers.getContractFactory('ERC1155Mock');
  const erc1155Token = (await ERC1155Mock.deploy()) as ERC1155Mock;
  await erc1155Token.deployed();

  const QUEST_ID = 1;
  const COMMUNITIES = ['community1', 'community2'];
  const TITLE = 'Test Quest';
  const DIFFICULTY = 1;
  const QUEST_TYPE = 1;
  const TAGS = ['tag1', 'tag2'];

  await createEscrowTest({
    factoryContract,
    owner,
    questId: QUEST_ID,
    admin: admin.address,
    whitelistedTokens: [
      erc20Token.address,
      erc721Token.address,
      erc1155Token.address,
    ],
    treasury: treasury.address,
  });

  const escrowAddress = await factoryContract.s_escrows(QUEST_ID);
  // Setup initial balances
  await erc20Token.mint(escrowAddress, ethers.utils.parseEther('1000'));
  await erc721Token.mint(escrowAddress, 1);
  await erc1155Token.mint(escrowAddress, 1, 100, '0x');

  // Send native tokens
  await user.sendTransaction({
    to: escrowAddress,
    value: ethers.utils.parseEther('1'),
  });

  const arenaDomain = {
    name: 'ArenaPVP',
    version: '1',
  };

  const arenaInitialConfig = {
    feeBPS: 100,
    playersConfig: {
      min: 3,
      max: 50,
    },
    intervalToStartConfig: {
      min: 60 * 60,
      max: 60 * 60 * 5,
    },
    durationConfig: {
      min: 60 * 60,
      max: 60 * 60 * 5,
    },
  };

  const arenaContract = await new ArkadaPVPArena__factory(owner).deploy();
  await expect(
    arenaContract.initialize(
      arenaDomain.name,
      arenaDomain.version,
      ethers.constants.AddressZero,
      arenaSigner.address,
      admin.address,
      arenaInitialConfig.feeBPS,
      arenaInitialConfig.playersConfig,
      arenaInitialConfig.intervalToStartConfig,
      arenaInitialConfig.durationConfig,
    ),
  ).to.be.revertedWithCustomError(arenaContract, 'PVPArena__InvalidAddress');
  await expect(
    arenaContract.initialize(
      arenaDomain.name,
      arenaDomain.version,
      treasury.address,
      ethers.constants.AddressZero,
      admin.address,
      arenaInitialConfig.feeBPS,
      arenaInitialConfig.playersConfig,
      arenaInitialConfig.intervalToStartConfig,
      arenaInitialConfig.durationConfig,
    ),
  ).to.be.revertedWithCustomError(arenaContract, 'PVPArena__InvalidAddress');
  await expect(
    arenaContract.initialize(
      arenaDomain.name,
      arenaDomain.version,
      treasury.address,
      arenaSigner.address,
      ethers.constants.AddressZero,
      arenaInitialConfig.feeBPS,
      arenaInitialConfig.playersConfig,
      arenaInitialConfig.intervalToStartConfig,
      arenaInitialConfig.durationConfig,
    ),
  ).to.be.revertedWithCustomError(arenaContract, 'PVPArena__InvalidAddress');
  await expect(
    arenaContract.initialize(
      arenaDomain.name,
      arenaDomain.version,
      treasury.address,
      arenaSigner.address,
      owner.address,
      arenaInitialConfig.feeBPS,
      arenaInitialConfig.playersConfig,
      arenaInitialConfig.intervalToStartConfig,
      arenaInitialConfig.durationConfig,
    ),
  ).to.not.reverted;

  return {
    owner,
    user,
    treasury,
    questSigner,
    admin,
    pyramidContract,
    factoryContract,
    domain: {
      ...domain,
      chainId,
      verifyingContract: pyramidContract.address,
    },
    domainEscrow: {
      ...domain,
      chainId,
      verifyingContract: pyramidEscrowContract.address,
    },
    domainArena: {
      ...arenaDomain,
      chainId,
      verifyingContract: arenaContract.address,
    },
    QUEST_ID,
    COMMUNITIES,
    TITLE,
    DIFFICULTY,
    QUEST_TYPE,
    TAGS,
    tokens: {
      erc20Token,
      erc721Token,
      erc1155Token,
    },
    pyramidEscrowContract,
    arkadaRewarderContract,
    arenaContract,
    arenaSigner,
    arenaInitialConfig,
    regularAccounts,
  };
}
