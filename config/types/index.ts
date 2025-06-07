type NetworkBase = 'sepolia';
type RpcNetwork = NetworkBase | 'mainnet';
export type Network =
  | NetworkBase
  | 'soneium'
  | 'sonic'
  | 'base'
  | 'monadtestnet'
  | 'arbitrum'
  | 'hyperevm'
  | 'hardhat'
  | 'localhost';
export type RpcUrl =
  | `https://eth-${RpcNetwork}.g.alchemy.com/v2/${string}`
  | `https://${RpcNetwork}.infura.io/v3/${string}`
  | `http://localhost:${number}`
  | `https://${string}.${string}`;

export type ConfigPerNetwork<T> = Record<Network, T>;

export interface Environment {
  readonly ALCHEMY_KEY?: string;
  readonly INFURA_KEY?: string;
  readonly ETHERSCAN_API_KEY?: string;
  readonly ETHERSCAN_API_KEY_SONEIUM?: string;
  readonly ETHERSCAN_API_KEY_SONIC?: string;
  readonly ETHERSCAN_API_KEY_BASE?: string;
  readonly ETHERSCAN_API_KEY_ARBITRUM?: string;
  readonly ETHERSCAN_API_KEY_HYPEREVM?: string;
  readonly OPTIMIZER: boolean;
  readonly COVERAGE: boolean;
  readonly REPORT_GAS: boolean;
  readonly MNEMONIC_DEV?: string;
  readonly MNEMONIC_PROD: string;
  readonly PRIVATE_KEY_DEPLOYER: string;
  readonly DEPLOYER: string;
  readonly FORKING_NETWORK?: Network;
}
