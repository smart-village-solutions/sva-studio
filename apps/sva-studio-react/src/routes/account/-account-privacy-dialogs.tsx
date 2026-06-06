import React from 'react';

import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { ModalDialog } from '../../components/ModalDialog';
import { t } from '../../i18n';

type NoteDialogState = {
  readonly open: boolean;
  readonly note: string;
  readonly onClose: () => void;
  readonly onNoteChange: (value: string) => void;
  readonly onSubmit: () => void;
};

const ACCESS_FAX_DURATION_MS = 20_000;
const ACCESS_FAX_FAILURE_MS = 19_000;
const ACCESS_FAX_PROGRESS_TICK_MS = 250;

const AccessFaxFileIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className="h-12 w-12 shrink-0">
    <defs>
      <linearGradient id="access-fax-globe" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stopColor="#1b7bd8" />
        <stop offset="100%" stopColor="#0b2d8f" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="12" fill="url(#access-fax-globe)" stroke="#0f172a" strokeWidth="1.2" />
    <path d="M8 13.5h16M9 19.5h14M16 4.5c2.7 3.1 4.1 6.9 4.1 11.5S18.7 24.4 16 27.5M16 4.5c-2.7 3.1-4.1 6.9-4.1 11.5S13.3 24.4 16 27.5" fill="none" stroke="#dff8ff" strokeWidth="1.1" />
    <path d="M8.5 8.8l4.1 2.5-2.1 3.4-4.2-2.6Zm2.9 10.8 3.5-5.7 3.6 2.2-3.5 5.7Zm8.3-6 1.8-2.9 5.3 3.3-1.7 2.9Z" fill="#2db24a" stroke="#105b22" strokeWidth="0.8" />
  </svg>
);

const AccessFaxFolderIcon = () => (
  <svg viewBox="0 0 40 32" aria-hidden="true" className="h-11 w-14 shrink-0">
    <path d="M4 9h10l2.6 3H36v13.5c0 1.4-1.1 2.5-2.5 2.5h-27A2.5 2.5 0 0 1 4 25.5z" fill="#f1d15b" stroke="#7a5d13" strokeWidth="1" />
    <path d="M3.5 12.5h33v-2.6c0-1.1-.9-1.9-1.9-1.9H18l-2.6-3H6c-1.4 0-2.5 1.1-2.5 2.5z" fill="#fff0a6" stroke="#7a5d13" strokeWidth="1" />
    <path d="M4.5 14h31L33 27H4.5z" fill="#ecd36f" opacity="0.65" />
  </svg>
);

type AccessFaxTitleBarButtonProps =
  | {
      readonly children: React.ReactNode;
      readonly onClick: () => void;
      readonly ariaLabel: string;
    }
  | {
      readonly children: React.ReactNode;
      readonly onClick?: undefined;
      readonly ariaLabel?: undefined;
    };

const AccessFaxTitleBarButton = ({ children, onClick, ariaLabel }: AccessFaxTitleBarButtonProps) => {
  const className =
    'flex h-[17px] w-[19px] items-center justify-center border border-black bg-[#c0c0c0] shadow-[1px_1px_0_0_#ffffff_inset,-1px_-1px_0_0_#7b7b7b_inset] text-[10px] leading-none text-black';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
        {children}
      </button>
    );
  }

  return (
    <span aria-hidden="true" className={className}>
      {children}
    </span>
  );
};

const resolveAccessFaxStatusKey = (elapsedMs: number, failed: boolean): string => {
  if (failed) {
    return 'account.privacy.dialogs.accessFax.status.failed';
  }
  if (elapsedMs >= 12_000) {
    return 'account.privacy.dialogs.accessFax.status.handshake';
  }
  if (elapsedMs >= 6_000) {
    return 'account.privacy.dialogs.accessFax.status.toner';
  }
  return 'account.privacy.dialogs.accessFax.status.paper';
};

const resolveAccessFaxDisplayedPercent = (elapsedMs: number, failed: boolean): number => {
  const progressPercent = failed ? 95 : Math.min((elapsedMs / ACCESS_FAX_DURATION_MS) * 100, 95);
  return Math.max(3, Math.round(progressPercent));
};

