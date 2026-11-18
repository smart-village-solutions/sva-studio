import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { Button, StudioFormSummary, StudioLoadingState } from '@sva/studio-ui-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react';
import { errors } from './organisation-key-contracts.js';
export interface RecordingActor {
  tenantId: string;
  actor: string;
}
export const RecordingContext = ({
  form: Form,
  permission,
}: {
  form: ComponentType<RecordingActor>;
  permission: string;
}) => {
  const pt = usePluginTranslation('ssf');
  const session = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  if (!session.isResolved && !session.hasError)
    return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (session.hasError) return <RecordingError code="RECORDING_UNAVAILABLE" />;
  if (!session.subjectId) return <RecordingError code="AUTHENTICATION_REQUIRED" />;
  if (!session.instanceId || !session.permissionActions.includes(permission))
    return <RecordingError code="PERMISSION_REQUIRED" />;
  return (
    <Form
      key={JSON.stringify([session.instanceId, session.subjectId, session.organizationId])}
      tenantId={session.instanceId}
      actor={session.subjectId}
    />
  );
};
export const useRecordingTask = () => {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setError('');
  }, []);
  const run = useCallback(async (action: (signal: AbortSignal) => Promise<void>) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      await action(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) {
        const parsed = errors.safeParse(e instanceof Error ? e.message : '');
        setError(parsed.success ? parsed.data : 'RECORDING_UNAVAILABLE');
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }, []);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    []
  );
  return { busy, error, run, cancel };
};
export const RecordingError = ({ code }: { code: string }) => {
  const pt = usePluginTranslation('ssf');
  if (!code) return null;
  return (
    <StudioFormSummary kind="error">
      {pt('keys.errors.' + code)}
      {code === 'AUTHENTICATION_REQUIRED' ? (
        <Button asChild>
          <a
            href={
              '/auth/login?returnTo=' +
              encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname)
            }
          >
            {pt('keys.login')}
          </a>
        </Button>
      ) : null}
    </StudioFormSummary>
  );
};
