import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  companyPassDeploy,
  IMintPassData,
  signMintPassData,
} from './common/company-pass.fixtures';

const PASS_ID = 1;
const PRICE = parseEther('0.05');
const PASS_URI = 'https://api.arkada.gg/company-pass/1.json';

const buildMintData = async (
  to: string,
  overrides: Partial<IMintPassData> = {},
): Promise<IMintPassData> => ({
  to,
  passId: PASS_ID,
  price: PRICE,
  deadline: (await time.latest()) + 3600,
  nonce: 1,
  ...overrides,
});

describe.only('ArkadaCompanyPass', () => {
  it('deployment', async () => {
    await loadFixture(companyPassDeploy);
  });

  describe('Deployment', () => {
    it('Should set the right admin role', async () => {
      const { companyPassContract, owner } = await loadFixture(
        companyPassDeploy,
      );
      expect(
        await companyPassContract.hasRole(
          await companyPassContract.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.equal(true);
    });

    it('Should set initial minting state to true', async () => {
      const { companyPassContract } = await loadFixture(companyPassDeploy);
      expect(await companyPassContract.s_isMintingActive()).to.equal(true);
    });

    it('Should set correct name, symbol and treasury', async () => {
      const { companyPassContract, NAME, SYMBOL, treasury } = await loadFixture(
        companyPassDeploy,
      );
      expect(await companyPassContract.name()).to.equal(NAME);
      expect(await companyPassContract.symbol()).to.equal(SYMBOL);
      expect(await companyPassContract.s_treasury()).to.equal(treasury.address);
    });

    it('Should not allow double initialization', async () => {
      const { companyPassContract, owner, treasury } = await loadFixture(
        companyPassDeploy,
      );
      await expect(
        companyPassContract.initialize(
          'N',
          'S',
          'domain',
          '1',
          owner.address,
          treasury.address,
        ),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'InvalidInitialization',
      );
    });
  });

  describe('mintPass', () => {
    it('Should mint pass with valid signature and payment', async () => {
      const { companyPassContract, user, signer, treasury, domain } =
        await loadFixture(companyPassDeploy);

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE }),
      ).to.changeEtherBalances([user, treasury], [PRICE.mul(-1), PRICE]);

      expect(
        await companyPassContract.balanceOf(user.address, PASS_ID),
      ).to.equal(1);
      expect(
        await companyPassContract['totalSupply(uint256)'](PASS_ID),
      ).to.equal(1);
    });

    it('Should emit PassMinted event', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE }),
      )
        .to.emit(companyPassContract, 'PassMinted')
        .withArgs(user.address, PASS_ID, PRICE, data.nonce);
    });

    it('Should mint pass with zero price (free mint)', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data = await buildMintData(user.address, { price: 0 });
      const signature = await signMintPassData(data, signer, domain);

      await companyPassContract
        .connect(user)
        .mintPass(data, signature, { value: 0 });

      expect(
        await companyPassContract.balanceOf(user.address, PASS_ID),
      ).to.equal(1);
    });

    it('Should allow same wallet to mint different pass ids', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data1 = await buildMintData(user.address);
      const data2 = await buildMintData(user.address, { passId: 2, nonce: 2 });

      await companyPassContract
        .connect(user)
        .mintPass(data1, await signMintPassData(data1, signer, domain), {
          value: PRICE,
        });
      await companyPassContract
        .connect(user)
        .mintPass(data2, await signMintPassData(data2, signer, domain), {
          value: PRICE,
        });

      expect(
        await companyPassContract.balanceOf(user.address, PASS_ID),
      ).to.equal(1);
      expect(await companyPassContract.balanceOf(user.address, 2)).to.equal(1);
    });

    it('Should allow different wallets to mint the same pass id', async () => {
      const { companyPassContract, user, regularAccounts, signer, domain } =
        await loadFixture(companyPassDeploy);
      const other = regularAccounts[0];

      const data1 = await buildMintData(user.address);
      const data2 = await buildMintData(other.address, { nonce: 2 });

      await companyPassContract
        .connect(user)
        .mintPass(data1, await signMintPassData(data1, signer, domain), {
          value: PRICE,
        });
      await companyPassContract
        .connect(other)
        .mintPass(data2, await signMintPassData(data2, signer, domain), {
          value: PRICE,
        });

      expect(
        await companyPassContract['totalSupply(uint256)'](PASS_ID),
      ).to.equal(2);
    });

    it('Should revert if minting is not active', async () => {
      const { companyPassContract, owner, user, signer, domain } =
        await loadFixture(companyPassDeploy);

      await companyPassContract.connect(owner).setIsMintingActive(false);

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__MintingNotActive',
      );
    });

    it('Should revert if signature is expired', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data = await buildMintData(user.address, {
        deadline: (await time.latest()) - 1,
      });
      const signature = await signMintPassData(data, signer, domain);

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__SignatureExpired',
      );
    });

    it('Should allow another wallet to pay for the mint', async () => {
      const { companyPassContract, user, regularAccounts, signer, domain } =
        await loadFixture(companyPassDeploy);
      const payer = regularAccounts[0];

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      await companyPassContract
        .connect(payer)
        .mintPass(data, signature, { value: PRICE });

      // pass is minted to the signed recipient, not the payer
      expect(
        await companyPassContract.balanceOf(user.address, PASS_ID),
      ).to.equal(1);
      expect(
        await companyPassContract.balanceOf(payer.address, PASS_ID),
      ).to.equal(0);
    });

    it('Should revert if msg.value does not match price', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE.sub(1) }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__InvalidPrice',
      );

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE.add(1) }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__InvalidPrice',
      );
    });

    it('Should revert if wallet already has the pass', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data1 = await buildMintData(user.address);
      await companyPassContract
        .connect(user)
        .mintPass(data1, await signMintPassData(data1, signer, domain), {
          value: PRICE,
        });

      const data2 = await buildMintData(user.address, { nonce: 2 });
      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data2, await signMintPassData(data2, signer, domain), {
            value: PRICE,
          }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__AlreadyMinted',
      );
    });

    it('Should revert if nonce is already used', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data1 = await buildMintData(user.address);
      await companyPassContract
        .connect(user)
        .mintPass(data1, await signMintPassData(data1, signer, domain), {
          value: PRICE,
        });

      // same nonce, different passId
      const data2 = await buildMintData(user.address, { passId: 2 });
      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data2, await signMintPassData(data2, signer, domain), {
            value: PRICE,
          }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__NonceAlreadyUsed',
      );
    });

    it('Should revert if signer has no SIGNER_ROLE', async () => {
      const { companyPassContract, user, regularAccounts, domain } =
        await loadFixture(companyPassDeploy);

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(
        data,
        regularAccounts[0],
        domain,
      );

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__IsNotSigner',
      );
    });

    it('Should revert if signed data was tampered', async () => {
      const { companyPassContract, user, signer, domain } = await loadFixture(
        companyPassDeploy,
      );

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      // user tries to pay less than what was signed
      const tampered = { ...data, price: 0 };

      await expect(
        companyPassContract.connect(user).mintPass(tampered, signature, {
          value: 0,
        }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__IsNotSigner',
      );
    });
  });

  describe('Soulbound', () => {
    it('Should revert on safeTransferFrom', async () => {
      const { companyPassContract, user, regularAccounts, signer, domain } =
        await loadFixture(companyPassDeploy);

      const data = await buildMintData(user.address);
      await companyPassContract
        .connect(user)
        .mintPass(data, await signMintPassData(data, signer, domain), {
          value: PRICE,
        });

      await expect(
        companyPassContract
          .connect(user)
          .safeTransferFrom(
            user.address,
            regularAccounts[0].address,
            PASS_ID,
            1,
            '0x',
          ),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__NonTransferable',
      );
    });

    it('Should revert on safeBatchTransferFrom', async () => {
      const { companyPassContract, user, regularAccounts, signer, domain } =
        await loadFixture(companyPassDeploy);

      const data = await buildMintData(user.address);
      await companyPassContract
        .connect(user)
        .mintPass(data, await signMintPassData(data, signer, domain), {
          value: PRICE,
        });

      await expect(
        companyPassContract
          .connect(user)
          .safeBatchTransferFrom(
            user.address,
            regularAccounts[0].address,
            [PASS_ID],
            [1],
            '0x',
          ),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__NonTransferable',
      );
    });

    it('Should revert on setApprovalForAll', async () => {
      const { companyPassContract, user, regularAccounts } = await loadFixture(
        companyPassDeploy,
      );

      await expect(
        companyPassContract
          .connect(user)
          .setApprovalForAll(regularAccounts[0].address, true),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__ApprovalsDisabled',
      );
    });
  });

  describe('Admin functions', () => {
    it('setIsMintingActive: should update state and emit event', async () => {
      const { companyPassContract, owner } = await loadFixture(
        companyPassDeploy,
      );

      await expect(companyPassContract.connect(owner).setIsMintingActive(false))
        .to.emit(companyPassContract, 'MintingSwitch')
        .withArgs(false);
      expect(await companyPassContract.s_isMintingActive()).to.equal(false);
    });

    it('setIsMintingActive: should revert if not admin', async () => {
      const { companyPassContract, user } = await loadFixture(
        companyPassDeploy,
      );

      await expect(
        companyPassContract.connect(user).setIsMintingActive(false),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('setTreasury: should update treasury and emit event', async () => {
      const { companyPassContract, owner, regularAccounts } = await loadFixture(
        companyPassDeploy,
      );

      await expect(
        companyPassContract
          .connect(owner)
          .setTreasury(regularAccounts[0].address),
      )
        .to.emit(companyPassContract, 'UpdatedTreasury')
        .withArgs(owner.address, regularAccounts[0].address);
      expect(await companyPassContract.s_treasury()).to.equal(
        regularAccounts[0].address,
      );
    });

    it('setTreasury: should revert on zero address', async () => {
      const { companyPassContract, owner } = await loadFixture(
        companyPassDeploy,
      );

      await expect(
        companyPassContract
          .connect(owner)
          .setTreasury(ethers.constants.AddressZero),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__ZeroAddress',
      );
    });

    it('setTreasury: should revert if not admin', async () => {
      const { companyPassContract, user } = await loadFixture(
        companyPassDeploy,
      );

      await expect(
        companyPassContract.connect(user).setTreasury(user.address),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('setPassURI: should update uri and emit events', async () => {
      const { companyPassContract, uriSetter } = await loadFixture(
        companyPassDeploy,
      );

      expect(await companyPassContract.uri(PASS_ID)).to.equal('');

      await expect(
        companyPassContract.connect(uriSetter).setPassURI(PASS_ID, PASS_URI),
      )
        .to.emit(companyPassContract, 'PassURIUpdated')
        .withArgs(uriSetter.address, PASS_ID, PASS_URI)
        .to.emit(companyPassContract, 'URI')
        .withArgs(PASS_URI, PASS_ID);
      expect(await companyPassContract.uri(PASS_ID)).to.equal(PASS_URI);
    });

    it('setPassURI: should revert if caller has no URI_SETTER_ROLE (even admin)', async () => {
      const { companyPassContract, owner, user } = await loadFixture(
        companyPassDeploy,
      );

      await expect(
        companyPassContract.connect(user).setPassURI(PASS_ID, PASS_URI),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'AccessControlUnauthorizedAccount',
      );

      // admin does not have URI_SETTER_ROLE by default
      await expect(
        companyPassContract.connect(owner).setPassURI(PASS_ID, PASS_URI),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('Revoked signer should not be able to authorize mints', async () => {
      const { companyPassContract, owner, user, signer, domain } =
        await loadFixture(companyPassDeploy);

      await companyPassContract
        .connect(owner)
        .revokeRole(await companyPassContract.SIGNER_ROLE(), signer.address);

      const data = await buildMintData(user.address);
      const signature = await signMintPassData(data, signer, domain);

      await expect(
        companyPassContract
          .connect(user)
          .mintPass(data, signature, { value: PRICE }),
      ).to.be.revertedWithCustomError(
        companyPassContract,
        'ArkadaCompanyPass__IsNotSigner',
      );
    });
  });
});
