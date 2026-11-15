import React from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useStudioEditorLeaveGuard } from '@sva/studio-ui-react';
import type {
  AppConfigurationPreview as Preview,
  LoadedAppConfigurationPreview as Loaded,
} from '@sva/sva-mainserver';
import { loadAppConfigurationPreview } from '../../lib/app-configuration-preview-api';
import { t } from '../../i18n';
export type AppConfigurationDraft = { alternativeLocation: string; tileTitleLines: string };
export type AppConfigurationPreviewField = Loaded['fields'][keyof Loaded['fields']];
const text = (key: string) => t(`interfaces.appConfiguration.${key}`);
const initialDraft = (source: Loaded): AppConfigurationDraft => ({
  alternativeLocation:
    source.fields.alternativeLocation.state === 'value'
      ? String(source.fields.alternativeLocation.value)
      : source.fields.alternativeLocation.state,
  tileTitleLines:
    source.fields.tileTitleLines.state === 'value'
      ? String(source.fields.tileTitleLines.value)
      : '',
});

export const useAppConfigurationPreview = (contextReady: boolean) => {
  const read = useServerFn(loadAppConfigurationPreview);
  const [version, setVersion] = React.useState('');
  const [versionError, setVersionError] = React.useState(false);
  const [result, setResult] = React.useState<Loaded | null>(null);
  const [unavailableReason, setUnavailableReason] = React.useState<
    Extract<Preview, { status: 'unavailable' }>['reason'] | null
  >(null);
  const [draft, setDraft] = React.useState<AppConfigurationDraft>({
    alternativeLocation: 'missing',
    tileTitleLines: '',
  });
  const [linesTouched, setLinesTouched] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const source = result;
  const base = source ? initialDraft(source) : null;
  const dirty =
    base !== null &&
    (draft.alternativeLocation !== base.alternativeLocation ||
      draft.tileTitleLines !== base.tileTitleLines ||
      (linesTouched && source?.fields.tileTitleLines.state === 'unsupported'));
  const invalidLines =
    draft.tileTitleLines !== '' &&
    (!Number.isSafeInteger(Number(draft.tileTitleLines)) || Number(draft.tileTitleLines) <= 0);
  const discard = () => {
    if (source) setDraft(initialDraft(source));
    setLinesTouched(false);
  };
  useStudioEditorLeaveGuard({
    enabled: Boolean(source),
    hasUnsavedChanges: dirty,
    onDiscard: () => {
      setResult(null);
      setDraft({ alternativeLocation: 'missing', tileTitleLines: '' });
      setLinesTouched(false);
    },
  });
  React.useEffect(() => {
    heading.current?.focus();
  }, []);

  const load = async () => {
    if (!contextReady || pending) return;
    setPending(true);
    setError(false);
    setUnavailableReason(null);
    try {
      const { appConfigurationSelectionSchema } = await import('@sva/sva-mainserver');
      const selection = appConfigurationSelectionSchema.safeParse({
        version: version.trim() || null,
      });
      setVersionError(!selection.success);
      if (!selection.success || (dirty && !window.confirm(text('confirmReload')))) return;
      const next = await read({ data: selection.data });
      if (next.status === 'unavailable') {
        setUnavailableReason(next.reason);
        return;
      }
      setResult(next);
      setDraft(initialDraft(next));
      setLinesTouched(false);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };
  const changes = source
    ? [
        ...(draft.alternativeLocation !== base?.alternativeLocation
          ? [
              {
                key: 'alternativeLocation',
                before: source.fields.alternativeLocation,
                after:
                  draft.alternativeLocation === 'missing'
                    ? { state: 'missing' as const }
                    : { state: 'value' as const, value: draft.alternativeLocation === 'true' },
              },
            ]
          : []),
        ...((draft.tileTitleLines !== base?.tileTitleLines ||
          (linesTouched && source.fields.tileTitleLines.state === 'unsupported')) &&
        !invalidLines
          ? [
              {
                key: 'lines',
                before: source.fields.tileTitleLines,
                after:
                  draft.tileTitleLines === ''
                    ? { state: 'missing' as const }
                    : { state: 'value' as const, value: Number(draft.tileTitleLines) },
              },
            ]
          : []),
      ]
    : [];

  return {
    version,
    setVersion,
    versionError,
    setVersionError,
    result,
    unavailableReason,
    source,
    draft,
    setDraft,
    linesTouched,
    setLinesTouched,
    dirty,
    invalidLines,
    discard,
    load,
    changes,
    pending,
    error,
    heading,
  };
};
