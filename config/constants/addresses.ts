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
