import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

import { ArkadaCompanyPass__factory } from '../../typechain-types';

export interface IMintPassData {
  to: string;
  passId: BigNumberish;
  price: BigNumberish;
  deadline: BigNumberish;
  nonce: BigNumberish;
}

export interface ICompanyPassDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export const MINT_PASS_TYPES = {
  MintPassData: [
    { name: 'to', type: 'address' },
    { name: 'passId', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

export const signMintPassData = async (
  data: IMintPassData,
  signer: SignerWithAddress,
  domain: ICompanyPassDomain,
): Promise<string> => signer._signTypedData(domain, MINT_PASS_TYPES, data);

export async function companyPassDeploy() {
  const [owner, signer, uriSetter, user, treasury, ...regularAccounts] =
    await ethers.getSigners();

  const NAME = 'Arkada Company Pass';
  const SYMBOL = 'ARKADAPASS';
  const SIGNING_DOMAIN = 'ARKADA_COMPANY_PASS';
  const SIGNATURE_VERSION = '1';

  // -----------------------------------------------> ARKADA COMPANY PASS

  const companyPassContract = await new ArkadaCompanyPass__factory(
    owner,
  ).deploy();

  // Test invalid initialization - zero admin
  await expect(
    companyPassContract.initialize(
      NAME,
      SYMBOL,
      SIGNING_DOMAIN,
      SIGNATURE_VERSION,
      ethers.constants.AddressZero,
      treasury.address,
    ),
  ).to.be.revertedWithCustomError(
    companyPassContract,
    'ArkadaCompanyPass__ZeroAddress',
  );

  // Test invalid initialization - zero treasury
  await expect(
    companyPassContract.initialize(
      NAME,
      SYMBOL,
      SIGNING_DOMAIN,
      SIGNATURE_VERSION,
      owner.address,
      ethers.constants.AddressZero,
    ),
  ).to.be.revertedWithCustomError(
    companyPassContract,
    'ArkadaCompanyPass__ZeroAddress',
  );

  // Valid initialization
  await companyPassContract.initialize(
    NAME,
    SYMBOL,
    SIGNING_DOMAIN,
    SIGNATURE_VERSION,
    owner.address,
    treasury.address,
  );

  await companyPassContract
    .connect(owner)
    .grantRole(await companyPassContract.SIGNER_ROLE(), signer.address);

  await companyPassContract
    .connect(owner)
    .grantRole(await companyPassContract.URI_SETTER_ROLE(), uriSetter.address);

  const domain: ICompanyPassDomain = {
    name: SIGNING_DOMAIN,
    version: SIGNATURE_VERSION,
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: companyPassContract.address,
  };

  return {
    owner,
    signer,
    uriSetter,
    user,
    treasury,
    regularAccounts,
    companyPassContract,
    domain,
    NAME,
    SYMBOL,
    SIGNING_DOMAIN,
    SIGNATURE_VERSION,
  };
}
