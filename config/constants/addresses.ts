import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { ConfigPerNetwork } from '../types/index';
export interface ArkadaAddresses {
  arkadaRewarder?: string;
  pyramid?: string;
  pyramidEscrowMulti?: string;
  arena?: string;
  escrowFactory?: string;
  globalEscrow?: string;
  arkadaMap?: string;
  arkadaMapBoost?: string;
}

export const arkadaAddressesPerNetwork: ConfigPerNetwork<
  ArkadaAddresses | undefined
> = {
  soneium: {
    arkadaRewarder: '0x998F98F806F448cc1eAB301D10f95DE065EE2ABe',
    pyramid: '0x30410050CB1eBCF21741c9D3F817C386401f82fd',
    // pyramid: '0xecB880DD8a970f347f93b87335FC5172500f2beE', // dev
    arena: '0xAEDF46Add9A2f466565AA2b4f20C3C21e334E1e3',
    escrowFactory: '0xfA15F981DDCa3A9bFaeE28c35334fC9539E18E9E',
    globalEscrow: '0x971E77D2823A8311923a69d62021E3311502C7Be',
    pyramidEscrowMulti: '0x467D58B7198ab3F6976F53a9b1d96991B2EE7a29',
    // pyramidEscrowMulti: '0xe8F84D11a97D0e9Fb51DAE5a0f42857745e30634', // dev
    arkadaMap: '0x005b96FE2e267bb0e668BdE007C9207ca1e3aD85',
    // arkadaMap: '0x9a1D1B8eB209e16AaF3F56A7a0ea9B36E07B5cae',
    arkadaMapBoost: '0x7F0353c080e2797F0766FdcD73787234bB04ACBE',
  },
  tempo: {
    pyramid: '0x2AA3CF1839FA7273B9981c807FAc4246767d8031',
    globalEscrow: '0x26189A7C19C99119E2B6c027de6a9EB75d0Bc051',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
  },
  sonic: {
    arkadaRewarder: '0xC062fB89Ed30AB70BEf17779A430CE81ccbB8617',
    pyramid: '0xE99F2AEfff9CCff34832747479Bd84658495F50A',
    arena: '',
    escrowFactory: '0x31E248307aBA066948947158AfDf1F9d554C62A1',
    globalEscrow: '0x998F98F806F448cc1eAB301D10f95DE065EE2ABe',
    pyramidEscrowMulti: '',
  },
  base: {
    arkadaRewarder: '0xC062fB89Ed30AB70BEf17779A430CE81ccbB8617',
    pyramid: '0xC909A19E3cE11841d46E9206f5FD9fe2Bc9B36b5',
    arena: '0x436De6acD08d955127e3c8D858E79CdFbA8E6C77',
    // arena: '0x452fA1E987Bee28Cb74BA69f641321B40429eab3',
    escrowFactory: '0x84E5c76f4152E7b463BDa5Ded10559732Ac649C0',
    globalEscrow: '0x922E6aE68dF456b12b88502B4863dF54a9da9E39',
    pyramidEscrowMulti: '0xAF1eeA37C239AE88105cA9658378D75aeaf2e482',
  },
  monadtestnet: {
    arkadaRewarder: '0x360ecC5bf4E5E9aeec708571Fe286c33679c450B',
    pyramid: '0x30410050CB1eBCF21741c9D3F817C386401f82fd',
    // arena: '0xaFE0b6447c308561AA17f05280a86ff27de8286c',
    arena: '0x173F63ae500A471d86db16045cb05c13d88afc07',
    escrowFactory: '0x1AE93e93A8B421725F114a27c82237BEF4ada624',
    globalEscrow: '0xb49F921292a3cEe16b6F23e64374103f237CF2e3',
    pyramidEscrowMulti: '',
  },
  arbitrum: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xa4e6101e26BD7d2C418aDb3bbF3189375678eb99',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
    globalEscrow: '0x52440733017f0546C16B5c61ac0c270D3d3E95F3',
    pyramidEscrowMulti: '',
  },
  hyperevm: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
    globalEscrow: '0xa4e6101e26BD7d2C418aDb3bbF3189375678eb99',
    pyramidEscrowMulti: '',
  },
  'megaeth-testnet': {
    arkadaRewarder: '0x2AA3CF1839FA7273B9981c807FAc4246767d8031',
    pyramid: '0xD46B01CfA6282A07f7f7F019878158c34a5A0381',
    arena: '',
    escrowFactory: '0x3a6E887C0608f67FA015Bc115f1d76115b29d234',
    pyramidEscrowMulti: '',
  },
  'pharos-testnet': {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0x0A0AA8F43701E796Cc346f6DB5c6A102172ea098',
    arena: '',
    escrowFactory: '0x173F63ae500A471d86db16045cb05c13d88afc07',
    globalEscrow: '0x1AE93e93A8B421725F114a27c82237BEF4ada624',
    pyramidEscrowMulti: '',
  },
  plume: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
    globalEscrow: '0x3a6E887C0608f67FA015Bc115f1d76115b29d234',
    pyramidEscrowMulti: '',
  },
  somnia: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
    pyramidEscrowMulti: '',
  },
  abstract: {
    arkadaRewarder: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    pyramid: '0xF668DDa15336129BC9977e36d60c14220cdc63Ec',
    arena: '',
    escrowFactory: '0x6F6310e20503620CaBA906371dcfBCff511b38A9',
    globalEscrow: '0xa4e6101e26BD7d2C418aDb3bbF3189375678eb99',
    pyramidEscrowMulti: '',
  },
  'monad-mainnet': {
    arkadaRewarder: '',
    pyramid: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    arena: '',
    escrowFactory: '0x6cCDBf30F8944edCB7495E43A875Ec4Ce1802989',
    globalEscrow: '0x4DF24Ab367C801187929FEb2841853DBa40208B0',
    pyramidEscrowMulti: '',
  },
  unichain: {
    arkadaRewarder: '',
    pyramid: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    arena: '',
    escrowFactory: '0x6cCDBf30F8944edCB7495E43A875Ec4Ce1802989',
    globalEscrow: '0x4DF24Ab367C801187929FEb2841853DBa40208B0',
    pyramidEscrowMulti: '0x30410050CB1eBCF21741c9D3F817C386401f82fd',
  },
  'bsc-mainnet': {
    arkadaRewarder: '',
    pyramid: '0x3db744585f892dc77750b2f4376B4Fc1Dd66d510',
    arena: '',
    escrowFactory: '0x30410050CB1eBCF21741c9D3F817C386401f82fd',
    globalEscrow: '0x4DF24Ab367C801187929FEb2841853DBa40208B0',
    pyramidEscrowMulti: '',
  },
  citrea: {
    pyramid: '0x587E81F7fe9729BA6130090f76fECDc602950398',
    globalEscrow: '0x26189A7C19C99119E2B6c027de6a9EB75d0Bc051',
    escrowFactory: '0x0A0AA8F43701E796Cc346f6DB5c6A102172ea098',
  },
  ink: {
    pyramid: '0x2AA3CF1839FA7273B9981c807FAc4246767d8031',
    globalEscrow: '0x26189A7C19C99119E2B6c027de6a9EB75d0Bc051',
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
