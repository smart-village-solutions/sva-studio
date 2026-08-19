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
] as const;
