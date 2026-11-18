# Change: Configure local SSF passphrase files

## Why

SSF staff need an optional local passphrase file workflow controlled through existing Studio recording settings. The cross-repository feature was approved by the user on 2026-11-18; this delta records its Studio producer contract.

## What Changes

- Add strict boolean `recording.passphraseFileEnabled`, defaulting to false.
- Resolve tenant overrides before installation defaults and preserve explicit equal-valued choices until reset.
- Expose localized administration controls and the effective flag through the existing runtime response.

## Impact

- Affected specification: ssf-runtime-configuration.
- Affected code: existing `packages/plugin-ssf` recording schemas, resolver and editors.
- Affected arc42 section: 08 cross-cutting concepts; existing architecture and storage remain in use.
- No database migration, new service, recording enablement or archive permission change.
