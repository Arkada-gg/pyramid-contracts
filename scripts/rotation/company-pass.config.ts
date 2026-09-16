/**
 * Configuration for the ArkadaCompanyPass rotation.
 *
 * Separate from `config.ts` on purpose: the rotation of every other contract
 * is already finished there (`PHASE = 'revoke'`, `DRY_RUN = false`), and this
 * contract was deployed afterwards, so it has to walk the three phases from
 * the start without touching the settings of a completed run.
 *
 * The destination addresses (`NEW_OWNER` / `NEW_OPERATOR` / `NEW_SIGNER`) and
 * the compromised deployer are NOT redefined here - they are imported from
 * `config.ts`, so there is one source of truth for where control ends up.
 */
import { ROLE_ROUTING, RoleTargetKind, RotationPhase } from './config';

export type { RotationPhase, RoleTargetKind };

/**
 * Same three phases, same order, same rule: one at a time, with a manual
 * check in between.
 *
 * 1. `grant`    - give the new addresses their roles. Reversible.
 *                 Note this phase also hands out SIGNER_ROLE / URI_SETTER_ROLE
 *                 for the first time: `initialize` only grants
 *                 DEFAULT_ADMIN_ROLE, so on a freshly deployed pass nobody
 *                 holds them yet.
 * 2. `transfer` - hand over the ProxyAdmin that upgrades the pass. One-way.
 * 3. `revoke`   - strip the roles from the old holders. One-way.
 */
export const PHASE: RotationPhase = 'revoke';

/** While true the script only reads the chain and prints the plan. */
export const DRY_RUN = false;

/**
 * Deployed ArkadaCompanyPass proxies, keyed by hardhat network name.
 *
 * Not taken from `config/constants/addresses.ts` - the pass is not in that
 * registry. The two base entries are the proxies recorded in
 * `.openzeppelin/unknown-8453.json`; both point at the same implementation.
 * The script verifies every address really is a company pass before touching
 * it, so a wrong entry is reported rather than rotated.
 */
export const COMPANY_PASS_ADDRESSES: Record<string, string[]> = {
  base: [
    '0xb8EEE0fa14Cc5c41a7272C74b46DdcE959a6A6F8',
  ],
};

/**
 * Per-contract deviations from the routing used for everything else.
 *
 * Left empty deliberately: the pass declares DEFAULT_ADMIN_ROLE,
 * SIGNER_ROLE and URI_SETTER_ROLE, and all three are already routed in
 * `ROLE_ROUTING` the same way they were for the rest of the rotation
 * (URI_SETTER to the multisig, SIGNER to the hot signing key).
 *
 * If the backend is meant to update pass metadata without a multisig vote,
 * this is the one line to change:
 *   URI_SETTER_ROLE: 'operator',
 */
export const ROLE_ROUTING_OVERRIDES: Record<string, RoleTargetKind> = {};

export const COMPANY_PASS_ROLE_ROUTING: Record<string, RoleTargetKind> = {
  ...ROLE_ROUTING,
  ...ROLE_ROUTING_OVERRIDES,
};

/**
 * Addresses to check with `hasRole` on top of the shared candidate list.
 * Anything used while the pass was being set up - a test signer, the address
 * that granted URI_SETTER during a manual run.
 */
export const EXTRA_PASS_HOLDER_CANDIDATES: string[] = [];

/**
 * Unlike the main rotation this defaults to on: the pass was deployed
 * recently, so the RoleGranted history is a few thousand blocks rather than
 * a chain's worth, and a full holder scan costs a handful of requests.
 * Only the `revoke` phase uses it.
 */
export const SCAN_EVENTS = true;

/** Runaway guard for the adaptive log scan. */
export const SCAN_MAX_REQUESTS = 500;
