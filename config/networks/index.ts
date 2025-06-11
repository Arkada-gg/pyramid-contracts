import { HardhatNetworkUserConfig, NetworkUserConfig } from 'hardhat/types';

import { MOCK_AGGREGATOR_NETWORK_TAG } from '../constants';
import { ENV } from '../env';
import { ConfigPerNetwork, Network, RpcUrl } from '../types';

const {
  ALCHEMY_KEY,
  INFURA_KEY,
  MNEMONIC_DEV,
  MNEMONIC_PROD,
  PRIVATE_KEY_DEPLOYER,
} = ENV;

export const rpcUrls: ConfigPerNetwork<RpcUrl> = {
  soneium: ALCHEMY_KEY
    ? `https://soneium-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://rpc.soneium.org/`,
  sonic: ALCHEMY_KEY
    ? `https://sonic-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://rpc.soniclabs.com`,
  base: ALCHEMY_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://base.llamarpc.com`,
  monadtestnet: 'https://testnet-rpc.monad.xyz',
  arbitrum: ALCHEMY_KEY
    ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://arbitrum-one-rpc.publicnode.com`,
  hyperevm: 'https://rpc.hyperliquid.xyz/evm',
  'megaeth-testnet': ALCHEMY_KEY
    ? `https://megaeth-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://carrot.megaeth.com/rpc`,
  'pharos-testnet': 'https://testnet.dplabs-internal.com/',
  plume: 'https://rpc.plume.org',
  somnia: 'https://dream-rpc.somnia.network/',

  sepolia: ALCHEMY_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://sepolia.infura.io/v3/${INFURA_KEY}`,
  hardhat: 'http://localhost:8545',
  localhost: 'http://localhost:8545',
};

export const gasPrices: ConfigPerNetwork<number | 'auto' | undefined> = {
  soneium: 'auto',
  sonic: 'auto',
  base: 'auto',
  monadtestnet: 'auto',
  arbitrum: 'auto',
  hyperevm: 'auto',
  plume: 'auto',
  somnia: 'auto',
  'megaeth-testnet': 'auto',
  'pharos-testnet': 'auto',

  sepolia: 'auto',
  hardhat: 0,
  localhost: 0,
};

export const chainIds: ConfigPerNetwork<number> = {
  soneium: 1868,
  sonic: 146,
  base: 8453,
  monadtestnet: 10143,
  arbitrum: 42161,
  hyperevm: 999,
  plume: 98866,
  somnia: 50312,
  'megaeth-testnet': 6342,
  'pharos-testnet': 688688,

  sepolia: 11155111,
  hardhat: 31337,
  localhost: 31337,
};

export const mnemonics: ConfigPerNetwork<string | undefined> = {
  soneium: MNEMONIC_PROD,
  sonic: MNEMONIC_PROD,
  base: MNEMONIC_PROD,
  monadtestnet: MNEMONIC_PROD,
  arbitrum: MNEMONIC_PROD,
  hyperevm: MNEMONIC_PROD,
  plume: MNEMONIC_PROD,
  somnia: MNEMONIC_PROD,
  'megaeth-testnet': MNEMONIC_PROD,
  'pharos-testnet': MNEMONIC_PROD,

  sepolia: MNEMONIC_DEV,
  hardhat: MNEMONIC_DEV,
  localhost: MNEMONIC_DEV,
};

export const gases: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  monadtestnet: undefined,
  arbitrum: undefined,
  hyperevm: undefined,
  plume: undefined,
  somnia: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,

  sepolia: undefined,
  hardhat: undefined,
  localhost: undefined,
};

export const timeouts: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  monadtestnet: undefined,
  arbitrum: undefined,
  hyperevm: undefined,
  plume: undefined,
  somnia: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,

  sepolia: 999999,
  hardhat: undefined,
  localhost: 999999,
};

export const blockGasLimits: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  monadtestnet: undefined,
  arbitrum: undefined,
  hyperevm: undefined,
  plume: undefined,
  somnia: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,

  sepolia: undefined,
  hardhat: 300 * 10 ** 6,
  localhost: undefined,
};

export const initialBasesFeePerGas: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  monadtestnet: undefined,
  arbitrum: undefined,
  hyperevm: undefined,
  plume: undefined,
  somnia: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,

  sepolia: undefined,
  hardhat: 0,
  localhost: undefined,
};

export const getBaseNetworkConfig = (
  network: Network,
  tags: Array<string> = [MOCK_AGGREGATOR_NETWORK_TAG],
): NetworkUserConfig => ({
  accounts: mnemonics[network]
    ? {
        mnemonic: mnemonics[network],
      }
    : [PRIVATE_KEY_DEPLOYER],
  chainId: chainIds[network],
  gas: gases[network],
  gasPrice: gasPrices[network],
  blockGasLimit: blockGasLimits[network],
  timeout: timeouts[network],
  initialBaseFeePerGas: initialBasesFeePerGas[network],
  tags,
});

export const getNetworkConfig = (
  network: Network,
  tags: Array<string> = [MOCK_AGGREGATOR_NETWORK_TAG],
  forkingNetwork?: Network,
): NetworkUserConfig => ({
  ...getBaseNetworkConfig(forkingNetwork ?? network, tags),
  url: rpcUrls[network],
  chainId: chainIds[network],
  saveDeployments: true,
});

export const getForkNetworkConfig = (
  network: Network,
  tags: Array<string> = [MOCK_AGGREGATOR_NETWORK_TAG],
): HardhatNetworkUserConfig => ({
  ...getBaseNetworkConfig(network, tags),
  accounts: {
    mnemonic: mnemonics[network],
  },
  live: false,
  saveDeployments: true,
  mining: {
    auto: false,
    interval: 1000,
  },
  forking: {
    url: rpcUrls[network],
    enabled: true,
  },
});

export const getHardhatNetworkConfig = (): HardhatNetworkUserConfig => ({
  ...getBaseNetworkConfig('hardhat'),
  accounts: mnemonics.hardhat ? { mnemonic: mnemonics.hardhat } : undefined,
  saveDeployments: true,
  live: false,
});
