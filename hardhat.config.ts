import { type HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'solidity-docgen';

import {
  ENV,
  getForkNetworkConfig,
  getHardhatNetworkConfig,
  getNetworkConfig,
  Network,
} from './config';

const {
  OPTIMIZER,
  REPORT_GAS,
  FORKING_NETWORK,
  // ETHERSCAN_API_KEY,
  ETHERSCAN_API_KEY_SONEIUM,
  ETHERSCAN_API_KEY_SONIC,
  ETHERSCAN_API_KEY_BASE,
  ETHERSCAN_API_KEY_ARBITRUM,
  DEPLOYER,
} = ENV;

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
      monadtestnet: DEPLOYER,
      arbitrum: DEPLOYER,
      hyperevm: DEPLOYER,
    },
  },
  // verify: {
  //   etherscan: {
  //     apiKey: ETHERSCAN_API_KEY,
  //   },
  // },
  networks: {
    soneium: getNetworkConfig('soneium'),
    sonic: getNetworkConfig('sonic'),
    base: getNetworkConfig('base'),
    monadtestnet: getNetworkConfig('monadtestnet'),
    arbitrum: getNetworkConfig('arbitrum'),
    hyperevm: getNetworkConfig('hyperevm'),
    plume: getNetworkConfig('plume'),
    somnia: getNetworkConfig('somnia'),
    'megaeth-testnet': getNetworkConfig('megaeth-testnet'),
    'pharos-testnet': getNetworkConfig('pharos-testnet'),

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
    apiKey: {
      soneium: ETHERSCAN_API_KEY_SONEIUM ?? '',
      sonic: ETHERSCAN_API_KEY_SONIC ?? '',
      base: ETHERSCAN_API_KEY_BASE ?? '',
      arbitrum: ETHERSCAN_API_KEY_ARBITRUM ?? '',
    },
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
      {
        network: 'arbitrum',
        chainId: 42161,
        urls: {
          apiURL: 'https://api.arbiscan.io/api',
          browserURL: 'https://arbiscan.io/',
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
