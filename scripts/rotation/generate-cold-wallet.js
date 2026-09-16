/**
 * Cold wallet generator for the rotation NEW_OWNER.
 *
 * Run it on a machine with no network. The mnemonic and the private key of the
 * main account are printed once, to the terminal only - nothing here writes
 * either of them to disk in plaintext.
 *
 *   node scripts/rotation/generate-cold-wallet.js
 *   node scripts/rotation/generate-cold-wallet.js --keystore ./owner.json
 *   node scripts/rotation/generate-cold-wallet.js --accounts 5
 *
 * Flags:
 *   --allow-online     skip the offline check (for a dry look, not for real keys)
 *   --keystore <path>  also write a password-encrypted JSON keystore
 *   --accounts <n>     how many addresses to derive and show (default 3)
 */

// Standalone CommonJS: this runs with bare `node` on an offline machine, with
// no build step and no ESM loader, so require() is the only option here.
/* eslint-disable @typescript-eslint/no-var-requires */

const { utils, Wallet } = require('ethers');

const { randomBytes } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const MIN_PASSWORD_LENGTH = 12;

const parseArgs = (argv) => {
  const options = { allowOnline: false, keystore: null, accounts: 3 };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-online') options.allowOnline = true;
    else if (arg === '--keystore') options.keystore = argv[(i += 1)];
    else if (arg === '--accounts') options.accounts = Number(argv[(i += 1)]);
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.accounts) || options.accounts < 1) {
    throw new Error('--accounts expects a positive integer');
  }
  if (options.keystore !== null && !options.keystore) {
    throw new Error('--keystore expects a file path');
  }

  return options;
};

/** Interfaces that can carry the seed off this machine. */
const activeInterfaces = () =>
  Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses || [])
      .filter((address) => !address.internal)
      .map((address) => `${name} (${address.address})`),
  );

const ask = (query, hidden) =>
  new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('a password prompt needs an interactive terminal'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (!hidden) {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    // Echo the prompt, then swallow every keystroke so the password never
    // reaches the screen or the scrollback.
    process.stdout.write(query);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    rl._writeToOutput = () => {};
    rl.question('', (answer) => {
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });

const readPassword = async () => {
  const password = await ask('keystore password: ', true);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  const confirmation = await ask('repeat password: ', true);
  if (password !== confirmation) throw new Error('passwords do not match');
  return password;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  const online = activeInterfaces();
  if (online.length > 0 && !options.allowOnline) {
    console.error('This machine is online:');
    online.forEach((iface) => console.error(`  - ${iface}`));
    console.error(
      '\nA key generated on a networked machine is not a cold key.\n' +
        'Disable networking and run again, or pass --allow-online for a\n' +
        'throwaway look at the output.',
    );
    process.exitCode = 1;
    return;
  }
  if (options.allowOnline) {
    console.log('!! --allow-online: treat everything below as throwaway\n');
  }

  // Everything that can fail happens before the seed is on screen, so an
  // abort never leaves a printed mnemonic behind with nothing written.
  let target = null;
  let password = null;
  if (options.keystore) {
    target = path.resolve(options.keystore);
    if (fs.existsSync(target)) {
      throw new Error(`${target} already exists, refusing to overwrite`);
    }
    fs.accessSync(path.dirname(target), fs.constants.W_OK);
    password = await readPassword();
  }

  // 32 bytes of OS entropy -> 24 words. Not Wallet.createRandom(), so the
  // entropy source is explicit rather than whatever the library picked.
  const mnemonic = utils.entropyToMnemonic(randomBytes(32));
  const root = utils.HDNode.fromMnemonic(mnemonic);

  const accounts = [];
  for (let index = 0; index < options.accounts; index += 1) {
    const derivationPath = `m/44'/60'/0'/0/${index}`;
    const node = root.derivePath(derivationPath);

    // Round-trip: the words on paper must reproduce this exact address.
    const restored = Wallet.fromMnemonic(mnemonic, derivationPath);
    if (restored.address !== node.address) {
      throw new Error(`derivation mismatch at ${derivationPath}`);
    }

    accounts.push({ path: derivationPath, address: node.address });
  }

  const mainWallet = Wallet.fromMnemonic(mnemonic, accounts[0].path);

  console.log('mnemonic (24 words, write it on paper - shown once):\n');
  console.log(`  ${mnemonic}\n`);
  console.log('addresses:');
  accounts.forEach(({ path: derivationPath, address }) =>
    console.log(`  ${derivationPath}  ${address}`),
  );
  console.log('\nNEW_OWNER =', accounts[0].address);
  console.log(`private key (${accounts[0].path}):\n`);
  console.log(`  ${mainWallet.privateKey}\n`);
  console.log(
    'The key and the mnemonic are the same secret - either one alone is\n' +
      'full control of this wallet. Neither was written to disk.',
  );

  if (target) {
    console.log('\nencrypting (scrypt, takes a few seconds)...');

    const encrypted = await mainWallet.encrypt(password);
    fs.writeFileSync(target, encrypted, { mode: 0o600 });

    // A keystore that cannot be opened is worse than no keystore, so check
    // now rather than the day it is needed.
    const reopened = await Wallet.fromEncryptedJson(
      fs.readFileSync(target, 'utf8'),
      password,
    );
    if (reopened.address !== accounts[0].address) {
      throw new Error('keystore verification failed');
    }

    console.log(`keystore written and verified: ${target}`);
    console.log('The password is not recoverable. Store it separately.');
  }

  console.log(
    '\nThis address controls ProxyAdmin across every network once the\n' +
      'transfer phase runs. Prefer it as an owner key of a Safe multisig\n' +
      'rather than as the sole admin.',
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
