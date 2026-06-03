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

const RequestDialog = ({
  description,
  isSubmitting,
  noteInputId,
  noteState,
  submitLabel,
  title,
}: Readonly<{
  description: string;
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
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={noteState.onClose}>
          {t('account.privacy.dialogs.shared.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  </ModalDialog>
);

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

    <RequestDialog
      title={t('account.privacy.dialogs.access.title')}
      description={t('account.privacy.dialogs.access.description')}
      isSubmitting={isSubmitting}
      noteInputId="privacy-access-request-note"
      noteState={accessDialog}
      submitLabel={t('account.privacy.dialogs.access.submit')}
    />
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
