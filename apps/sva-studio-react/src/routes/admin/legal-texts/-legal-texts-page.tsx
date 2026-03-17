import React from 'react';

import { ModalDialog } from '../../../components/ModalDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { t, type TranslationKey } from '../../../i18n';
import type { CreateLegalTextPayload, IamHttpError, UpdateLegalTextPayload } from '../../../lib/iam-api';

type StatusFilter = 'all' | 'active' | 'inactive';

type CreateFormState = {
  legalTextId: string;
  legalTextVersion: string;
  locale: string;
  contentHash: string;
  publishedAt: string;
  isActive: boolean;
};

type EditFormState = {
  contentHash: string;
  publishedAt: string;
  isActive: boolean;
};

const statusLabelKey = (isActive: boolean): TranslationKey =>
  isActive ? 'admin.legalTexts.status.active' : 'admin.legalTexts.status.inactive';

const emptyCreateForm = (): CreateFormState => ({
  legalTextId: '',
  legalTextVersion: '',
  locale: 'de-DE',
  contentHash: '',
  publishedAt: '',
  isActive: true,
});

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

export const LegalTextsPage = () => {
  const legalTextsApi = useLegalTexts();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editLegalTextVersionId, setEditLegalTextVersionId] = React.useState<string | null>(null);
  const [createForm, setCreateForm] = React.useState<CreateFormState>(emptyCreateForm);
  const [editForm, setEditForm] = React.useState<EditFormState>({
    contentHash: '',
    publishedAt: '',
    isActive: true,
  });

  const filteredLegalTexts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return legalTextsApi.legalTexts.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.legalTextId.toLowerCase().includes(normalizedSearch) ||
        item.legalTextVersion.toLowerCase().includes(normalizedSearch) ||
        item.locale.toLowerCase().includes(normalizedSearch) ||
        item.contentHash.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [legalTextsApi.legalTexts, search, statusFilter]);

  const metrics = React.useMemo(() => {
    const total = legalTextsApi.legalTexts.length;
    const active = legalTextsApi.legalTexts.filter((item) => item.isActive).length;
    const locales = new Set(legalTextsApi.legalTexts.map((item) => item.locale)).size;
    const acceptances = legalTextsApi.legalTexts.reduce((sum, item) => sum + item.activeAcceptanceCount, 0);
    return { total, active, locales, acceptances };
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
      contentHash: item.contentHash,
      publishedAt: toDateTimeInputValue(item.publishedAt),
      isActive: item.isActive,
    });
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: CreateLegalTextPayload = {
      legalTextId: createForm.legalTextId.trim(),
      legalTextVersion: createForm.legalTextVersion.trim(),
      locale: createForm.locale.trim(),
      contentHash: createForm.contentHash.trim(),
      isActive: createForm.isActive,
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
      contentHash: editForm.contentHash.trim(),
      isActive: editForm.isActive,
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

      <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
        <AlertDescription className="space-y-1">
          <p className="font-semibold">{t('admin.legalTexts.info.title')}</p>
          <p>{t('admin.legalTexts.info.body')}</p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.total')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.total}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.active')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.active}</p>
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
            <option value="active">{t('admin.legalTexts.filters.statusActive')}</option>
            <option value="inactive">{t('admin.legalTexts.filters.statusInactive')}</option>
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
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerId')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerVersion')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerLocale')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerStatus')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerHash')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerPublished')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerAcceptances')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerLastAccepted')}</th>
                <th scope="col" className="px-3 py-3 text-right">{t('admin.legalTexts.table.headerActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLegalTexts.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{item.legalTextId}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.legalTextVersion}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.locale}</td>
                  <td className="px-3 py-3">
                    <Badge
                      className={item.isActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}
                      variant="outline"
                    >
                      {t(statusLabelKey(item.isActive))}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.contentHash}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.publishedAt)}</td>
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
              <Label htmlFor="legal-text-create-id">{t('admin.legalTexts.fields.legalTextId')}</Label>
              <Input
                id="legal-text-create-id"
                value={createForm.legalTextId}
                onChange={(event) => setCreateForm((current) => ({ ...current, legalTextId: event.target.value }))}
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
              <Label htmlFor="legal-text-create-published">{t('admin.legalTexts.fields.publishedAt')}</Label>
              <Input
                id="legal-text-create-published"
                type="datetime-local"
                value={createForm.publishedAt}
                onChange={(event) => setCreateForm((current) => ({ ...current, publishedAt: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-text-create-hash">{t('admin.legalTexts.fields.contentHash')}</Label>
            <Input
              id="legal-text-create-hash"
              value={createForm.contentHash}
              onChange={(event) => setCreateForm((current) => ({ ...current, contentHash: event.target.value }))}
              required
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-foreground" htmlFor="legal-text-create-active">
            <Checkbox
              id="legal-text-create-active"
              checked={createForm.isActive}
              onChange={(event) => setCreateForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>{t('admin.legalTexts.fields.isActive')}</span>
          </label>

          <p className="text-xs text-muted-foreground">{t('admin.legalTexts.notes.contentStorage')}</p>

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
                id: selectedLegalText.legalTextId,
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

          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-hash">{t('admin.legalTexts.fields.contentHash')}</Label>
            <Input
              id="legal-text-edit-hash"
              value={editForm.contentHash}
              onChange={(event) => setEditForm((current) => ({ ...current, contentHash: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-published">{t('admin.legalTexts.fields.publishedAt')}</Label>
            <Input
              id="legal-text-edit-published"
              type="datetime-local"
              value={editForm.publishedAt}
              onChange={(event) => setEditForm((current) => ({ ...current, publishedAt: event.target.value }))}
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-foreground" htmlFor="legal-text-edit-active">
            <Checkbox
              id="legal-text-edit-active"
              checked={editForm.isActive}
              onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>{t('admin.legalTexts.fields.isActive')}</span>
          </label>

          <div className="flex justify-end">
            <Button type="submit">{t('admin.legalTexts.actions.save')}</Button>
          </div>
        </form>
      </ModalDialog>
    </section>
  );
};
