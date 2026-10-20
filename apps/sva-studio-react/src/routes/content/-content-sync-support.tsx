import React from 'react';
import { Button } from '@sva/studio-ui-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Textarea } from '../../components/ui/textarea';
import { t } from '../../i18n';
import type {
  ContentCredentialRecovery,
  IamContentListMetadata,
} from '../../lib/iam-api-content-types';
import type { IamHttpError } from '../../lib/iam-api';

const reasonKeys: Readonly<Record<string, string>> = {
  personal_credentials_missing: 'personalMissing',
  personal_credentials_partial: 'personalPartial',
  keycloak_unavailable: 'keycloakUnavailable',
  database_unavailable: 'databaseUnavailable',
  organization_state_not_recoverable: 'organizationState',
  technical_account_mismatch: 'accountMismatch',
  keycloak_credentials_incomplete: 'keycloakIncomplete',
  credential_version_mismatch: 'versionMismatch',
  binding_not_verified: 'bindingNotVerified',
  concurrent_change: 'concurrentChange',
  credential_decryption_failed: 'decryptionFailed',
  credential_readback_failed: 'readbackFailed',
  principal_not_allowed: 'principalNotAllowed',
  recovery_not_claimed: 'notClaimed',
  credential_encryption_unavailable: 'encryptionUnavailable',
  content_refresh_failed: 'contentFailed',
  recovery_not_applicable: 'notApplicable',
  checking: 'interrupted',
  restored: 'restored',
  credentials_reloaded: 'reloaded',
  recovery_failed: 'failed',
};

type SyncStates = IamContentListMetadata['mainserverSyncStates'];
const getSupportEntries = (
  effectiveDiagnostics: readonly ContentCredentialRecovery[],
  states: SyncStates,
  fallback: ContentCredentialRecovery,
  detectedAt: string
): readonly ContentCredentialRecovery[] => {
  const failedStates = states.filter((state) => state.lastErrorCode);
  return effectiveDiagnostics.length > 0
    ? effectiveDiagnostics
    : failedStates.length > 0
      ? failedStates.map((state) => ({
          ...fallback,
          contentType: state.contentType,
          occurredAt: state.lastFailedAt ?? detectedAt,
        }))
      : [fallback];
};

const getSupportText = (
  entries: readonly ContentCredentialRecovery[],
  states: SyncStates,
  contentTypes: readonly string[],
  error: IamHttpError | null
): string => {
  const unknown = t('content.recovery.unknown');
  return entries
    .map((entry) =>
      t('content.recovery.supportText', {
        instance: entry.instanceId || unknown,
        contentType: entry.contentType || contentTypes.join(', ') || unknown,
        time: entry.occurredAt,
        source: t(`content.recovery.sources.${entry.source}`),
        code:
          states.find((state) => state.contentType === entry.contentType)?.lastErrorCode ??
          error?.code ??
          unknown,
        reason: entry.reasonCode,
        outcome: t(`content.recovery.outcomes.${entry.outcome}`),
        requestId: entry.originalRequestId ?? error?.requestId ?? unknown,
        recoveryRequestId: entry.requestId ?? unknown,
      })
    )
    .join('\n\n');
};

export const ContentSyncSupport = ({
  diagnostics = [],
  metadata,
  error,
  pending = false,
  instanceId,
  contentTypes = [],
}: Readonly<{
  diagnostics?: readonly ContentCredentialRecovery[];
  metadata: IamContentListMetadata | null;
  error: IamHttpError | null;
  pending?: boolean;
  instanceId?: string;
  contentTypes?: readonly string[];
}>) => {
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const detectedAt = React.useMemo(() => new Date().toISOString(), [error?.requestId, error?.code]);
  const states = metadata?.mainserverSyncStates ?? [];
  const persisted = states.flatMap((state) =>
    state.credentialRecovery ? [state.credentialRecovery] : []
  );
  const effectiveDiagnostics = diagnostics.length > 0 ? diagnostics : persisted;
  const hasError =
    Boolean(error && error.status >= 500) ||
    states.some((state) => state.lastErrorCode) ||
    effectiveDiagnostics.some(
      (entry) =>
        entry.outcome === 'failed' ||
        entry.outcome === 'not_possible' ||
        entry.outcome === 'checking'
    );
  if (pending)
    return (
      <p role="status" aria-live="polite">
        {t('content.recovery.checking')}
      </p>
    );
  if (!hasError) return null;
  const fallback: ContentCredentialRecovery = {
    instanceId: instanceId ?? '',
    contentType: contentTypes.join(', '),
    source: 'unknown',
    outcome: 'not_possible',
    reasonCode: 'recovery_not_applicable',
    occurredAt: detectedAt,
    ...(error?.requestId ? { originalRequestId: error.requestId } : {}),
  };
  const entries = getSupportEntries(effectiveDiagnostics, states, fallback, detectedAt);
  const text = getSupportText(entries, states, contentTypes, error);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };
  return (
    <Alert className="border-destructive/40 bg-destructive/5 text-destructive" role="alert">
      <AlertDescription className="space-y-3">
        <p>{t('content.recovery.failed')}</p>
        <ul className="list-disc space-y-1 pl-5">
          {entries.map((entry, index) => (
            <li key={`${entry.contentType}-${index}`}>
              {t(`content.recovery.sources.${entry.source}`)}
              {': '}
              {t(`content.recovery.reasons.${reasonKeys[entry.reasonCode] ?? 'failed'}`)}
            </li>
          ))}
        </ul>
        <p>
          {metadata?.hasBlockingSyncGap || !states.some((state) => state.hasSnapshot)
            ? t('content.recovery.noSnapshot')
            : t('content.recovery.snapshotRetained')}
        </p>
        <p>{t('content.recovery.contact', { email: 'support@smart-village.solutions' })}</p>
        <label className="block space-y-1">
          <span>{t('content.recovery.supportLabel')}</span>
          <Textarea readOnly value={text} rows={9} />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void copy();
          }}
        >
          {t('content.recovery.copy')}
        </Button>
        {copyStatus !== 'idle' ? (
          <p role="status" aria-live="polite">
            {t(
              copyStatus === 'copied' ? 'content.recovery.copied' : 'content.recovery.copyFailure'
            )}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};
