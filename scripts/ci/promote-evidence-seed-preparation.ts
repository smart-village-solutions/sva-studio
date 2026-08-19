import type { PromoteGateEvidence, PromoteSeedPreparation } from './promote-evidence-types.ts';
import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';

type PreparationBindings = Readonly<{
  sourceSha: string | null;
  imageDigest: string | null;
  configRevision: string | null;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeEvidenceSeedPreparation = (
  value: unknown,
  gates: readonly PromoteGateEvidence[],
  bindings: PreparationBindings
): PromoteSeedPreparation | null => {
  const gatePassed = gates.some(
    (gate) => gate.gate === 'legacy-config-seed-preparation' && gate.status === 'passed'
  );
  if (!gatePassed && (value === null || value === undefined)) return null;
  if (!gatePassed || !isRecord(value)) {
    throw new Error('Seed-Vorbereitung widerspricht dem Gate-Vertrag.');
  }
  if (
    value.contract !== 'staging-live-config-label-prepare-v1' ||
    value.sourceSha !== bindings.sourceSha ||
    value.imageDigest !== bindings.imageDigest ||
    value.configRevision !== bindings.configRevision ||
    value.liveConfigRevisionState !== 'missing' ||
    value.backupExecutor !== 'agent'
  ) {
    throw new Error('Seed-Vorbereitung verletzt ihre Bindungen.');
  }
  return {
    contract: 'staging-live-config-label-prepare-v1',
    sourceSha: value.sourceSha as string,
    imageDigest: value.imageDigest as string,
    configRevision: value.configRevision as string,
    liveConfigRevisionState: 'missing',
    backupExecutor: 'agent',
  };
};

export const validatePreSeedPreparation = (
  value: unknown,
  bindings: PreparationBindings
): PromoteSeedPreparation => {
  const keys = [
    'backupExecutor',
    'configRevision',
    'contract',
    'imageDigest',
    'liveConfigRevisionState',
    'sourceSha',
  ];
  try {
    if (!isRecord(value) || Object.keys(value).sort().join() !== keys.join()) throw null;
    const preparation = normalizeEvidenceSeedPreparation(
      value,
      [
        {
          gate: 'legacy-config-seed-preparation',
          phase: 'static-preflight',
          status: 'passed',
          blocking: true,
        },
      ],
      bindings
    );
    if (!preparation) throw null;
    return preparation;
  } catch {
    throw new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
        environment: 'staging',
        phase: 'static-preflight',
      })
    );
  }
};
