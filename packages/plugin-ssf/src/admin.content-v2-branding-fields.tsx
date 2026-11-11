/** Existing logo/icon fields and whole-medium inheritance resets. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField, StudioSection } from '@sva/studio-ui-react';
import { useId } from 'react';

import { type SsfV2EditorProps as EditorProps } from './admin.content-v2-field-control.js';
import type {
  SsfInstallationContentV2Fields,
  SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';

type FormValue = SsfInstallationContentV2Fields | SsfRuntimeContentV2Fields;

export const BrandingFields = <T extends FormValue>(props: EditorProps<T>) => {
  const pt = usePluginTranslation('ssf');
  const idBase = useId();
  const updateMedia = (purpose: 'logo' | 'icon', part: 'url' | 'alternativeText', next: string) => {
    const current = props.value.branding[purpose];
    const medium =
      part === 'url' && next === ''
        ? null
        : {
            url: current?.url ?? '',
            alternativeText: current?.alternativeText ?? '',
            [part]: next,
          };
    props.onChange({ ...props.value, branding: { ...props.value.branding, [purpose]: medium } });
  };
  return (
    <StudioSection title={pt('v2.branding')}>
      {(['logo', 'icon'] as const).map((purpose) => (
        <div key={purpose} className="grid gap-4 md:grid-cols-2">
          <StudioField id={`${idBase}-ssf-v2-${purpose}-url`} label={pt(`v2.${purpose}Url`)}>
            <Input
              id={`${idBase}-ssf-v2-${purpose}-url`}
              type="url"
              disabled={props.disabled}
              value={props.value.branding[purpose]?.url ?? ''}
              onChange={(event) => updateMedia(purpose, 'url', event.currentTarget.value)}
            />
          </StudioField>
          <StudioField id={`${idBase}-ssf-v2-${purpose}-alt`} label={pt('v2.alternativeText')}>
            <Input
              id={`${idBase}-ssf-v2-${purpose}-alt`}
              disabled={props.disabled}
              value={props.value.branding[purpose]?.alternativeText ?? ''}
              onChange={(event) =>
                updateMedia(purpose, 'alternativeText', event.currentTarget.value)
              }
            />
          </StudioField>
          {props.inherited ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
              <span>
                {pt(
                  JSON.stringify(props.value.branding[purpose]) ===
                    JSON.stringify(props.inherited.branding[purpose])
                    ? 'v2.inherited'
                    : 'v2.overridden'
                )}
              </span>
              <Button
                type="button"
                variant="tertiary"
                disabled={props.disabled}
                onClick={() =>
                  props.onChange(
                    {
                      ...props.value,
                      branding: {
                        ...props.value.branding,
                        [purpose]: props.inherited?.branding[purpose] ?? null,
                      },
                    },
                    ['branding', purpose]
                  )
                }
              >
                {pt('fields.inherit')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </StudioSection>
  );
};
