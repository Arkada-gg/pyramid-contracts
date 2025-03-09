import { expect } from 'chai';
import { ethers } from 'hardhat';

import { createEscrowTest } from './factory.helpers';

import {
  ERC1155Mock,
  ERC20Mock,
  ERC721Mock,
  // eslint-disable-next-line
  Factory__factory,
  // eslint-disable-next-line
  Pyramid__factory,
  PyramidEscrow__factory,
} from '../../typechain-types';

export async function defaultDeploy() {
  const [owner, user, treasury, questSigner, admin] = await ethers.getSigners();

  const domain = {
    name: 'pyramid',
    version: '1',
  };

  const pyramidContract = await new Pyramid__factory(owner).deploy();
  await expect(
    pyramidContract.initialize(
      'Pyramid',
      'PYR',
      domain.name,
      domain.version,
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
  );

  await pyramidContract.grantRole(
    await pyramidContract.SIGNER_ROLE(),
    questSigner.address,
  );

  await pyramidContract.setTreasury(treasury.address);

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
  };
}
