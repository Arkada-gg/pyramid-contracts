/**
 * Configuration for the compromised-key rotation scripts.
 *
 * Fill in the addresses below before running with DRY_RUN = false.
 * Every run is scoped to a single network (`--network <name>`).
 */

/**
 * Phases are executed one at a time, in this order, with a manual
 * verification step in between:
 *
 * 1. `grant`    - give the new addresses every role the current holders have.
 *                 Reversible, nothing breaks.
 * 2. `transfer` - hand over ProxyAdmin and Ownable contracts. One-way.
 * 3. `revoke`   - strip the roles from every old holder. One-way.
 *                 DEFAULT_ADMIN_ROLE of the executing account goes last.
 */
export type RotationPhase = 'grant' | 'transfer' | 'revoke';

export const PHASE: RotationPhase = 'revoke';

/**
 * While true the scripts only read the chain and print the plan.
 * No transaction is sent.
 */
export const DRY_RUN = false;

/**
 * Multisig / cold wallet. Receives everything that controls upgrades and money.
 */
export const NEW_OWNER = '0xEc38A8ff6Ae438F3b3a585cc4E617135c94af229';

/**
 * Hot wallet used by the backend for automated calls
 * (rewards, distributions, minting).
 * Leave empty to route these roles to NEW_OWNER as well - this stops the
 * backend from working until it is pointed at the multisig.
 */
export const NEW_OPERATOR = '0x948908C1d4EDE75c9F20a3cC9ef8105e8F1bd4de';

/**
 * Hot wallet whose private key the backend signs EIP-712 payloads with.
 *
 * MUST be an EOA: the contracts verify mints via `ECDSA.recover` and then
 * `hasRole(SIGNER_ROLE, signer)`. A multisig address here permanently breaks
 * signature-based minting, there is no ERC-1271 fallback.
 */
export const NEW_SIGNER = '0x319A2713A5F6790ff16e8bc43eD94DBDE9aD1c19';

export type RoleTargetKind = 'owner' | 'operator' | 'signer';

/**
 * Which of the three addresses above each role goes to.
 * Keyed by the getter name exposed by the contract, not by the hashed string.
 */
export const ROLE_ROUTING: Record<string, RoleTargetKind> = {
  DEFAULT_ADMIN_ROLE: 'owner',
  ADMIN_ROLE: 'owner',
  URI_SETTER_ROLE: 'owner',
  // Withdraws funds out of GlobalEscrow - not a hot wallet job.
  WITHDRAWER_ROLE: 'owner',

  OPERATOR_ROLE: 'operator',
  MINTER_ROLE: 'operator',
  DISTRIBUTOR_ROLE: 'operator',

  SIGNER_ROLE: 'signer',
};

/**
 * Roles discovered on-chain but missing from ROLE_ROUTING go here.
 * `owner` is the safe default: worst case an operation needs a multisig vote.
 */
export const DEFAULT_ROLE_TARGET: RoleTargetKind = 'owner';

/**
 * The compromised deployer. Used as a holder candidate and to decide which
 * revocation must be sent last.
 */
export const COMPROMISED_DEPLOYER =
  '0xd0623f1fC15d9cb59D0dc81f3498F30bcaE6B97C';

/**
 * Addresses that are known to hold roles, from the deploy scripts in this repo.
 * They are checked with `hasRole` even when the event scan fails, so a role is
 * never silently left behind on an old holder.
 */
export const KNOWN_HOLDER_CANDIDATES: string[] = [
  COMPROMISED_DEPLOYER,
  // post-deploy-pyr.ts: SIGNER_ADDRESS / grant-arena-operator-role.ts: ACCOUNT
  '0xDE91c31f1b9c3dc4270cADaec8ab4C4C5aCAD93f',
  // post-deploy-pyr.ts: NEW_ADMIN
  '0x4a665E6785556624324637695C4A20465D5D7b74',
];

/**
 * Anything else you know about - old team wallets, retired backend signers.
 */
export const EXTRA_HOLDER_CANDIDATES: string[] = [];

/**
 * Event-log scan settings. The contracts are not AccessControlEnumerable, so
 * the full holder set can only be reconstructed from RoleGranted/RoleRevoked.
 */
export const SCAN_EVENTS = false;

/**
 * Ceiling on eth_getLogs requests per contract.
 *
 * The scan does not use a fixed chunk size: it asks for the whole range and
 * halves it on every refusal, so a strict RPC converges on its own limit.
 * This is only a runaway guard - raise it for a chain with a long history and
 * a stingy RPC.
 */
export const SCAN_MAX_REQUESTS = 2000;