const formatAccessFaxRemainingTime = (elapsedMs: number, failed: boolean): string => {
  const remainingMs = failed ? 0 : Math.max(ACCESS_FAX_DURATION_MS - elapsedMs, 0);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const RequestDialog = ({
  afterForm,
  description,
  footerStart,
  isSubmitting,
  noteInputId,
  noteState,
  submitLabel,
  title,
}: Readonly<{
  afterForm?: React.ReactNode;
  description: string;
  footerStart?: React.ReactNode;
  isSubmitting: boolean;
  noteInputId: string;
  noteState: NoteDialogState;
  submitLabel: string;
  title: string;
}>) => (
  <ModalDialog open={noteState.open} title={title} description={description} onClose={noteState.onClose}>
    <form
      className="space-y-5 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        noteState.onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={noteInputId}>{t('account.privacy.dialogs.shared.noteLabel')}</Label>
        <Textarea
          id={noteInputId}
          value={noteState.note}
          onChange={(event) => noteState.onNoteChange(event.target.value)}
          rows={5}
          disabled={isSubmitting}
          placeholder={t('account.privacy.dialogs.shared.notePlaceholder')}
        />
      </div>
      <div className={footerStart ? 'flex flex-wrap items-center justify-between gap-3' : 'flex justify-end gap-3'}>
        {footerStart ? <div>{footerStart}</div> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={noteState.onClose}>
            {t('account.privacy.dialogs.shared.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
    {afterForm}
  </ModalDialog>
);

const AccessFaxEasterEggDialog = ({
  open,
  onClose,
}: Readonly<{
  open: boolean;
  onClose: () => void;
}>) => {
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setElapsedMs(0);
      setFailed(false);
      return;
    }

    setElapsedMs(0);
    setFailed(false);

    const progressTimer = window.setInterval(() => {
      setElapsedMs((current) => Math.min(current + ACCESS_FAX_PROGRESS_TICK_MS, ACCESS_FAX_FAILURE_MS));
    }, ACCESS_FAX_PROGRESS_TICK_MS);

    const failureTimer = window.setTimeout(() => {
      window.clearInterval(progressTimer);
      setElapsedMs(ACCESS_FAX_FAILURE_MS);
      setFailed(true);
    }, ACCESS_FAX_FAILURE_MS);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(failureTimer);
    };
  }, [open]);

  const progressPercent = failed ? 95 : Math.min((elapsedMs / ACCESS_FAX_DURATION_MS) * 100, 95);
  const displayedPercent = resolveAccessFaxDisplayedPercent(elapsedMs, failed);
  const totalSegments = 14;
  const filledSegments = open ? Math.max(1, Math.round((progressPercent / 100) * totalSegments)) : 0;

  return (
    <ModalDialog
      open={open}
      title={t('account.privacy.dialogs.accessFax.title')}
      description={t('account.privacy.dialogs.accessFax.description')}
      onClose={onClose}
      overlayClassName="z-[60] bg-slate-950/35 backdrop-blur-0"
      contentClassName="z-[60] max-w-[23rem] rounded-none border border-black bg-[#c0c0c0] p-0 shadow-[1px_1px_0_0_#ffffff_inset,-1px_-1px_0_0_#7b7b7b_inset,6px_7px_0_rgba(15,23,42,0.34)]"
      headerClassName="sr-only"
    >
      <div className="border-b border-black bg-[linear-gradient(90deg,#000080_0%,#0019a8_56%,#1084d0_100%)] px-[3px] py-[3px] text-white">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate pl-1 text-[14px] font-bold leading-none tracking-[-0.01em]">
            {t('account.privacy.dialogs.accessFax.windowTitle', { progress: displayedPercent })}
          </span>
          <div className="flex items-center gap-[2px]">
            <AccessFaxTitleBarButton>
              <span className="mt-[6px] h-[2px] w-[8px] bg-black" />
            </AccessFaxTitleBarButton>
            <AccessFaxTitleBarButton>
              <span className="h-[8px] w-[10px] border border-black bg-transparent" />
            </AccessFaxTitleBarButton>
            <AccessFaxTitleBarButton onClick={onClose} ariaLabel={t('account.privacy.dialogs.accessFax.closeWindow')}>
              <span className="font-bold">×</span>
            </AccessFaxTitleBarButton>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4 text-[13px] leading-tight text-black">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <AccessFaxFileIcon />
            <div className="space-y-[3px] pt-[2px]">
              <p>{t('account.privacy.dialogs.accessFax.statusHeading')}</p>
              <p className="break-all">{t('account.privacy.dialogs.accessFax.fileLine')}</p>
            </div>
          </div>
          <div className="pr-1 pt-1">
            <AccessFaxFolderIcon />
          </div>
        </div>

        <div className="space-y-1">
          <p>{t(resolveAccessFaxStatusKey(elapsedMs, failed))}</p>
          <div
            role="progressbar"
            aria-label={t('account.privacy.dialogs.accessFax.progressAriaLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayedPercent}
            className="grid h-[18px] grid-cols-[repeat(14,minmax(0,1fr))] gap-[2px] border border-[#87888f] bg-white px-[4px] py-[3px] shadow-[1px_1px_0_0_#7b7b7b_inset,-1px_-1px_0_0_#ffffff_inset]"
          >
            {Array.from({ length: totalSegments }, (_, index) => {
              const isFilled = index < filledSegments;
              return (
                <span
                  key={`fax-progress-segment-${index}`}
                  data-progress-filled={isFilled ? 'true' : 'false'}
                  className={`h-full ${
                    isFilled
                      ? failed
                        ? 'bg-[#b91c1c]'
                        : 'bg-[#0606a7]'
                      : 'bg-transparent'
                  }`}
                />
              );
            })}
          </div>
          <div className="space-y-[2px] pt-1">
            <p>
              {t('account.privacy.dialogs.accessFax.estimatedTimeLabel')}{' '}
              {formatAccessFaxRemainingTime(elapsedMs, failed)}
            </p>
            <p className="break-all">
              {t('account.privacy.dialogs.accessFax.destinationLabel')}{' '}
              {t('account.privacy.dialogs.accessFax.destinationPath')}
            </p>
            <p>
              {t('account.privacy.dialogs.accessFax.transferRateLabel')}{' '}
              {t('account.privacy.dialogs.accessFax.transferRateValue')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-[2px]">
          <span
            aria-hidden="true"
            className="flex h-[13px] w-[13px] items-center justify-center border border-black bg-white text-[11px] leading-none shadow-[1px_1px_0_0_#7b7b7b_inset,-1px_-1px_0_0_#ffffff_inset]"
          >
            ✓
          </span>
          <span>{t('account.privacy.dialogs.accessFax.autoCloseLabel')}</span>
        </div>

        <div className="flex justify-end gap-[6px] pt-1">
          <button
            type="button"
            disabled
            className="min-w-[74px] border border-black bg-[#c0c0c0] px-3 py-[5px] text-[13px] text-[#7b7b7b] shadow-[1px_1px_0_0_#ffffff_inset,-1px_-1px_0_0_#7b7b7b_inset] disabled:cursor-default"
          >
            {t('account.privacy.dialogs.accessFax.open')}
          </button>
          <button
            type="button"
            disabled
            className="min-w-[88px] border border-black bg-[#c0c0c0] px-3 py-[5px] text-[13px] text-[#7b7b7b] shadow-[1px_1px_0_0_#ffffff_inset,-1px_-1px_0_0_#7b7b7b_inset] disabled:cursor-default"
          >
            {t('account.privacy.dialogs.accessFax.openFolder')}
          </button>
          <button
            type="button"
            className="min-w-[74px] border border-black bg-[#c0c0c0] px-3 py-[5px] text-[13px] text-black shadow-[1px_1px_0_0_#ffffff_inset,-1px_-1px_0_0_#7b7b7b_inset] active:translate-y-px active:shadow-[1px_1px_0_0_#7b7b7b_inset,-1px_-1px_0_0_#ffffff_inset]"
            onClick={onClose}
          >
            {t('account.privacy.dialogs.accessFax.close')}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

const AccessRequestDialog = ({
  isSubmitting,
  noteState,
}: Readonly<{
  isSubmitting: boolean;
  noteState: NoteDialogState;
}>) => {
  const [faxDialogOpen, setFaxDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!noteState.open) {
      setFaxDialogOpen(false);
    }
  }, [noteState.open]);

  return (
    <RequestDialog
      title={t('account.privacy.dialogs.access.title')}
      description={t('account.privacy.dialogs.access.description')}
      isSubmitting={isSubmitting}
      noteInputId="privacy-access-request-note"
      noteState={noteState}
      submitLabel={t('account.privacy.dialogs.access.submit')}
      footerStart={
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => setFaxDialogOpen(true)}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          {t('account.privacy.dialogs.accessFax.title')}
        </button>
      }
      afterForm={<AccessFaxEasterEggDialog open={faxDialogOpen} onClose={() => setFaxDialogOpen(false)} />}
    />
  );
};

export const PrivacyDialogs = ({
  accessDialog,
  deletionDialog,
  exportDialog,
  isSubmitting,
  objectionDialog,
  permissionChangeDialog,
  restrictionDialog,
}: Readonly<{
  accessDialog: NoteDialogState;
  deletionDialog: NoteDialogState;
  exportDialog: {
    readonly format: 'json' | 'csv' | 'xml';
    readonly onClose: () => void;
    readonly onFormatChange: (value: 'json' | 'csv' | 'xml') => void;
    readonly onSubmit: () => void;
    readonly open: boolean;
  };
  isSubmitting: boolean;
  objectionDialog: NoteDialogState;
  permissionChangeDialog: NoteDialogState;
  restrictionDialog: NoteDialogState;
}>) => (
  <>
    <ModalDialog
      open={permissionChangeDialog.open}
      title={t('account.privacy.permissionChange.dialog.title')}
      description={t('account.privacy.permissionChange.dialog.description')}
      onClose={permissionChangeDialog.onClose}
    >
      <form
        className="space-y-5 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          permissionChangeDialog.onSubmit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="privacy-permission-change-note">
            {t('account.privacy.permissionChange.fields.requestNote')}
          </Label>
          <Textarea
            id="privacy-permission-change-note"
            value={permissionChangeDialog.note}
            onChange={(event) => permissionChangeDialog.onNoteChange(event.target.value)}
            rows={5}
            disabled={isSubmitting}
            placeholder={t('account.privacy.permissionChange.fields.requestNotePlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('account.privacy.permissionChange.fields.requestNoteHint')}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={permissionChangeDialog.onClose}>
            {t('account.privacy.permissionChange.actions.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {t('account.privacy.permissionChange.actions.submit')}
          </Button>
        </div>
      </form>
    </ModalDialog>

    <ModalDialog
      open={exportDialog.open}
      title={t('account.privacy.dialogs.export.title')}
      description={t('account.privacy.dialogs.export.description')}
      onClose={exportDialog.onClose}
    >
      <form
        className="space-y-5 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          exportDialog.onSubmit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="privacy-export-format">{t('account.privacy.dialogs.export.formatLabel')}</Label>
          <Select
            id="privacy-export-format"
            value={exportDialog.format}
            onChange={(event) => exportDialog.onFormatChange(event.target.value as 'json' | 'csv' | 'xml')}
            disabled={isSubmitting}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="xml">XML</option>
          </Select>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={exportDialog.onClose}>
            {t('account.privacy.dialogs.shared.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {t('account.privacy.dialogs.export.submit')}
          </Button>
        </div>
      </form>
    </ModalDialog>

    <AccessRequestDialog isSubmitting={isSubmitting} noteState={accessDialog} />
    <RequestDialog
      title={t('account.privacy.dialogs.objection.title')}
      description={t('account.privacy.dialogs.objection.description')}
      isSubmitting={isSubmitting}
      noteInputId="privacy-objection-request-note"
      noteState={objectionDialog}
      submitLabel={t('account.privacy.dialogs.objection.submit')}
    />
    <RequestDialog
      title={t('account.privacy.dialogs.deletion.title')}
      description={t('account.privacy.dialogs.deletion.description')}
      isSubmitting={isSubmitting}
      noteInputId="privacy-deletion-request-note"
      noteState={deletionDialog}
      submitLabel={t('account.privacy.dialogs.deletion.submit')}
    />
    <RequestDialog
      title={t('account.privacy.dialogs.restriction.title')}
      description={t('account.privacy.dialogs.restriction.description')}
      isSubmitting={isSubmitting}
      noteInputId="privacy-restriction-request-note"
      noteState={restrictionDialog}
      submitLabel={t('account.privacy.dialogs.restriction.submit')}
    />
  </>
);
