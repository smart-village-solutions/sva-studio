import React from 'react';

import { ModalDialog } from '../../../components/ModalDialog';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { t, type TranslationKey } from '../../../i18n';
import type { CreateLegalTextPayload, IamHttpError, UpdateLegalTextPayload } from '../../../lib/iam-api';

type StatusFilter = 'all' | 'draft' | 'valid' | 'archived';
type LegalTextStatus = 'draft' | 'valid' | 'archived';

type CreateFormState = {
  name: string;
  legalTextVersion: string;
  locale: string;
  contentHtml: string;
  status: LegalTextStatus;
  publishedAt: string;
};

type EditFormState = {
  name: string;
  legalTextVersion: string;
  locale: string;
  contentHtml: string;
  status: LegalTextStatus;
  publishedAt: string;
};

const statusLabelKeyByValue: Record<LegalTextStatus, TranslationKey> = {
  draft: 'admin.legalTexts.status.draft',
  valid: 'admin.legalTexts.status.valid',
  archived: 'admin.legalTexts.status.archived',
};

const richTextEditorCommands = {
  bold: t('admin.legalTexts.editor.bold'),
  italic: t('admin.legalTexts.editor.italic'),
  underline: t('admin.legalTexts.editor.underline'),
  paragraph: t('admin.legalTexts.editor.paragraph'),
  heading: t('admin.legalTexts.editor.heading'),
  bulletList: t('admin.legalTexts.editor.bulletList'),
  clearFormatting: t('admin.legalTexts.editor.clearFormatting'),
} as const;

const createEmptyLegalTextFormState = (): CreateFormState => ({
  name: '',
  legalTextVersion: '',
  locale: 'de-DE',
  contentHtml: '<p></p>',
  status: 'draft',
  publishedAt: '',
});

const emptyCreateForm = (): CreateFormState => createEmptyLegalTextFormState();

const emptyEditForm = (): EditFormState => createEmptyLegalTextFormState();

const legalTextErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.legalTexts.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.legalTexts.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.legalTexts.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.legalTexts.errors.rateLimited');
    case 'conflict':
      return t('admin.legalTexts.errors.conflict');
    case 'not_found':
      return t('admin.legalTexts.errors.notFound');
    case 'database_unavailable':
      return t('admin.legalTexts.errors.databaseUnavailable');
    case 'invalid_request':
      return error.message && error.message !== `http_${error.status}`
        ? error.message
        : t('admin.legalTexts.errors.invalidRequest');
    default:
      return t('admin.legalTexts.messages.error');
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('admin.legalTexts.table.publishedUnset');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const toDateTimeInputValue = (value?: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (entry: number) => String(entry).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoDateTime = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const collapseWhitespace = (value: string): string => {
  let result = '';
  let previousWasWhitespace = true;

  for (const character of value) {
    if (/\s/.test(character)) {
      if (!previousWasWhitespace) {
        result += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }

    result += character;
    previousWasWhitespace = false;
  }

  return result.trim();
};

const stripHtml = (value: string): string => {
  let result = '';
  let insideTag = false;

  for (const character of value) {
    if (character === '<') {
      insideTag = true;
      result += ' ';
      continue;
    }

    if (character === '>') {
      insideTag = false;
      result += ' ';
      continue;
    }

    if (!insideTag) {
      result += character;
    }
  }

  return collapseWhitespace(result);
};

const summarizeHtml = (value: string): string => {
  const plainText = stripHtml(value);
  if (plainText.length <= 120) {
    return plainText || '—';
  }
  return `${plainText.slice(0, 117)}...`;
};

export const LegalTextsPage = () => {
  const legalTextsApi = useLegalTexts();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editLegalTextVersionId, setEditLegalTextVersionId] = React.useState<string | null>(null);
  const [createForm, setCreateForm] = React.useState<CreateFormState>(emptyCreateForm);
  const [editForm, setEditForm] = React.useState<EditFormState>(emptyEditForm);

  const filteredLegalTexts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return legalTextsApi.legalTexts.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.id.toLowerCase().includes(normalizedSearch) ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.legalTextVersion.toLowerCase().includes(normalizedSearch) ||
        item.locale.toLowerCase().includes(normalizedSearch) ||
        stripHtml(item.contentHtml).toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [legalTextsApi.legalTexts, search, statusFilter]);

  const metrics = React.useMemo(() => {
    const total = legalTextsApi.legalTexts.length;
    const valid = legalTextsApi.legalTexts.filter((item) => item.status === 'valid').length;
    const locales = new Set(legalTextsApi.legalTexts.map((item) => item.locale)).size;
    const acceptances = legalTextsApi.legalTexts.reduce((sum, item) => sum + item.activeAcceptanceCount, 0);
    return { total, valid, locales, acceptances };
  }, [legalTextsApi.legalTexts]);

  const selectedLegalText =
    editLegalTextVersionId !== null
      ? legalTextsApi.legalTexts.find((entry) => entry.id === editLegalTextVersionId) ?? null
      : null;

  const openCreateDialog = () => {
    legalTextsApi.clearMutationError();
    setCreateForm(emptyCreateForm());
    setCreateDialogOpen(true);
  };

  const openEditDialog = (legalTextVersionId: string) => {
    const item = legalTextsApi.legalTexts.find((entry) => entry.id === legalTextVersionId);
    if (!item) {
      return;
    }

    legalTextsApi.clearMutationError();
    setEditLegalTextVersionId(legalTextVersionId);
    setEditForm({
      name: item.name,
      legalTextVersion: item.legalTextVersion,
      locale: item.locale,
      contentHtml: item.contentHtml,
      status: item.status,
      publishedAt: toDateTimeInputValue(item.publishedAt),
    });
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: CreateLegalTextPayload = {
      name: createForm.name.trim(),
      legalTextVersion: createForm.legalTextVersion.trim(),
      locale: createForm.locale.trim(),
      contentHtml: createForm.contentHtml.trim(),
      status: createForm.status,
      publishedAt: toIsoDateTime(createForm.publishedAt),
    };

    const success = await legalTextsApi.createLegalText(payload);
    if (!success) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateForm(emptyCreateForm());
  };

  const submitEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editLegalTextVersionId) {
      return;
    }

    const payload: UpdateLegalTextPayload = {
      name: editForm.name.trim(),
      legalTextVersion: editForm.legalTextVersion.trim(),
      locale: editForm.locale.trim(),
      contentHtml: editForm.contentHtml.trim(),
      status: editForm.status,
      publishedAt: toIsoDateTime(editForm.publishedAt),
    };

    const success = await legalTextsApi.updateLegalText(editLegalTextVersionId, payload);
    if (!success) {
      return;
    }

    setEditLegalTextVersionId(null);
  };

  return (
    <section className="space-y-5" aria-busy={legalTextsApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.legalTexts.page.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.legalTexts.page.subtitle')}</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.total')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.total}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.valid')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.valid}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.locales')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.locales}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.acceptances')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.acceptances}</p>
        </Card>
      </div>

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_14rem_auto]">
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="legal-texts-search">{t('admin.legalTexts.filters.searchLabel')}</Label>
          <Input
            id="legal-texts-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.legalTexts.filters.searchPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="legal-texts-status">{t('admin.legalTexts.filters.statusLabel')}</Label>
          <Select
            id="legal-texts-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">{t('admin.legalTexts.filters.statusAll')}</option>
            <option value="draft">{t('admin.legalTexts.filters.statusDraft')}</option>
            <option value="valid">{t('admin.legalTexts.filters.statusValid')}</option>
            <option value="archived">{t('admin.legalTexts.filters.statusArchived')}</option>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button type="button" onClick={openCreateDialog}>
            {t('admin.legalTexts.actions.create')}
          </Button>
        </div>
      </Card>

      {legalTextsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{legalTextErrorMessage(legalTextsApi.error)}</span>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void legalTextsApi.refetch()}>
                {t('admin.legalTexts.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {filteredLegalTexts.length === 0 ? (
        <Card className="space-y-3 p-6">
          <h2 className="text-xl font-semibold text-foreground">{t('admin.legalTexts.empty.title')}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.legalTexts.empty.body')}</p>
          <div>
            <Button type="button" onClick={openCreateDialog}>
              {t('admin.legalTexts.actions.create')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-shell">
          <table className="min-w-full border-collapse" aria-label={t('admin.legalTexts.table.ariaLabel')}>
            <caption className="sr-only">{t('admin.legalTexts.table.caption')}</caption>
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerUuid')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerName')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerVersion')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerLocale')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerStatus')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerContent')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerPublished')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerCreated')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerUpdated')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerAcceptances')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerLastAccepted')}</th>
                <th scope="col" className="px-3 py-3 text-right">{t('admin.legalTexts.table.headerActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLegalTexts.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-3 py-3 text-xs text-muted-foreground">{item.id}</td>
                  <td className="px-3 py-3 text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.legalTextVersion}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.locale}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">{t(statusLabelKeyByValue[item.status])}</Badge>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-sm text-foreground">{summarizeHtml(item.contentHtml)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.publishedAt)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.createdAt)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">
                    {t('admin.legalTexts.table.acceptanceSummary', {
                      active: String(item.activeAcceptanceCount),
                      total: String(item.acceptanceCount),
                    })}
                  </td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.lastAcceptedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(item.id)}>
                      {t('admin.legalTexts.actions.edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog
        title={t('admin.legalTexts.dialogs.createTitle')}
        description={t('admin.legalTexts.dialogs.createDescription')}
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          legalTextsApi.clearMutationError();
        }}
      >
        <form className="space-y-4" onSubmit={(event) => void submitCreate(event)}>
          {legalTextsApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{legalTextErrorMessage(legalTextsApi.mutationError)}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-name">{t('admin.legalTexts.fields.name')}</Label>
              <Input
                id="legal-text-create-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-version">{t('admin.legalTexts.fields.legalTextVersion')}</Label>
              <Input
                id="legal-text-create-version"
                value={createForm.legalTextVersion}
                onChange={(event) => setCreateForm((current) => ({ ...current, legalTextVersion: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-locale">{t('admin.legalTexts.fields.locale')}</Label>
              <Input
                id="legal-text-create-locale"
                value={createForm.locale}
                onChange={(event) => setCreateForm((current) => ({ ...current, locale: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-create-status">{t('admin.legalTexts.fields.status')}</Label>
              <Select
                id="legal-text-create-status"
                value={createForm.status}
                onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as LegalTextStatus }))}
              >
                <option value="draft">{t('admin.legalTexts.status.draft')}</option>
                <option value="valid">{t('admin.legalTexts.status.valid')}</option>
                <option value="archived">{t('admin.legalTexts.status.archived')}</option>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="legal-text-create-published">{t('admin.legalTexts.fields.publishedAt')}</Label>
              <Input
                id="legal-text-create-published"
                type="datetime-local"
                value={createForm.publishedAt}
                required={createForm.status === 'valid'}
                onChange={(event) => setCreateForm((current) => ({ ...current, publishedAt: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label id="legal-text-create-content-label" htmlFor="legal-text-create-content">
              {t('admin.legalTexts.fields.contentHtml')}
            </Label>
            <RichTextEditor
              id="legal-text-create-content"
              labelId="legal-text-create-content-label"
              value={createForm.contentHtml}
              onChange={(contentHtml) => setCreateForm((current) => ({ ...current, contentHtml }))}
              placeholder={t('admin.legalTexts.fields.contentPlaceholder')}
              commands={richTextEditorCommands}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">{t('admin.legalTexts.actions.create')}</Button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        title={t('admin.legalTexts.dialogs.editTitle')}
        description={
          selectedLegalText
            ? t('admin.legalTexts.dialogs.editDescription', {
                id: selectedLegalText.id,
                version: selectedLegalText.legalTextVersion,
                locale: selectedLegalText.locale,
              })
            : t('admin.legalTexts.dialogs.editDescriptionFallback')
        }
        open={editLegalTextVersionId !== null}
        onClose={() => {
          setEditLegalTextVersionId(null);
          legalTextsApi.clearMutationError();
        }}
      >
        <form className="space-y-4" onSubmit={(event) => void submitEdit(event)}>
          {legalTextsApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{legalTextErrorMessage(legalTextsApi.mutationError)}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal-text-edit-name">{t('admin.legalTexts.fields.name')}</Label>
              <Input
                id="legal-text-edit-name"
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-edit-version">{t('admin.legalTexts.fields.legalTextVersion')}</Label>
              <Input
                id="legal-text-edit-version"
                value={editForm.legalTextVersion}
                onChange={(event) => setEditForm((current) => ({ ...current, legalTextVersion: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-edit-locale">{t('admin.legalTexts.fields.locale')}</Label>
              <Input
                id="legal-text-edit-locale"
                value={editForm.locale}
                onChange={(event) => setEditForm((current) => ({ ...current, locale: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-text-edit-status">{t('admin.legalTexts.fields.status')}</Label>
              <Select
                id="legal-text-edit-status"
                value={editForm.status}
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as LegalTextStatus }))}
              >
                <option value="draft">{t('admin.legalTexts.status.draft')}</option>
                <option value="valid">{t('admin.legalTexts.status.valid')}</option>
                <option value="archived">{t('admin.legalTexts.status.archived')}</option>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="legal-text-edit-published">{t('admin.legalTexts.fields.publishedAt')}</Label>
              <Input
                id="legal-text-edit-published"
                type="datetime-local"
                value={editForm.publishedAt}
                required={editForm.status === 'valid'}
                onChange={(event) => setEditForm((current) => ({ ...current, publishedAt: event.target.value }))}
              />
            </div>
          </div>

          {selectedLegalText ? (
            <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <p>{t('admin.legalTexts.meta.uuid', { value: selectedLegalText.id })}</p>
              <p>{t('admin.legalTexts.meta.createdAt', { value: formatDateTime(selectedLegalText.createdAt) })}</p>
              <p>{t('admin.legalTexts.meta.updatedAt', { value: formatDateTime(selectedLegalText.updatedAt) })}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label id="legal-text-edit-content-label" htmlFor="legal-text-edit-content">
              {t('admin.legalTexts.fields.contentHtml')}
            </Label>
            <RichTextEditor
              id="legal-text-edit-content"
              labelId="legal-text-edit-content-label"
              value={editForm.contentHtml}
              onChange={(contentHtml) => setEditForm((current) => ({ ...current, contentHtml }))}
              placeholder={t('admin.legalTexts.fields.contentPlaceholder')}
              commands={richTextEditorCommands}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">{t('admin.legalTexts.actions.save')}</Button>
          </div>
        </form>
      </ModalDialog>
    </section>
  );
};
