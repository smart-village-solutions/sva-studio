import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { IconMap } from '@tabler/icons-react';
import { mapstickResourcePath, mapstickStyleIds, type MapstickStyleId } from '@sva/core';
import { Button } from './button.js';
import { Select } from './select.js';

export const isStudioMapstickStyle = (url: string): boolean =>
  url.startsWith(`${mapstickResourcePath}/styles/`);

const validStyle = (value: string | null): value is MapstickStyleId =>
  mapstickStyleIds.some((style) => style === value);

/** Storage is scoped to the resolved account and tenant; blocked storage remains optional. */
export const useStudioMapStyle = (defaultUrl: string, storageKey: string | null) => {
  const [preference, setPreference] = React.useState<{
    key: string | null;
    style: MapstickStyleId;
  } | null>(null);
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const value = window.localStorage.getItem(storageKey);
      if (validStyle(value)) setPreference({ key: storageKey, style: value });
    } catch {
      /* Browser privacy settings may disable persistence. */
    }
  }, [storageKey]);
  const selected = preference?.key === storageKey ? preference?.style : undefined;
  const resolveStyleUrl = (defaultUrl: string) =>
    isStudioMapstickStyle(defaultUrl) && selected
      ? `${mapstickResourcePath}/styles/${selected}/style.json`
      : defaultUrl;
  const chooseStyle = (style: string) => {
    if (!validStyle(style)) return;
    setPreference({ key: storageKey, style });
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, style);
      } catch {
        /* Keep the in-memory selection. */
      }
    }
  };
  return { styleUrl: resolveStyleUrl(defaultUrl), chooseStyle, resolveStyleUrl };
};

export function StudioMapStyleControl({
  styleUrl,
  onChange,
  disabled = false,
  t,
}: Readonly<{
  styleUrl: string;
  onChange: (style: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
}>) {
  const id = React.useId();
  if (!isStudioMapstickStyle(styleUrl)) return null;
  const selected =
    mapstickStyleIds.find((style) => styleUrl.endsWith(`/styles/${style}/style.json`)) ??
    'osm-bright';
  return (
    <div className="absolute right-3 top-3 z-10">
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={disabled}
            aria-label={t('studioMap.chooseStyle')}
          >
            <IconMap aria-hidden="true" className="h-5 w-5" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label={t('studioMap.chooseStyle')}
            sideOffset={8}
            align="end"
            className="z-50 w-56 space-y-2 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
          >
            <label htmlFor={id} className="text-sm font-medium">
              {t('studioMap.chooseStyle')}
            </label>
            <Select
              id={id}
              value={selected}
              onChange={(event) => onChange(event.currentTarget.value)}
            >
              {mapstickStyleIds.map((style) => (
                <option key={style} value={style}>
                  {t(`studioMap.styles.${style}`)}
                </option>
              ))}
            </Select>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

type ProtocolRuntime = {
  readonly addProtocol?: (name: string, handler: import('pmtiles').Protocol['tile']) => void;
};
const registeredRuntimes = new WeakSet<ProtocolRuntime>();
let protocol: Promise<import('pmtiles').Protocol> | undefined;
export const prepareStudioMapRuntime = async (runtime: ProtocolRuntime): Promise<void> => {
  if (registeredRuntimes.has(runtime)) return;
  if (!runtime.addProtocol) throw new Error('map_protocol_unavailable');
  protocol ??= import('pmtiles')
    .then(({ Protocol }) => new Protocol())
    .catch((error: unknown) => {
      protocol = undefined;
      throw error;
    });
  const loaded = await protocol;
  if (!registeredRuntimes.has(runtime)) {
    runtime.addProtocol('pmtiles', loaded.tile);
    registeredRuntimes.add(runtime);
  }
};
