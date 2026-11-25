import { useId, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button, Input, StudioConfirmDialog } from '@sva/studio-ui-react';
import type { AppConfigurationDocument, AppConfigurationVariantCommand } from '@sva/sva-mainserver';
import { changeAppConfigurationVariant } from '../../lib/app-configuration-sync-api';
import { t } from '../../i18n';

const text = (key: string) => t(`interfaces.appConfiguration.${key}`);

const variantCommand = (
  { id, revision }: AppConfigurationDocument,
  operation: AppConfigurationVariantCommand['operation'],
  targetVersion: string
): AppConfigurationVariantCommand =>
  operation === 'create'
    ? { operation, id, revision, version: targetVersion.trim() || null }
    : { operation, id, revision };

export function VariantActions({
  entry,
  enabled,
  onCreated,
  onDeleted,
}: {
  entry: AppConfigurationDocument | null;
  enabled: boolean;
  onCreated: (document: AppConfigurationDocument) => void;
  onDeleted: (id: string) => void;
}) {
  const change = useServerFn(changeAppConfigurationVariant);
  const inputId = useId();
  const [dialog, setDialog] = useState<'create' | 'delete'>();
  const [targetVersion, setTargetVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  const open = (operation: 'create' | 'delete') => {
    setTargetVersion('');
    setMessage('');
    setFeedback('');
    setDialog(operation);
  };

  const confirm = async () => {
    if (!entry || !dialog || !enabled || busy) return;
    const command = variantCommand(entry, dialog, targetVersion);
    setBusy(true);
    try {
      const { appConfigurationVariantCommandSchema } = await import('@sva/sva-mainserver');
      const validated = appConfigurationVariantCommandSchema.safeParse(command);
      if (!validated.success) {
        setMessage('variantVersionError');
        return;
      }
      const response = await change({ data: validated.data });
      setDialog(undefined);
      if (!response.ok) {
        setFeedback(response.error === 'denied' ? 'variantDenied' : 'variant.unconfirmed');
        return;
      }
      const result = response.data;
      setFeedback(`variant.${result.status}`);
      if (result.status === 'created') onCreated(result.document);
      if (result.status === 'deleted') onDeleted(entry.id);
    } catch {
      setDialog(undefined);
      setFeedback('variant.unconfirmed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {entry && enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!entry.canCopy}
            onClick={() => open('create')}
          >
            {text('createVariant')}
          </Button>
          <Button type="button" variant="destructive" onClick={() => open('delete')}>
            {text('deleteVariant')}
          </Button>
          {!entry.canCopy && <p className="text-sm">{text('variantNameUnsupported')}</p>}
        </div>
      )}
      {feedback && (
        <p role={['variant.created', 'variant.deleted'].includes(feedback) ? 'status' : 'alert'}>
          {text(feedback)}
        </p>
      )}
      {entry && dialog && enabled && (
        <StudioConfirmDialog
          open
          title={text(dialog === 'create' ? 'createVariant' : 'deleteVariant')}
          description={t(
            dialog === 'create'
              ? 'interfaces.appConfiguration.copyDescription'
              : 'interfaces.appConfiguration.deleteDescription',
            { name: entry.name, version: entry.version || text('unversioned'), id: entry.id }
          )}
          confirmLabel={text(dialog === 'create' ? 'confirmCreateVariant' : 'confirmDeleteVariant')}
          cancelLabel={text('cancelVariant')}
          onConfirm={() => void confirm()}
          onCancel={() => setDialog(undefined)}
          confirmDisabled={busy}
          cancelDisabled={busy}
        >
          {dialog === 'create' && (
            <div className="space-y-2">
              <label htmlFor={inputId}>{text('targetVersion')}</label>
              <Input
                id={inputId}
                value={targetVersion}
                onChange={(event) => {
                  setTargetVersion(event.target.value);
                  setMessage('');
                }}
                maxLength={64}
                disabled={busy}
                aria-describedby={`${inputId}-help`}
                aria-invalid={!!message}
              />
              <p id={`${inputId}-help`} className="text-sm">
                {text('targetVersionHelp')}
              </p>
              {message && <p role="alert">{text(message)}</p>}
            </div>
          )}
        </StudioConfirmDialog>
      )}
    </>
  );
}
