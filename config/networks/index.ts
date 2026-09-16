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
  soneium: `https://rpc.soneium.org/`,
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
  hyperevm: 'https://rpc.hypurrscan.io',
  'megaeth-testnet': `https://carrot.megaeth.com/rpc`,
  'pharos-testnet': 'https://testnet.dplabs-internal.com/',
  plume: 'https://rpc.plume.org',
  somnia: 'https://api.infra.mainnet.somnia.network',
  tempo: `https://tempo-mainnet.drpc.org`,
  arc: 'https://rpc.mainnet.arc.io',
  'arc-testnet': 'https://rpc.testnet.arc.io',
  robinhood: `https://rpc.mainnet.chain.robinhood.com`,
  abstract: 'https://api.mainnet.abs.xyz',
  citrea: `https://rpc.mainnet.citrea.xyz`,
  ink: `https://rpc-gel.inkonchain.com`,
  pharos: `https://infra.originstake.com/pharos/evm`,
  'monad-mainnet': ALCHEMY_KEY
    ? `https://monad-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : `https://rpc1.monad.xyz`,
  unichain: ALCHEMY_KEY
    ? `https://unichain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : 'https://0xrpc.io/uni',
  'bsc-mainnet': 'https://bsc-dataseed.bnbchain.org',

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
  citrea: 'auto',
  abstract: 'auto',
  tempo: 'auto',
  arc: 'auto',
  'arc-testnet': 'auto',
  ink: 'auto',
  'megaeth-testnet': 'auto',
  'pharos-testnet': 'auto',
  'monad-mainnet': 'auto',
  unichain: 'auto',
  robinhood: 'auto',
  pharos: 'auto',
  'bsc-mainnet': 'auto',
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
  citrea: 4114,
  somnia: 5031,
  pharos: 1672,
  abstract: 2741,
  robinhood: 4663,
  tempo: 4217,
  arc: 5042,
  'arc-testnet': 5042002,
  ink: 57073,
  'megaeth-testnet': 6342,
  'pharos-testnet': 688688,
  'monad-mainnet': 143,
  unichain: 130,
  'bsc-mainnet': 56,
  sepolia: 11155111,
  hardhat: 31337,
  localhost: 31337,
};

export const mnemonics: ConfigPerNetwork<string | undefined> = {
  soneium: MNEMONIC_PROD,
  sonic: MNEMONIC_PROD,
  base: MNEMONIC_PROD,
  monadtestnet: MNEMONIC_PROD,
  citrea: MNEMONIC_PROD,
  arbitrum: MNEMONIC_PROD,
  hyperevm: MNEMONIC_PROD,
  pharos: MNEMONIC_PROD,
  plume: MNEMONIC_PROD,
  robinhood: MNEMONIC_PROD,
  tempo: MNEMONIC_PROD,
  arc: MNEMONIC_PROD,
  'arc-testnet': MNEMONIC_PROD,
  somnia: MNEMONIC_PROD,
  abstract: MNEMONIC_PROD,
  ink: MNEMONIC_PROD,
  'megaeth-testnet': MNEMONIC_PROD,
  'pharos-testnet': MNEMONIC_PROD,
  'monad-mainnet': MNEMONIC_PROD,
  unichain: MNEMONIC_PROD,
  'bsc-mainnet': MNEMONIC_PROD,
  sepolia: MNEMONIC_DEV,
  hardhat: MNEMONIC_DEV,
  localhost: MNEMONIC_DEV,
};

export const gases: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  monadtestnet: undefined,
  robinhood: undefined,
  arbitrum: undefined,
  hyperevm: undefined,
  plume: undefined,
  citrea: undefined,
  pharos: undefined,
  somnia: undefined,
  tempo: undefined,
  arc: undefined,
  'arc-testnet': undefined,
  ink: undefined,
  abstract: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,
  'monad-mainnet': undefined,
  unichain: undefined,
  'bsc-mainnet': undefined,
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
  citrea: undefined,
  robinhood: undefined,
  hyperevm: undefined,
  pharos: undefined,
  ink: undefined,
  plume: undefined,
  somnia: undefined,
  abstract: undefined,
  tempo: undefined,
  arc: undefined,
  'arc-testnet': undefined,
  'megaeth-testnet': 999999,
  'pharos-testnet': 999999,
  'monad-mainnet': 999999,
  unichain: undefined,
  'bsc-mainnet': undefined,
  sepolia: 999999,
  hardhat: undefined,
  localhost: 999999,
};

export const blockGasLimits: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  robinhood: undefined,
  pharos: undefined,
  citrea: undefined,
  monadtestnet: undefined,
  arbitrum: undefined,
  ink: undefined,
  hyperevm: undefined,
  plume: undefined,
  tempo: undefined,
  arc: undefined,
  'arc-testnet': undefined,
  somnia: undefined,
  abstract: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,
  'monad-mainnet': undefined,
  unichain: undefined,
  'bsc-mainnet': undefined,
  sepolia: undefined,
  hardhat: 300 * 10 ** 6,
  localhost: undefined,
};

export const initialBasesFeePerGas: ConfigPerNetwork<number | undefined> = {
  soneium: undefined,
  sonic: undefined,
  base: undefined,
  ink: undefined,
  monadtestnet: undefined,
  arbitrum: undefined,
  hyperevm: undefined,
  plume: undefined,
  somnia: undefined,
  tempo: undefined,
  arc: undefined,
  'arc-testnet': undefined,
  pharos: undefined,
  robinhood: undefined,
  citrea: undefined,
  abstract: undefined,
  'megaeth-testnet': undefined,
  'pharos-testnet': undefined,
  'monad-mainnet': undefined,
  unichain: undefined,
  'bsc-mainnet': undefined,
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
