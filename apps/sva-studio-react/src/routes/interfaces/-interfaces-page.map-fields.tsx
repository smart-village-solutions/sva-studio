import { t } from '../../i18n';
import type { InstanceInterfaceDraft } from '../../lib/instance-interfaces';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const MapGeocodingFields = ({
  draft,
  hasStoredApiKey,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }>;
  hasStoredApiKey: boolean;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => {
  const updateConfig = (
    patch: Partial<Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }>['config']>
  ) => {
    onChange({
      ...draft,
      config: {
        ...draft.config,
        ...patch,
      },
    });
  };

  return (
    <>
      {draft.config.provider === 'geoapify' ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">{t('interfaces.forms.mapGeocoding.setup.title')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('interfaces.forms.mapGeocoding.setup.description')}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>{t('interfaces.forms.mapGeocoding.setup.createProject')}</li>
            <li>{t('interfaces.forms.mapGeocoding.setup.copyApiKey')}</li>
            <li>{t('interfaces.forms.mapGeocoding.setup.keepDefaults')}</li>
          </ol>
          <a
            className="mt-3 inline-flex font-medium text-primary underline-offset-4 hover:underline"
            href="https://myprojects.geoapify.com/"
            target="_blank"
            rel="noreferrer"
          >
            {t('interfaces.forms.mapGeocoding.setup.openGeoapify')}
          </a>
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="map-provider">{t('interfaces.forms.mapGeocoding.provider')}</Label>
          <select
            id="map-provider"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.config.provider}
            onChange={(event) =>
              updateConfig({
                provider: event.currentTarget.value as typeof draft.config.provider,
              })
            }
          >
            <option value="geoapify">Geoapify</option>
            <option value="custom">
              {t('interfaces.forms.mapGeocoding.providerOptions.custom')}
            </option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="map-style-url">{t('interfaces.forms.mapGeocoding.styleUrl')}</Label>
          <Input
            id="map-style-url"
            type="url"
            value={draft.config.styleUrl}
            onChange={(event) => updateConfig({ styleUrl: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="map-suggest-endpoint">
            {t('interfaces.forms.mapGeocoding.suggestEndpoint')}
          </Label>
          <Input
            id="map-suggest-endpoint"
            type="url"
            value={draft.config.suggestEndpoint}
            onChange={(event) => updateConfig({ suggestEndpoint: event.currentTarget.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="map-geocode-endpoint">
            {t('interfaces.forms.mapGeocoding.geocodeEndpoint')}
          </Label>
          <Input
            id="map-geocode-endpoint"
            type="url"
            value={draft.config.geocodeEndpoint}
            onChange={(event) => updateConfig({ geocodeEndpoint: event.currentTarget.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="map-reverse-endpoint">
            {t('interfaces.forms.mapGeocoding.reverseGeocodeEndpoint')}
          </Label>
          <Input
            id="map-reverse-endpoint"
            type="url"
            value={draft.config.reverseGeocodeEndpoint}
            onChange={(event) =>
              updateConfig({ reverseGeocodeEndpoint: event.currentTarget.value })
            }
          />
          {hasStoredApiKey ? <div aria-hidden="true" className="min-h-10" /> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="map-api-key">{t('interfaces.forms.mapGeocoding.apiKey')}</Label>
          <Input
            id="map-api-key"
            type="password"
            aria-describedby={hasStoredApiKey ? 'map-api-key-hint' : undefined}
            placeholder={
              hasStoredApiKey
                ? t('interfaces.forms.mapGeocoding.apiKeyReplacementPlaceholder')
                : undefined
            }
            value={draft.config.apiKey}
            onChange={(event) => updateConfig({ apiKey: event.currentTarget.value })}
          />
          {hasStoredApiKey ? (
            <div id="map-api-key-hint" className="min-h-10 space-y-1 text-xs text-muted-foreground">
              <p>{t('interfaces.forms.mapGeocoding.apiKeyConfiguredStatus')}</p>
              <p>{t('interfaces.forms.mapGeocoding.apiKeyConfiguredHint')}</p>
            </div>
          ) : null}
        </div>
      </div>

      <MapRuntimeFields draft={draft} updateConfig={updateConfig} />
    </>
  );
};

type MapDraft = Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }>;
type UpdateMapConfig = (patch: Partial<MapDraft['config']>) => void;

const MapRuntimeFields = ({
  draft,
  updateConfig,
}: {
  draft: MapDraft;
  updateConfig: UpdateMapConfig;
}) => (
  <>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="map-timeout">{t('interfaces.forms.mapGeocoding.requestTimeoutMs')}</Label>
        <Input
          id="map-timeout"
          inputMode="numeric"
          value={draft.config.requestTimeoutMs}
          onChange={(event) => updateConfig({ requestTimeoutMs: event.currentTarget.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="map-rate-limit">
          {t('interfaces.forms.mapGeocoding.rateLimitPerMinute')}
        </Label>
        <Input
          id="map-rate-limit"
          inputMode="numeric"
          value={draft.config.rateLimitPerMinute}
          onChange={(event) => updateConfig({ rateLimitPerMinute: event.currentTarget.value })}
        />
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <Label htmlFor="map-autocomplete-enabled" className="flex items-center gap-3">
        <Checkbox
          id="map-autocomplete-enabled"
          checked={draft.config.autocompleteEnabled}
          onChange={(event) => updateConfig({ autocompleteEnabled: event.currentTarget.checked })}
        />
        <span>{t('interfaces.forms.mapGeocoding.autocompleteEnabled')}</span>
      </Label>
      <Label htmlFor="map-geocode-enabled" className="flex items-center gap-3">
        <Checkbox
          id="map-geocode-enabled"
          checked={draft.config.geocodeEnabled}
          onChange={(event) => updateConfig({ geocodeEnabled: event.currentTarget.checked })}
        />
        <span>{t('interfaces.forms.mapGeocoding.geocodeEnabled')}</span>
      </Label>
      <Label htmlFor="map-reverse-enabled" className="flex items-center gap-3">
        <Checkbox
          id="map-reverse-enabled"
          checked={draft.config.reverseGeocodeEnabled}
          onChange={(event) => updateConfig({ reverseGeocodeEnabled: event.currentTarget.checked })}
        />
        <span>{t('interfaces.forms.mapGeocoding.reverseGeocodeEnabled')}</span>
      </Label>
      <Label htmlFor="map-kill-switch-enabled" className="flex items-center gap-3">
        <Checkbox
          id="map-kill-switch-enabled"
          checked={draft.config.killSwitchEnabled}
          onChange={(event) => updateConfig({ killSwitchEnabled: event.currentTarget.checked })}
        />
        <span>{t('interfaces.forms.mapGeocoding.killSwitchEnabled')}</span>
      </Label>
    </div>
  </>
);
