import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Factory__factory, Pyramid__factory } from '../../typechain-types';
import { encodeString } from './common.helpers';

export async function defaultDeploy() {
  const [owner, user, treasury, questSigner] = await ethers.getSigners();

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

  const TYPE_HASH = encodeString(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
  );

  const { chainId } = await ethers.provider.getNetwork();

  const factoryContract = await new Factory__factory(owner).deploy();
  await expect(
    factoryContract.initialize(
      ethers.constants.AddressZero,
      pyramidContract.address,
    ),
  ).to.be.revertedWithCustomError(factoryContract, 'Factory__ZeroAddress');
  await factoryContract.initialize(owner.address, pyramidContract.address);

  return {
    owner,
    user,
    treasury,
    questSigner,
    pyramidContract,
    factoryContract,
    domain: {
      ...domain,
      chainId,
      verifyingContract: pyramidContract.address,
    },
    QUEST_ID: 1,
    COMMUNITIES: ['community1', 'community2'],
    TITLE: 'Test Quest',
    DIFFICULTY: 1,
    QUEST_TYPE: 1,
    TAGS: ['tag1', 'tag2'],
  };
}
