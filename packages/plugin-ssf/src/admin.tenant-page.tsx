import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { readSsfTenantConfiguration, writeSsfTenantConfiguration } from './admin-api.js';
import { ConfigurationFields } from './admin.configuration-fields.js';
import type {
  SsfSystemConfigurationInput,
  SsfTenantConfigurationInput,
} from './admin-contracts.js';

const useCanManageTenantConfiguration = (): boolean =>
  useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  ).permissionActions.includes('ssf.configuration.tenant.manage');

export const SsfTenantConfigurationPage = () => {
  const pt = usePluginTranslation('ssf');
  const canManage = useCanManageTenantConfiguration();
  const [system, setSystem] = useState<SsfSystemConfigurationInput | null>(null);
  const [saved, setSaved] = useState<SsfTenantConfigurationInput | null>(null);
  const [draft, setDraft] = useState<SsfTenantConfigurationInput | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'saving' | 'saved'>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await readSsfTenantConfiguration();
      setSystem(next.system);
      setSaved(next.overrides);
      setDraft(next.overrides);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => void load(), [load]);
  const save = async (value: SsfTenantConfigurationInput) => {
    setSaveFailed(false);
    setState('saving');
    try {
      const next = await writeSsfTenantConfiguration(value);
      setSystem(next.system);
      setSaved(next.overrides);
      setDraft(next.overrides);
      setState('saved');
    } catch {
      setSaveFailed(true);
      setState('ready');
    }
  };
  if (state === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (state === 'error' || !draft || !system)
    return (
      <StudioErrorState>
        <button type="button" onClick={() => void load()}>
          {pt('status.loadError')}
        </button>
      </StudioErrorState>
    );
  return (
    <StudioOverviewPageTemplate
      title={pt('page.tenantTitle')}
      description={pt('page.tenantDescription')}
    >
      {state === 'saved' ? (
        <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary>
      ) : null}
      {saveFailed ? (
        <StudioFormSummary kind="error">{pt('status.saveError')}</StudioFormSummary>
      ) : null}
      <ConfigurationFields
        value={draft}
        tenantSystem={system}
        onChange={(next) => setDraft(next as SsfTenantConfigurationInput)}
        disabled={!canManage || state === 'saving'}
      />
      {canManage ? (
        <StudioFormActionBar>
          <Button
            type="button"
            variant="secondary"
            disabled={state === 'saving'}
            onClick={() => setDraft(saved)}
          >
            {pt('actions.discard')}
          </Button>
          <Button type="button" disabled={state === 'saving'} onClick={() => void save(draft)}>
            {pt(state === 'saving' ? 'actions.saving' : 'actions.save')}
          </Button>
        </StudioFormActionBar>
      ) : null}
    </StudioOverviewPageTemplate>
  );
};
