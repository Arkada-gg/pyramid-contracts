import * as hre from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { getCurrentAddresses } from '../../config/constants/addresses';

const ARKADA_MAP_CONTRACT_NAME = 'ArkadaMap';

/**
 * Получатель частей карты (один адрес).
 */
const RECIPIENT = '0x69E4e6Df0f5ca236855a97268Ce0e62a2cF5AB76';

/**
 * Список частей карты (tokenId 0..11) и их количество для минта получателю.
 * Пример: раздать по одной штуке частей 0, 3 и 7.
 */
const PIECES: { tokenId: number; amount: number }[] = [
  { tokenId: 0, amount: 1 },
  { tokenId: 1, amount: 1 },
  { tokenId: 2, amount: 1 },
  { tokenId: 3, amount: 1 },
  { tokenId: 7, amount: 1 },
  { tokenId: 9, amount: 1 },
  { tokenId: 10, amount: 1 },
  { tokenId: 11, amount: 1 },
];

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const addresses = getCurrentAddresses(hre);

  // Операторский ключ (с MINTER_ROLE) берём из env, а не из named accounts.
  const operatorKey = process.env.PRIVATE_KEY_DEPLOYER;
  if (!operatorKey) {
    throw new Error('PRIVATE_KEY_DEPLOYER is not set in env');
  }

  const operator = new hre.ethers.Wallet(operatorKey, hre.ethers.provider);
  console.log('operator', { operator: operator.address });

  const proxyAddress = addresses?.arkadaMap ?? '';
  if (!proxyAddress) {
    throw new Error('arkadaMap address not configured for this network');
  }

  if (RECIPIENT === hre.ethers.ZeroAddress) {
    throw new Error('RECIPIENT is not set');
  }

  const mapContract = await hre.ethers.getContractAt(
    ARKADA_MAP_CONTRACT_NAME,
    proxyAddress,
    operator,
  );

  // Проверяем, что операторский ключ действительно имеет MINTER_ROLE.
  const minterRole = await mapContract.MINTER_ROLE();
  const hasRole = await mapContract.hasRole(minterRole, operator.address);
  if (!hasRole) {
    throw new Error(
      `Operator ${operator.address} does not have MINTER_ROLE on ${proxyAddress}`,
    );
  }

  console.log(
    `Distributing ${PIECES.length} map piece(s) to ${RECIPIENT} from operator ${operator.address}...`,
  );

  for (let i = 0; i < PIECES.length; i++) {
    const { tokenId, amount } = PIECES[i];

    if (tokenId < 0 || tokenId >= 12) {
      throw new Error(`Invalid tokenId ${tokenId} (must be 0..11)`);
    }
    if (amount <= 0) {
      throw new Error(`Invalid amount ${amount} for tokenId ${tokenId}`);
    }

    console.log(
      `[${i + 1}/${
        PIECES.length
      }] Minting tokenId ${tokenId} x${amount} to ${RECIPIENT}...`,
    );

    const tx = await mapContract.mint(RECIPIENT, tokenId, amount);
    await tx.wait();

    console.log(`  ✓ TX: ${tx.hash}`);
  }

  console.log(
    `Done. Distributed ${PIECES.length} map piece(s) to ${RECIPIENT}.`,
  );
};

func(hre).then(console.log).catch(console.error);
