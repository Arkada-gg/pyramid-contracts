import { type HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'solidity-docgen';
// import './tasks';

import {
  ENV,
  getForkNetworkConfig,
  getHardhatNetworkConfig,
  getNetworkConfig,
  Network,
} from './config';

const { OPTIMIZER, REPORT_GAS, FORKING_NETWORK, ETHERSCAN_API_KEY, DEPLOYER } =
  ENV;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.22',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      1: DEPLOYER,
      hardhat: DEPLOYER,
      localhost: DEPLOYER,
      sepolia: DEPLOYER,
      soneium: DEPLOYER,
      sonic: DEPLOYER,
      base: DEPLOYER,
    },
  },
  verify: {
    etherscan: {
      apiKey: ETHERSCAN_API_KEY,
    },
  },
  networks: {
    soneium: getNetworkConfig('soneium'),
    sonic: getNetworkConfig('sonic'),
    base: getNetworkConfig('base'),
    sepolia: getNetworkConfig('sepolia'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hardhat: FORKING_NETWORK
      ? getForkNetworkConfig(FORKING_NETWORK)
      : getHardhatNetworkConfig(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    localhost: FORKING_NETWORK
      ? getForkNetworkConfig(FORKING_NETWORK)
      : getNetworkConfig(
          'localhost',
          [],
          FORKING_NETWORK as unknown as Network,
        ),
  },
  gasReporter: {
    enabled: REPORT_GAS,
  },
  contractSizer: {
    runOnCompile: OPTIMIZER,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [
      {
        network: 'soneium',
        chainId: 1868,
        urls: {
          apiURL: 'https://soneium.blockscout.com/api/',
          browserURL: 'https://soneium.blockscout.com',
        },
      },
      {
        network: 'sonic',
        chainId: 146,
        urls: {
          apiURL: 'https://api.sonicscan.org/api/',
          browserURL: 'https://sonicscan.org',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api/',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
  paths: {
    deploy: 'deploy/',
    deployments: 'deployments/',
  },
  docgen: {
    outputDir: './docgen',
    pages: 'single',
  },
  external: FORKING_NETWORK
    ? {
        deployments: {
          hardhat: ['deployments/' + FORKING_NETWORK],
          local: ['deployments/' + FORKING_NETWORK],
        },
      }
    : undefined,
};

export default config;
