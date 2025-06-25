import 'dotenv/config';
import { Environment, Network } from '../types';

export const ENV: Environment = {
  ALCHEMY_KEY: process.env.ALCHEMY_KEY ?? '',
  INFURA_KEY: process.env.INFURA_KEY ?? '',
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY ?? '',
  ETHERSCAN_API_KEY_SONEIUM: process.env.ETHERSCAN_API_KEY_SONEIUM ?? '',
  ETHERSCAN_API_KEY_SONIC: process.env.ETHERSCAN_API_KEY_SONIC ?? '',
  ETHERSCAN_API_KEY_BASE: process.env.ETHERSCAN_API_KEY_BASE ?? '',
  ETHERSCAN_API_KEY_ARBITRUM: process.env.ETHERSCAN_API_KEY_ARBITRUM ?? '',
  ETHERSCAN_API_KEY_ABSTRACT: process.env.ETHERSCAN_API_KEY_ABSTRACT ?? '',
  OPTIMIZER: process.env.OPTIMIZER === 'true',
  COVERAGE: process.env.COVERAGE === 'true',
  REPORT_GAS: process.env.REPORT_GAS === 'true',
  MNEMONIC_DEV: process.env.MNEMONIC_DEV,
  MNEMONIC_PROD: process.env.MNEMONIC_PROD ?? '',
  PRIVATE_KEY_DEPLOYER: process.env.PRIVATE_KEY_DEPLOYER ?? '',
  DEPLOYER: process.env.DEPLOYER ?? '',
  FORKING_NETWORK: process.env.FORKING_NETWORK
    ? (process.env.FORKING_NETWORK as Network)
    : undefined,
};
