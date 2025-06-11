import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ConfigPerNetwork } from '../types/index';
export interface ArkadaAddresses {
  arkadaRewarder?: string;
  pyramid?: string;
  arena?: string;
  escrowFactory?: string;
}

export const arkadaAddressesPerNetwork: ConfigPerNetwork<
  ArkadaAddresses | undefined
> = {
  soneium: {
    arkadaRewarder: '0x998F98F806F448cc1eAB301D10f95DE065EE2ABe',
    pyramid: '0x30410050CB1eBCF21741c9D3F817C386401f82fd',
    arena: '',
    escrowFactory: '0xfA15F981DDCa3A9bFaeE28c35334fC9539E18E9E',
  },
  sonic: {
    arkadaRewarder: '0xC062fB89Ed30AB70BEf17779A430CE81ccbB8617',
    pyramid: '0xE99F2AEfff9CCff34832747479Bd84658495F50A',
    arena: '',
    escrowFactory: '0x31E248307aBA066948947158AfDf1F9d554C62A1',
  },
  base: {
    arkadaRewarder: '0xC062fB89Ed30AB70BEf17779A430CE81ccbB8617',
    pyramid: '0xC909A19E3cE11841d46E9206f5FD9fe2Bc9B36b5',
    arena: '',
    escrowFactory: '0x84E5c76f4152E7b463BDa5Ded10559732Ac649C0',
  },
  monadtestnet: {
    arkadaRewarder: '0x360ecC5bf4E5E9aeec708571Fe286c33679c450B',
    pyramid: '0x30410050CB1eBCF21741c9D3F817C386401f82fd',
    arena: '',
    escrowFactory: '0x1AE93e93A8B421725F114a27c82237BEF4ada624',
  },
  arbitrum: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
  },
  hyperevm: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
  },
  'megaeth-testnet': {
    arkadaRewarder: '0x2AA3CF1839FA7273B9981c807FAc4246767d8031',
    pyramid: '0xD46B01CfA6282A07f7f7F019878158c34a5A0381',
    arena: '',
    escrowFactory: '0x3a6E887C0608f67FA015Bc115f1d76115b29d234',
  },
  'pharos-testnet': {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
  },
  plume: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
  },
  somnia: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
  },

  sepolia: undefined,
  hardhat: undefined,
  localhost: undefined,
};

export const getCurrentAddresses = (hre: HardhatRuntimeEnvironment) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (arkadaAddressesPerNetwork as any)[hre.network.name] as
    | ArkadaAddresses
    | undefined;
};
