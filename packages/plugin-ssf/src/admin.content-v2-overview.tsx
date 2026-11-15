/** Read-only summaries of saved SSF configuration in the two existing scopes. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioSection } from '@sva/studio-ui-react';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
import type { SsfSystemContentV2View } from './content-v2-admin-contracts.js';
export const TenantOverview = ({
  value,
  retentionHours,
}: {
  value: SsfRuntimeContentV2Fields;
  retentionHours: number;
}) => {
  const pt = usePluginTranslation('ssf');
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(['appearance', 'languages', 'recordings', 'feedback'] as const).map((page) => (
        <StudioSection key={page} title={pt(`administration.pages.${page}`)}>
          {page === 'appearance' ? (
            <p>
              {pt('v2.logoUrl')}: {value.branding.logo?.url ?? pt('v2.notConfigured')}
            </p>
          ) : page === 'languages' ? (
            <>
              <p>
                {pt('v2.staff')}: {value.staff.locale}
              </p>
              <p>
                {value.guestLanguages
                  .map((entry) => `${entry.nativeName} (${entry.locale})`)
                  .join(', ')}
              </p>
            </>
          ) : page === 'recordings' ? (
            <>
              <p>
                {pt('administration.configuredRecording')}:{' '}
                {pt(
                  value.recording?.enabled ? 'administration.enabled' : 'administration.disabled'
                )}
              </p>
              <p>
                {pt('v2.recording.effectiveRetention')}: {retentionHours}
              </p>
            </>
          ) : (
            <>
              <p>
                {pt('v2.staff')}: {value.staff.feedback.headline}
              </p>
              {value.guestLanguages.map((entry) => (
                <p key={entry.locale}>
                  {entry.nativeName}: {entry.feedback.headline}
                </p>
              ))}
            </>
          )}
          <Button asChild variant="secondary">
            <a href={`/plugins/ssf/${page}`}>{pt('administration.open')}</a>
          </Button>
        </StudioSection>
      ))}
    </div>
  );
};

export const SystemOverview = ({ saved }: { saved: SsfSystemContentV2View }) => {
  const pt = usePluginTranslation('ssf');
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <StudioSection title={pt('v2.installation')}>
        {saved.installation ? (
          <>
            <p>
              {pt('v2.locale')}: {saved.installation.localization.locale}
            </p>
            <p>
              {pt('v2.logoUrl')}: {saved.installation.branding.logo?.url ?? pt('v2.notConfigured')}
            </p>
          </>
        ) : (
          <p>{pt('v2.notConfigured')}</p>
        )}
        <Button asChild variant="secondary">
          <a href="/plugins/ssf/system/default-content">
            {pt('administration.pages.default-content')}
          </a>
        </Button>
      </StudioSection>
      <StudioSection title={pt('v2.template')}>
        {saved.runtimeTemplate ? (
          <>
            <p>
              {pt('v2.staff')}: {saved.runtimeTemplate.staff.locale}
            </p>
            <p>
              {saved.runtimeTemplate.guestLanguages
                .map((entry) => `${entry.nativeName} (${entry.locale})`)
                .join(', ')}
            </p>
            <p>
              {pt('v2.recording.retentionHours')}:{' '}
              {saved.runtimeTemplate.recording?.retentionHours ?? 720}
            </p>
          </>
        ) : (
          <p>{pt('v2.notConfigured')}</p>
        )}
        <Button asChild variant="secondary">
          <a href="/plugins/ssf/system/default-configuration">
            {pt('administration.pages.default-configuration')}
          </a>
        </Button>
      </StudioSection>
    </div>
  );
};
