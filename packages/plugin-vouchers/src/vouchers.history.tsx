import { useState } from 'react';
import {
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { StudioContentHistory } from '@sva/studio-ui-react';
export function VoucherHistory({
  id,
}: Readonly<{
  id: string;
}>) {
  const t = usePluginTranslation('vouchers');
  const [open, setOpen] = useState(false);
  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-lg border border-border p-4"
    >
      <summary className="cursor-pointer font-medium">{t('history.title')}</summary>
      {open && (
        <StudioContentHistory
          contentId={id}
          loadHistory={(contentId) =>
            fetchIamContentHistory(contentId, { contentType: 'vouchers.voucher' })
          }
          labels={{
            loading: t('history.loading'),
            error: t('history.errors.load'),
            empty: t('history.empty'),
            createHint: t('history.createHint'),
            tableLabel: t('history.tableLabel'),
            time: t('history.columns.time'),
            action: t('history.columns.action'),
            actor: t('history.columns.actor'),
            summary: t('history.columns.summary'),
            sourceNotice: t('history.sourceNotice'),
            emptySummary: t('history.emptySummary'),
          }}
          formatAction={(action) =>
            t(
              action === 'created'
                ? 'history.actions.created'
                : action === 'status_changed'
                  ? 'history.actions.statusChanged'
                  : 'history.actions.updated'
            )
          }
          formatDate={(value) => formatDateTimeInEditorTimeZone(value) ?? value}
        />
      )}
    </details>
  );
}
