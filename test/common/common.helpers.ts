import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish, Contract } from 'ethers';
import { ethers } from 'hardhat';

export type OptionalCommonParams = {
  from?: SignerWithAddress;
  revertMessage?: string;
  value?: BigNumberish;
};

export type Account = SignerWithAddress | string;
export type AccountOrContract = Account | Contract;

export const getAccount = (account: AccountOrContract) => {
  return (
    (account as SignerWithAddress).address ??
    (account as Contract).address ??
    (account as string)
  );
};

export interface IRewardData {
  tokenAddress: string;
  chainId: number;
  amount: BigNumberish;
  tokenId: number;
  tokenType: number;
  rakeBps: number;
  factoryAddress: string;
  questIdHash?: string; // Optional for V3, required for V4
}

export interface IGlobalRewardData {
  tokenAddress: string;
  amount: BigNumberish;
  tokenId: number;
  tokenType: number;
  rakeBps: number;
  escrowAddress: string;
}

export interface ITransactionData {
  txHash: string;
  networkChainId: string;
}

export interface IFeeRecipient {
  recipient: string;
  BPS: number;
}

export interface IMintPyramidDataV1 {
  questId: string;
  nonce: number;
  price: BigNumberish;
  toAddress: string;
  walletProvider: string;
  tokenURI: string;
  embedOrigin: string;
  transactions: ITransactionData[];
  recipients: IFeeRecipient[];
  reward: IRewardData;
}

export interface IMintPyramidData {
  questId: string;
  nonce: number;
  price: BigNumberish;
  toAddress: string;
  walletProvider: string;
  tokenURI: string;
  embedOrigin: string;
  transactions: ITransactionData[];
  recipients: IFeeRecipient[];
  reward: IRewardData;
  globalReward: IGlobalRewardData;
}

// Encode string values using keccak256
export const encodeString = (str: string): string =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(str));

const TYPES_V1 = {
  PyramidData: [
    { name: 'questId', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'toAddress', type: 'address' },
    { name: 'walletProvider', type: 'string' },
    { name: 'tokenURI', type: 'string' },
    { name: 'embedOrigin', type: 'string' },
    { name: 'transactions', type: 'TransactionData[]' },
    { name: 'recipients', type: 'FeeRecipient[]' },
    { name: 'reward', type: 'RewardData' },
  ],
  TransactionData: [
    { name: 'txHash', type: 'string' },
    { name: 'networkChainId', type: 'string' },
  ],
  FeeRecipient: [
    { name: 'recipient', type: 'address' },
    { name: 'BPS', type: 'uint16' },
  ],
  RewardData: [
    { name: 'tokenAddress', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'tokenType', type: 'uint8' },
    { name: 'rakeBps', type: 'uint256' },
    { name: 'factoryAddress', type: 'address' },
  ],
};

export const signMintDataTypedV1 = async (
  data: IMintPyramidDataV1,
  signer: SignerWithAddress,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  },
) => {
  // Sign the hash directly
  return await signer._signTypedData(domain, TYPES_V1, data);
};

const TYPES_V2 = {
  PyramidData: [
    { name: 'questId', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'toAddress', type: 'address' },
    { name: 'walletProvider', type: 'string' },
    { name: 'tokenURI', type: 'string' },
    { name: 'embedOrigin', type: 'string' },
    { name: 'transactions', type: 'TransactionData[]' },
    { name: 'recipients', type: 'FeeRecipient[]' },
    { name: 'reward', type: 'RewardData' },
    { name: 'globalReward', type: 'GlobalRewardData' },
  ],
  TransactionData: [
    { name: 'txHash', type: 'string' },
    { name: 'networkChainId', type: 'string' },
  ],
  FeeRecipient: [
    { name: 'recipient', type: 'address' },
    { name: 'BPS', type: 'uint16' },
  ],
  RewardData: [
    { name: 'tokenAddress', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'tokenType', type: 'uint8' },
    { name: 'rakeBps', type: 'uint256' },
    { name: 'factoryAddress', type: 'address' },
  ],
  GlobalRewardData: [
    { name: 'tokenAddress', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'tokenType', type: 'uint8' },
    { name: 'rakeBps', type: 'uint256' },
    { name: 'escrowAddress', type: 'address' },
  ],
};

export const signMintDataTyped = async (
  data: IMintPyramidData,
  signer: SignerWithAddress,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  },
) => {
  // Remove questIdHash from reward data for signing (PyramidEscrow doesn't use it in signature)
  const dataForSigning = {
    ...data,
    reward: {
      tokenAddress: data.reward.tokenAddress,
      chainId: data.reward.chainId,
      amount: data.reward.amount,
      tokenId: data.reward.tokenId,
      tokenType: data.reward.tokenType,
      rakeBps: data.reward.rakeBps,
      factoryAddress: data.reward.factoryAddress,
    },
  };
  // Sign the hash directly
  return await signer._signTypedData(domain, TYPES_V2, dataForSigning);
};

const TYPES_V4 = {
  PyramidData: [
    { name: 'questId', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'toAddress', type: 'address' },
    { name: 'walletProvider', type: 'string' },
    { name: 'tokenURI', type: 'string' },
    { name: 'embedOrigin', type: 'string' },
    { name: 'transactions', type: 'TransactionData[]' },
    { name: 'recipients', type: 'FeeRecipient[]' },
    { name: 'reward', type: 'RewardData' },
    { name: 'globalReward', type: 'GlobalRewardData' },
  ],
  TransactionData: [
    { name: 'txHash', type: 'string' },
    { name: 'networkChainId', type: 'string' },
  ],
  FeeRecipient: [
    { name: 'recipient', type: 'address' },
    { name: 'BPS', type: 'uint16' },
  ],
  RewardData: [
    { name: 'questIdHash', type: 'bytes32' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'tokenType', type: 'uint8' },
    { name: 'rakeBps', type: 'uint256' },
    { name: 'factoryAddress', type: 'address' },
  ],
  GlobalRewardData: [
    { name: 'tokenAddress', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'tokenType', type: 'uint8' },
    { name: 'rakeBps', type: 'uint256' },
    { name: 'escrowAddress', type: 'address' },
  ],
};

export const signMintDataTypedV4 = async (
  data: IMintPyramidData,
  signer: SignerWithAddress,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  },
) => {
  // Ensure questIdHash is set in reward data
  if (!data.reward.questIdHash) {
    data.reward.questIdHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(data.questId),
    );
  }
  // Sign the hash directly
  return await signer._signTypedData(domain, TYPES_V4, data);
};

/**
 * Increases the Hardhat EVM time by the specified number of seconds
 * @param seconds Number of seconds to increase time by
 */
export const increaseTime = async (seconds: number): Promise<void> => {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
};

/**
 * Increases time and mines the specified number of blocks
 * @param seconds Number of seconds to increase time by
 * @param blocks Number of blocks to mine
 */
export const increaseTimeAndMine = async (
  seconds: number,
  blocks: number,
): Promise<void> => {
  await ethers.provider.send('evm_increaseTime', [seconds]);

  // Mine the specified number of blocks
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send('evm_mine', []);
  }
};
