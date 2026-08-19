export const promoteEvidenceH4GateEnvironmentKeys = [
  {
    gate: 'legacy-config-seed-preparation',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_LEGACY_CONFIG_SEED_PREPARATION',
  },
  {
    gate: 'legacy-config-seed',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_LEGACY_CONFIG_SEED',
  },
  {
    gate: 'legacy-config-seed-recheck',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_LEGACY_CONFIG_SEED_RECHECK',
  },
  {
    gate: 'production-config-seed-preparation',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_PRODUCTION_CONFIG_SEED_PREPARATION',
  },
  {
    gate: 'production-config-seed',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_PRODUCTION_CONFIG_SEED',
  },
  {
    gate: 'production-config-seed-prepare-stop',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_PRODUCTION_CONFIG_SEED_PREPARE_STOP',
  },
  {
    gate: 'production-config-seed-recheck',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_PRODUCTION_CONFIG_SEED_RECHECK',
  },
] as const;
