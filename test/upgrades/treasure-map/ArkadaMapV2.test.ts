import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers, upgrades } from 'hardhat';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ArkadaMap, ArkadaMapV2 } from '../../../typechain-types';

// ================================ Helpers ================================

const MINT_DATA_TYPES = {
  MintData: [
    { name: 'to', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

const signMintData = async (
  data: { to: string; tokenId: BigNumberish; nonce: BigNumberish },
  signer: SignerWithAddress,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  },
): Promise<string> => {
  return signer._signTypedData(domain, MINT_DATA_TYPES, data);
};

// ================================ Fixture ================================

const upgradeFixture = async () => {
  const [owner, user, minter, mapSigner, ...regularAccounts] =
    await ethers.getSigners();

  const { chainId } = await ethers.provider.getNetwork();

  const BASE_URI = 'https://api.arkada.gg/map/{id}.json';

  // Deploy ArkadaMap (V1) as upgradeable proxy
  const ArkadaMapFactory = await ethers.getContractFactory('ArkadaMap');
  const arkadaMapV1 = (await upgrades.deployProxy(
    ArkadaMapFactory,
    [owner.address, BASE_URI],
    { unsafeAllow: ['constructor'] },
  )) as ArkadaMap;
  await arkadaMapV1.deployed();

  // Grant MINTER_ROLE on V1 to verify state persistence after upgrade
  const MINTER_ROLE = await arkadaMapV1.MINTER_ROLE();
  await arkadaMapV1.connect(owner).grantRole(MINTER_ROLE, minter.address);

  // Upgrade proxy to ArkadaMapV2
  const ArkadaMapV2Factory = await ethers.getContractFactory('ArkadaMapV2');
  const arkadaMapV2 = (await upgrades.upgradeProxy(
    arkadaMapV1.address,
    ArkadaMapV2Factory,
  )) as ArkadaMapV2;

  // Initialize V2 (sets EIP-712 domain)
  await arkadaMapV2.connect(owner).initializeV2();

  // Grant SIGNER_ROLE to mapSigner
  const SIGNER_ROLE = await arkadaMapV2.SIGNER_ROLE();
  await arkadaMapV2.connect(owner).grantRole(SIGNER_ROLE, mapSigner.address);

  const domain = {
    name: 'ArkadaMap',
    version: '1',
    chainId,
    verifyingContract: arkadaMapV2.address,
  };
  console.log(
    'Map minted topic0: ',
    arkadaMapV2.interface.getEventTopic('SignatureMinted'),
  );

  return {
    owner,
    user,
    minter,
    mapSigner,
    regularAccounts,
    arkadaMapV2,
    MINTER_ROLE,
    SIGNER_ROLE,
    domain,
  };
};

// ================================ Tests ================================

describe('UPGRADE: ArkadaMap V1 -> V2', () => {
  it('deployment', async () => {
    await loadFixture(upgradeFixture);
  });

  it('should revert when initializeV2 is called a second time', async () => {
    const { arkadaMapV2, owner } = await loadFixture(upgradeFixture);

    await expect(
      arkadaMapV2.connect(owner).initializeV2(),
    ).to.be.revertedWithCustomError(arkadaMapV2, 'InvalidInitialization');
  });

  it('should preserve V1 state after upgrade', async () => {
    const { arkadaMapV2, minter, MINTER_ROLE, owner } = await loadFixture(
      upgradeFixture,
    );

    // MINTER_ROLE granted in V1 is still active
    expect(await arkadaMapV2.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    // Admin role preserved
    expect(
      await arkadaMapV2.hasRole(
        await arkadaMapV2.DEFAULT_ADMIN_ROLE(),
        owner.address,
      ),
    ).to.be.true;
  });

  describe('mintWithSignature', () => {
    it('should mint 1 token when signature is valid', async () => {
      const { arkadaMapV2, mapSigner, user, domain } = await loadFixture(
        upgradeFixture,
      );

      const mintData = { to: user.address, tokenId: 0, nonce: 1 };
      const signature = await signMintData(mintData, mapSigner, domain);

      await expect(arkadaMapV2.mintWithSignature(mintData, signature))
        .to.emit(arkadaMapV2, 'PieceMinted')
        .withArgs(user.address, 0, 1)
        .and.to.emit(arkadaMapV2, 'SignatureMinted')
        .withArgs(user.address, 0, 1);

      expect(await arkadaMapV2.balanceOf(user.address, 0)).to.equal(1);
    });

    it('should allow any caller to submit (caller != recipient)', async () => {
      const { arkadaMapV2, mapSigner, user, regularAccounts, domain } =
        await loadFixture(upgradeFixture);

      const recipient = regularAccounts[0];
      const mintData = { to: recipient.address, tokenId: 3, nonce: 42 };
      const signature = await signMintData(mintData, mapSigner, domain);

      // user submits the tx but recipient gets the token
      await expect(
        arkadaMapV2.connect(user).mintWithSignature(mintData, signature),
      ).to.not.be.reverted;

      expect(await arkadaMapV2.balanceOf(recipient.address, 3)).to.equal(1);
    });

    it('should revert with ArkadaMap__NonceAlreadyUsed on duplicate nonce', async () => {
      const { arkadaMapV2, mapSigner, user, domain } = await loadFixture(
        upgradeFixture,
      );

      const mintData = { to: user.address, tokenId: 1, nonce: 99 };
      const signature = await signMintData(mintData, mapSigner, domain);

      await arkadaMapV2.mintWithSignature(mintData, signature);

      // Same nonce second time
      const mintData2 = { to: user.address, tokenId: 2, nonce: 99 };
      const signature2 = await signMintData(mintData2, mapSigner, domain);

      await expect(
        arkadaMapV2.mintWithSignature(mintData2, signature2),
      ).to.be.revertedWithCustomError(
        arkadaMapV2,
        'ArkadaMap__NonceAlreadyUsed',
      );
    });

    it('should revert with ArkadaMap__InvalidSigner when signer lacks SIGNER_ROLE', async () => {
      const { arkadaMapV2, user, domain } = await loadFixture(upgradeFixture);

      const mintData = { to: user.address, tokenId: 0, nonce: 7 };
      // user signs but does not have SIGNER_ROLE
      const signature = await signMintData(mintData, user, domain);

      await expect(
        arkadaMapV2.mintWithSignature(mintData, signature),
      ).to.be.revertedWithCustomError(arkadaMapV2, 'ArkadaMap__InvalidSigner');
    });

    it('should revert with ArkadaMap__InvalidAddress when to is zero address', async () => {
      const { arkadaMapV2, mapSigner, domain } = await loadFixture(
        upgradeFixture,
      );

      const mintData = {
        to: ethers.constants.AddressZero,
        tokenId: 0,
        nonce: 5,
      };
      const signature = await signMintData(mintData, mapSigner, domain);

      await expect(
        arkadaMapV2.mintWithSignature(mintData, signature),
      ).to.be.revertedWithCustomError(arkadaMapV2, 'ArkadaMap__InvalidAddress');
    });

    it('should revert with ArkadaMap__TokenIdOutOfRange when tokenId >= MAX_PIECES', async () => {
      const { arkadaMapV2, mapSigner, user, domain } = await loadFixture(
        upgradeFixture,
      );

      const mintData = { to: user.address, tokenId: 12, nonce: 6 };
      const signature = await signMintData(mintData, mapSigner, domain);

      await expect(
        arkadaMapV2.mintWithSignature(mintData, signature),
      ).to.be.revertedWithCustomError(
        arkadaMapV2,
        'ArkadaMap__TokenIdOutOfRange',
      );
    });

    it('should succeed with multiple mints using distinct nonces', async () => {
      const { arkadaMapV2, mapSigner, user, domain } = await loadFixture(
        upgradeFixture,
      );

      for (let tokenId = 0; tokenId < 5; tokenId++) {
        const mintData = { to: user.address, tokenId, nonce: tokenId + 100 };
        const signature = await signMintData(mintData, mapSigner, domain);
        await expect(arkadaMapV2.mintWithSignature(mintData, signature)).to.not
          .be.reverted;
      }

      for (let tokenId = 0; tokenId < 5; tokenId++) {
        expect(await arkadaMapV2.balanceOf(user.address, tokenId)).to.equal(1);
      }
    });

    it('should still allow legacy mint() via MINTER_ROLE after upgrade', async () => {
      const { arkadaMapV2, minter, user } = await loadFixture(upgradeFixture);

      await expect(arkadaMapV2.connect(minter).mint(user.address, 5, 3))
        .to.emit(arkadaMapV2, 'PieceMinted')
        .withArgs(user.address, 5, 3);

      expect(await arkadaMapV2.balanceOf(user.address, 5)).to.equal(3);
    });
  });
});
