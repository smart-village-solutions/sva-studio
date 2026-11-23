import React from 'react';
import { usePluginTranslation, type PluginDefinition } from '@sva/plugin-sdk';
import { Button, Input, StudioPageTitle } from '@sva/studio-ui-react';

import { pluginIvCampus as descriptor } from './descriptor.js';
import { ivCampusPilotStudioOrigin, ivCampusWidgetPath } from './widget-path.js';

function IvCampusSettings() {
  const pt = usePluginTranslation('ivcampus');
  const [origin, setOrigin] = React.useState<string>();
  const url = new URL(ivCampusWidgetPath, ivCampusPilotStudioOrigin).href;
  const [result, setResult] = React.useState<'copied' | 'copyFailed'>();
  const fieldId = React.useId();

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setResult('copied');
    } catch {
      setResult('copyFailed');
    }
  };

  return (
    <section className="max-w-xl space-y-4">
      <StudioPageTitle>{pt('settings')}</StudioPageTitle>
      {origin === ivCampusPilotStudioOrigin ? (
        <div className="space-y-2">
          <label htmlFor={fieldId}>{pt('widgetUrl')}</label>
          <Input id={fieldId} value={url} readOnly />
          <Button type="button" onClick={() => void copyUrl()}>
            {pt('copy')}
          </Button>
          <p role="status">{result ? pt(result) : ''}</p>
        </div>
      ) : origin ? (
        <p>{pt('pilotOnly')}</p>
      ) : null}
    </section>
  );
}

export const pluginIvCampus: PluginDefinition = {
  ...descriptor,
  routes: descriptor.routes.map((route) => ({ ...route, component: IvCampusSettings })),
};
