const { utils } = require('ethers');

const errors = [
  'Pyramid__IsNotSigner()',
  'Pyramid__MintingIsNotActive()',
  'Pyramid__FeeNotEnough()',
  'Pyramid__SignatureAndCubesInputMismatch()',
  'Pyramid__WithdrawFailed()',
  'Pyramid__ClaimRewardsFailed()',
  'Pyramid__NonceAlreadyUsed()',
  'Pyramid__TransferFailed()',
  'Pyramid__BPSTooHigh()',
  'Pyramid__ExcessiveFeePayout()',
  'Pyramid__ExceedsContractBalance()',
  'Pyramid__QuestNotActive()',
  'Pyramid__NativePaymentFailed()',
  'Pyramid__ERC20TransferFailed()',
  'Pyramid__ExceedsContractAllowance()',
  'Pyramid__TreasuryNotSet()',
  'Pyramid__ZeroAddress()',
  'Pyramid__InvalidAdminAddress()',
];

const targetError = '0xccbd642a';

console.log('Looking for error selector:', targetError);
console.log('\nError selectors:');

errors.forEach((e) => {
  const hash = utils.keccak256(utils.toUtf8Bytes(e));
  const selector = '0x' + hash.slice(2, 10);
  const match =
    selector.toLowerCase() === targetError.toLowerCase() ? ' <-- MATCH!' : '';
  console.log(e.padEnd(30) + ' => ' + selector + match);
});
