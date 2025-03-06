import { ethers } from 'hardhat';
import { Pyramid__factory } from '../../typechain-types';

export async function defaultDeploy() {
  const [owner, paymentsRecipient, operator, ...regularAccounts] =
    await ethers.getSigners();

  const pyramid = await new Pyramid__factory(owner).deploy();
  await pyramid.initialize('Pyramid', 'PYR', 'pyramid', '1.0', owner.address, {
    gasLimit: 1000000,
  });

  await pyramid.grantRole(await pyramid.SIGNER_ROLE(), operator.address);
  await pyramid.grantRole(await pyramid.UPGRADER_ROLE(), owner.address);

  return {
    owner,
    regularAccounts,
    pyramid,
    signer: operator,
    paymentsRecipient,
    operator,
  };
}
