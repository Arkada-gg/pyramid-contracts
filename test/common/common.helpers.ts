import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish, Contract, ethers } from 'ethers';

export type OptionalCommonParams = {
  from?: SignerWithAddress;
  revertMessage?: string;
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
}

export interface ITransactionData {
  txHash: string;
  networkChainId: string;
}

export interface IFeeRecipient {
  recipient: string;
  BPS: number;
}

export interface IMintPyramidEscrowData {
  questId: number;
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
}

// Encode string values using keccak256
export const encodeString = (str: string): string =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(str));

const TYPES_ESCROW = {
  PyramidData: [
    { name: 'questId', type: 'uint256' },
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

const TYPES = {
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

export const signMintDataEscrowTyped = async (
  data: IMintPyramidEscrowData,
  signer: SignerWithAddress,
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  },
) => {
  // Sign the hash directly
  return await signer._signTypedData(domain, TYPES_ESCROW, data);
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
  // Sign the hash directly
  return await signer._signTypedData(domain, TYPES, data);
};
