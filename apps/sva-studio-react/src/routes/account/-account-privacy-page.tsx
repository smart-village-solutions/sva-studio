import React from 'react';

import {
  buildMyDataExportDownloadUrl,
  createDataSubjectRequest,
  requestDataExport,
  requestPermissionChange,
} from '../../lib/iam-api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { t } from '../../i18n';
import { PrivacyActionCards } from './-account-privacy-action-cards';
import { PrivacyActivityTable } from './-account-privacy-activity-table';
import { PrivacyDialogs } from './-account-privacy-dialogs';
import { useAccountPrivacyState } from './-account-privacy-state';

const buildRequestPayload = (note: string) => {
  const trimmedNote = note.trim();
  return trimmedNote.length > 0 ? { reason: trimmedNote } : undefined;
};

export const AccountPrivacyPage = () => {
  const {
    errorMessage,
    filters,
    isLoading,
    isSubmitting,
    runAction,
    setErrorMessage,
    setFilters,
    setStatusMessage,
    statusMessage,
    visibleRows,
  } = useAccountPrivacyState();
  const [permissionChangeDialogOpen, setPermissionChangeDialogOpen] = React.useState(false);
  const [permissionChangeNote, setPermissionChangeNote] = React.useState('');
  const [accessDialogOpen, setAccessDialogOpen] = React.useState(false);
  const [accessNote, setAccessNote] = React.useState('');
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<'json' | 'csv' | 'xml'>('json');
  const [objectionDialogOpen, setObjectionDialogOpen] = React.useState(false);
  const [objectionNote, setObjectionNote] = React.useState('');
  const [deletionDialogOpen, setDeletionDialogOpen] = React.useState(false);
  const [deletionNote, setDeletionNote] = React.useState('');
  const [restrictionDialogOpen, setRestrictionDialogOpen] = React.useState(false);
  const [restrictionNote, setRestrictionNote] = React.useState('');

  const resetFeedback = React.useCallback(() => {
    setErrorMessage(null);
    setStatusMessage(null);
  }, [setErrorMessage, setStatusMessage]);

  const openDialog = React.useCallback(
    (open: () => void) => {
      resetFeedback();
      open();
    },
    [resetFeedback]
  );

  const submitRequest = React.useCallback(
    async (
      type: 'access' | 'deletion' | 'restriction' | 'objection',
      note: string,
      onClose: () => void,
      onReset: () => void,
      messageKey: string
    ) => {
      await runAction(async () => {
        await createDataSubjectRequest({
          type,
          payload: buildRequestPayload(note),
        });
        onClose();
        onReset();
        setStatusMessage(t(messageKey));
      });
    },
    [runAction, setStatusMessage]
  );

  const handlePermissionChangeSubmit = async () => {
    const trimmedNote = permissionChangeNote.trim();
    if (!trimmedNote) {
      setErrorMessage(t('account.privacy.permissionChange.validation.required'));
      return;
    }

    await runAction(async () => {
      await requestPermissionChange({ requestNote: trimmedNote });
      setPermissionChangeDialogOpen(false);
      setPermissionChangeNote('');
      setStatusMessage(t('account.privacy.messages.permissionChangeRequested'));
    });
  };

  const handleExportSubmit = async () => {
    await runAction(async () => {
      await requestDataExport({ format: exportFormat, async: true });
      setExportDialogOpen(false);
      setStatusMessage(t('account.privacy.messages.exportRequested'));
    });
  };

  return (
    <section className="space-y-6" aria-busy={isLoading || isSubmitting}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.privacy.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('account.privacy.subtitle')}</p>
      </header>

      <PrivacyActionCards
        disabled={isSubmitting}
        onOpenPermissionChange={() => openDialog(() => setPermissionChangeDialogOpen(true))}
        onOpenAccessDialog={() => openDialog(() => setAccessDialogOpen(true))}
        onOpenExportDialog={() => openDialog(() => setExportDialogOpen(true))}
        onOpenObjectionDialog={() => openDialog(() => setObjectionDialogOpen(true))}
        onOpenDeletionDialog={() => openDialog(() => setDeletionDialogOpen(true))}
        onOpenRestrictionDialog={() => openDialog(() => setRestrictionDialogOpen(true))}
      />

      {statusMessage ? (
        <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
      {errorMessage ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <PrivacyActivityTable
        rows={visibleRows}
        filters={filters}
        onFilterChange={setFilters}
        onDownload={(jobId, format) => window.location.assign(buildMyDataExportDownloadUrl(jobId, format))}
      />

      <PrivacyDialogs
        isSubmitting={isSubmitting}
        accessDialog={{
          open: accessDialogOpen,
          note: accessNote,
          onClose: () => {
            setAccessDialogOpen(false);
            setAccessNote('');
          },
          onNoteChange: setAccessNote,
          onSubmit: () =>
            void submitRequest(
              'access',
              accessNote,
              () => setAccessDialogOpen(false),
              () => setAccessNote(''),
              'account.privacy.messages.accessRequested'
            ),
        }}
        permissionChangeDialog={{
          open: permissionChangeDialogOpen,
          note: permissionChangeNote,
          onClose: () => {
            setPermissionChangeDialogOpen(false);
            setPermissionChangeNote('');
          },
          onNoteChange: setPermissionChangeNote,
          onSubmit: () => void handlePermissionChangeSubmit(),
        }}
        exportDialog={{
          open: exportDialogOpen,
          format: exportFormat,
          onClose: () => setExportDialogOpen(false),
          onFormatChange: setExportFormat,
          onSubmit: () => void handleExportSubmit(),
        }}
        objectionDialog={{
          open: objectionDialogOpen,
          note: objectionNote,
          onClose: () => {
            setObjectionDialogOpen(false);
            setObjectionNote('');
          },
          onNoteChange: setObjectionNote,
          onSubmit: () =>
            void submitRequest(
              'objection',
              objectionNote,
              () => setObjectionDialogOpen(false),
              () => setObjectionNote(''),
              'account.privacy.messages.objectionRequested'
            ),
        }}
        deletionDialog={{
          open: deletionDialogOpen,
          note: deletionNote,
          onClose: () => {
            setDeletionDialogOpen(false);
            setDeletionNote('');
          },
          onNoteChange: setDeletionNote,
          onSubmit: () =>
            void submitRequest(
              'deletion',
              deletionNote,
              () => setDeletionDialogOpen(false),
              () => setDeletionNote(''),
              'account.privacy.messages.deletionRequested'
            ),
        }}
        restrictionDialog={{
          open: restrictionDialogOpen,
          note: restrictionNote,
          onClose: () => {
            setRestrictionDialogOpen(false);
            setRestrictionNote('');
          },
          onNoteChange: setRestrictionNote,
          onSubmit: () =>
            void submitRequest(
              'restriction',
              restrictionNote,
              () => setRestrictionDialogOpen(false),
              () => setRestrictionNote(''),
              'account.privacy.messages.restrictionRequested'
            ),
        }}
      />
    </section>
  );
};
