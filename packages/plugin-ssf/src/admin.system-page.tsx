import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormActionBar,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useState } from 'react';

import { readSsfSystemConfiguration, writeSsfSystemConfiguration } from './admin-api.js';
import { ConfigurationFields } from './admin.configuration-fields.js';
import type { SsfSystemConfigurationInput } from './admin-contracts.js';

export const SsfSystemConfigurationPage = () => {
  const pt = usePluginTranslation('ssf');
  const [saved, setSaved] = useState<SsfSystemConfigurationInput | null>(null);
  const [draft, setDraft] = useState<SsfSystemConfigurationInput | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'saving' | 'saved'>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await readSsfSystemConfiguration();
      setSaved(next);
      setDraft(next);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => void load(), [load]);
  const save = async (value: SsfSystemConfigurationInput) => {
    setSaveFailed(false);
    setState('saving');
    try {
      const next = await writeSsfSystemConfiguration(value);
      setSaved(next);
      setDraft(next);
      setState('saved');
    } catch {
      setSaveFailed(true);
      setState('ready');
    }
  };
  if (state === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (state === 'error' || !draft)
    return (
      <StudioErrorState>
        <button type="button" onClick={() => void load()}>
          {pt('status.loadError')}
        </button>
      </StudioErrorState>
    );
  return (
    <StudioOverviewPageTemplate
      title={pt('page.systemTitle')}
      description={pt('page.systemDescription')}
    >
      {state === 'saved' ? (
        <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary>
      ) : null}
      {saveFailed ? (
        <StudioFormSummary kind="error">{pt('status.saveError')}</StudioFormSummary>
      ) : null}
      <ConfigurationFields
        value={draft}
        onChange={(next) => setDraft(next as SsfSystemConfigurationInput)}
        disabled={state === 'saving'}
      />
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
    </StudioOverviewPageTemplate>
  );
};
