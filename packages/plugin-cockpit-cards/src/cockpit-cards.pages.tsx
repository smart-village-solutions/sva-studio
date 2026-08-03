import { zodResolver } from '@hookform/resolvers/zod';
import { flattenCategoriesForTable, listCategories } from '@sva/plugin-categories';
import {
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
  listHostMediaAssets,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetListItem,
  type IamContentHistoryEntry,
} from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  Select,
  StudioDataTable,
  StudioConfirmDialog,
  StudioDetailCard,
  StudioDetailTabs,
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
  Textarea,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import {
  createCockpitCard,
  deleteCockpitCard,
  getCockpitCard,
  listCockpitCards,
  updateCockpitCard,
} from './cockpit-cards.api.js';
import {
  cockpitCardFormSchema,
  mapCockpitCardFormValuesToGenericItemInput,
  mapGenericItemToCockpitCardFormValues,
  readCockpitCardPayload,
} from './cockpit-cards.model.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';

const defaults: CockpitCardFormValues = {
  heading: '',
  text: '',
  languageCode: 'de',
  sortWeight: 0,
  category: '',
  images: [],
  link: '',
  visible: true,
};
type Tab = 'basis' | 'content' | 'settings' | 'history';

function useCategories() {
  const [options, setOptions] = React.useState<readonly { id: string; name: string }[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  React.useEffect(() => {
    let active = true;
    void listCategories().then(
      (items) => {
        if (active) {
          setOptions(flattenCategoriesForTable(items).map(({ id, name }) => ({ id, name })));
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, []);
  return { options, state };
}

function ContentFields({
  form,
  pt,
}: Readonly<{
  form: ReturnType<typeof useForm<CockpitCardFormValues>>;
  pt: (key: string) => string;
}>) {
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'images' });
  const [assets, setAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [mediaError, setMediaError] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void listHostMediaAssets({
      fetch: globalThis.fetch.bind(globalThis),
      visibility: 'public',
    }).then(
      (items) =>
        active &&
        setAssets(items.filter((item) => item.mimeType?.startsWith('image/') && item.previewUrl)),
      () => active && setMediaError(true)
    );
    return () => {
      active = false;
    };
  }, []);
  const appendUrl = (url: string | null | undefined) => {
    if (url && !form.getValues('images').some((image) => image.sourceUrl.url === url))
      append({ sourceUrl: { url }, contentType: 'image' });
  };
  return (
    <div className="space-y-5">
      <StudioDetailCard title={pt('fields.text')}>
        <StudioField id="cockpit-card-text" label={pt('fields.text')}>
          <Textarea id="cockpit-card-text" className="min-h-32" {...form.register('text')} />
        </StudioField>
      </StudioDetailCard>
      <StudioDetailCard
        title={pt('fields.images')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label={pt('actions.selectImage')}
              defaultValue=""
              onChange={(event) => {
                appendUrl(event.currentTarget.value);
                event.currentTarget.value = '';
              }}
            >
              <option value="">{pt('actions.selectImage')}</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.previewUrl ?? ''}>
                  {asset.fileName ?? asset.id}
                </option>
              ))}
            </Select>
            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium">
              <span>{uploading ? pt('actions.uploadingImage') : pt('actions.uploadImage')}</span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  void uploadHostMediaFile({
                    fetch: globalThis.fetch.bind(globalThis),
                    file,
                    visibility: 'public',
                    mediaType: 'image',
                  })
                    .then(
                      (result) => appendUrl(result.previewUrl),
                      () => setMediaError(true)
                    )
                    .finally(() => setUploading(false));
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ sourceUrl: { url: '' }, contentType: 'image' })}
            >
              {pt('actions.addImage')}
            </Button>
          </div>
        }
      >
        {mediaError ? (
          <p role="alert" className="text-sm text-destructive">
            {pt('messages.mediaError')}
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {fields.map((field, index) => {
            const imageUrl = form.watch(`images.${index}.sourceUrl.url`);
            return (
              <article
                key={field.id}
                className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
              >
                <div className="aspect-video bg-muted">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                      {pt('messages.imagePreviewEmpty')}
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <StudioField id={`cockpit-card-image-${index}`} label={pt('fields.imageUrl')}>
                    <Input
                      id={`cockpit-card-image-${index}`}
                      type="url"
                      {...form.register(`images.${index}.sourceUrl.url`)}
                    />
                  </StudioField>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      {pt('actions.moveImageUp')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      {pt('actions.moveImageDown')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => remove(index)}>
                      {pt('actions.removeImage')}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {form.formState.errors.images ? (
          <p role="alert" className="text-sm text-destructive">
            {pt('validation.images')}
          </p>
        ) : null}
      </StudioDetailCard>
    </div>
  );
}

function Editor({ mode, contentId }: Readonly<{ mode: 'create' | 'edit'; contentId?: string }>) {
  const pt = usePluginTranslation('cockpit-cards');
  const navigate = useNavigate();
  const form = useForm<CockpitCardFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(cockpitCardFormSchema),
  });
  const [tab, setTab] = React.useState<Tab>('basis');
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [error, setError] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [payload, setPayload] = React.useState<unknown>();
  const { options, state: categoriesState } = useCategories();
  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    void getCockpitCard(contentId)
      .then(
        (item) => {
          if (active) {
            form.reset(mapGenericItemToCockpitCardFormValues(item));
            setPayload(item.payload);
          }
        },
        () => active && setError(true)
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [contentId, form, mode]);
  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (error) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  const save = form.handleSubmit(
    async (values) => {
      setMutationError(null);
      try {
        const input = mapCockpitCardFormValuesToGenericItemInput(values, payload);
        if (mode === 'create') {
          const item = await createCockpitCard(input);
          await navigate({ to: '/admin/cockpit-cards/$id', params: { id: item.id } });
        } else if (contentId) await updateCockpitCard(contentId, input);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : '';
        setMutationError(
          reason
            ? pt('messages.saveErrorWithReason').replace('{{reason}}', reason)
            : pt('messages.saveError')
        );
      }
    },
    (errors) => {
      setMutationError(pt('messages.validationError'));
      if (errors.text || errors.images) setTab('content');
      else if (errors.link || errors.sortWeight) setTab('settings');
      else setTab('basis');
    }
  );
  const summaryErrors = [
    form.formState.errors.heading
      ? { field: 'cockpit-card-heading', message: pt('validation.required') }
      : null,
    form.formState.errors.languageCode
      ? { field: 'cockpit-card-language', message: pt('validation.languageCode') }
      : null,
    form.formState.errors.category
      ? { field: 'cockpit-card-category', message: pt('validation.required') }
      : null,
    form.formState.errors.text
      ? { field: 'cockpit-card-text', message: pt('validation.required') }
      : null,
    form.formState.errors.images
      ? { field: 'cockpit-card-image-0', message: pt('validation.images') }
      : null,
    form.formState.errors.link
      ? { field: 'cockpit-card-link', message: pt('validation.link') }
      : null,
    form.formState.errors.sortWeight
      ? { field: 'cockpit-card-weight', message: pt('validation.sortWeight') }
      : null,
  ].filter((entry): entry is { field: string; message: string } => entry !== null);
  const formId = `cockpit-card-${mode}-form`;
  const tabs: readonly StudioDetailTabDefinition<Tab>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      icon: 'basis',
      panel: (
        <div className="space-y-4">
          <StudioField id="cockpit-card-heading" label={pt('fields.heading')}>
            <Input id="cockpit-card-heading" {...form.register('heading')} />
          </StudioField>
          <StudioField id="cockpit-card-language" label={pt('fields.languageCode')}>
            <Input id="cockpit-card-language" {...form.register('languageCode')} />
          </StudioField>
          <StudioField id="cockpit-card-category" label={pt('fields.category')}>
            <Select
              id="cockpit-card-category"
              disabled={categoriesState === 'loading'}
              {...form.register('category')}
            >
              <option value="">
                {categoriesState === 'loading' ? pt('messages.categoriesLoading') : ''}
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </Select>
            {categoriesState === 'error' ? (
              <p role="alert" className="text-sm text-destructive">
                {pt('messages.categoriesError')}
              </p>
            ) : null}
          </StudioField>
        </div>
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      icon: 'content',
      panel: <ContentFields form={form} pt={pt} />,
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      icon: 'settings',
      panel: (
        <div className="space-y-4">
          <StudioDetailCard title={pt('fields.link')}>
            <StudioField id="cockpit-card-link" label={pt('fields.link')}>
              <Input id="cockpit-card-link" type="url" {...form.register('link')} />
            </StudioField>
          </StudioDetailCard>
          <StudioField id="cockpit-card-publication" label={pt('fields.publicationDate')}>
            <Input id="cockpit-card-publication" {...form.register('publicationDate')} />
          </StudioField>
          <StudioField id="cockpit-card-weight" label={pt('fields.sortWeight')}>
            <Input
              id="cockpit-card-weight"
              type="number"
              {...form.register('sortWeight', { valueAsNumber: true })}
            />
          </StudioField>
          <StudioField id="cockpit-card-visible" label={pt('fields.visible')}>
            <Controller
              control={form.control}
              name="visible"
              render={({ field }) => (
                <Checkbox
                  id="cockpit-card-visible"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          </StudioField>
        </div>
      ),
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      icon: 'history',
      isVisible: mode === 'edit' && Boolean(contentId),
      panel: contentId ? <CockpitCardsHistory contentId={contentId} /> : null,
    },
  ];
  const deleteCard = async () => {
    if (!contentId) return;
    setMutationError(null);
    setDeletePending(true);
    try {
      await deleteCockpitCard(contentId);
      await navigate({ to: '/admin/content' });
      setDeleteDialogOpen(false);
    } catch {
      setMutationError(pt('messages.deleteError'));
    } finally {
      setDeletePending(false);
    }
  };
  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      description={pt(mode === 'create' ? 'editor.createDescription' : 'editor.editDescription')}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' && contentId ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending || form.formState.isSubmitting}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={
        <Button type="submit" form={formId} disabled={form.formState.isSubmitting || deletePending}>
          {pt(mode === 'create' ? 'actions.create' : 'actions.update')}
        </Button>
      }
    >
      <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
        {mutationError ? (
          <p role="alert" className="text-sm text-destructive">
            {mutationError}
          </p>
        ) : null}
        <StudioFormSummaryErrors
          errors={summaryErrors}
          title={pt('validation.summaryTitle')}
          onSelectError={({ field }) => {
            if (field.includes('text') || field.includes('image')) setTab('content');
            else if (field.includes('link') || field.includes('weight')) setTab('settings');
            else setTab('basis');
          }}
        />
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.mobileLabel')}
          tabs={tabs}
          value={tab}
          onValueChange={setTab}
          keepMounted
        />
      </form>
      <StudioConfirmDialog
        open={deleteDialogOpen}
        title={pt('deleteDialog.title')}
        description={pt('deleteDialog.description')}
        confirmLabel={pt('deleteDialog.confirm')}
        cancelLabel={pt('deleteDialog.cancel')}
        confirmDisabled={deletePending}
        cancelDisabled={deletePending}
        onConfirm={() => void deleteCard()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </StudioDetailPageTemplate>
  );
}

export function CockpitCardsHistory({ contentId }: Readonly<{ contentId: string }>) {
  const pt = usePluginTranslation('cockpit-cards');
  const [entries, setEntries] = React.useState<readonly IamContentHistoryEntry[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  React.useEffect(() => {
    let active = true;
    void fetchIamContentHistory(contentId).then(
      (nextEntries) => {
        if (active) {
          setEntries(
            [...nextEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          );
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [contentId]);
  if (state === 'loading') return <StudioLoadingState>{pt('history.loading')}</StudioLoadingState>;
  if (state === 'error')
    return (
      <p role="alert" className="text-sm text-destructive">
        {pt('history.error')}
      </p>
    );
  if (!entries.length)
    return <p className="text-sm text-muted-foreground">{pt('history.empty')}</p>;
  const formatAction = (action: string) => {
    if (action === 'created' || action === 'create') return pt('history.actions.created');
    if (action === 'updated' || action === 'update') return pt('history.actions.updated');
    if (action === 'status_changed' || action === 'statusChanged')
      return pt('history.actions.statusChanged');
    return action;
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm" aria-label={pt('history.label')}>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th>{pt('history.time')}</th>
              <th>{pt('history.action')}</th>
              <th>{pt('history.actor')}</th>
              <th>{pt('history.summary')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  {formatDateTimeInEditorTimeZone(entry.createdAt) ?? entry.createdAt}
                </td>
                <td className="px-3 py-3">{formatAction(entry.action)}</td>
                <td className="px-3 py-3">{entry.actor}</td>
                <td className="px-3 py-3">{entry.summary || entry.changedFields.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CockpitCardsListPage() {
  const pt = usePluginTranslation('cockpit-cards');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page ?? 1) : 1;
  const pageSize = search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25;
  const [items, setItems] = React.useState<readonly Awaited<ReturnType<typeof getCockpitCard>>[]>(
    []
  );
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [hasNextPage, setHasNextPage] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void listCockpitCards({ page, pageSize }).then(
      (result) => {
        if (active) {
          setItems(result.data);
          setHasNextPage(result.pagination.hasNextPage);
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [page, pageSize]);
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/cockpit-cards/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : null}
      {state === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {state === 'ready' && items.length === 0 ? (
        <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
      ) : null}
      {state === 'ready' && items.length ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            data={items}
            columns={[
              { id: 'heading', header: pt('fields.heading'), cell: (item) => item.title },
              {
                id: 'language',
                header: pt('fields.languageCode'),
                cell: (item) => readCockpitCardPayload(item.payload).languageCode,
              },
            ]}
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/cockpit-cards/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            getRowId={(item) => item.id}
            selectionMode="none"
            emptyState={null}
            labels={{
              selectionColumn: pt('fields.heading'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
          />
          <StudioPagination
            page={page}
            hasNextPage={hasNextPage}
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel').replace('{{page}}', String(page))}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={(nextPage) =>
              void navigate({
                to: '/admin/cockpit-cards',
                search: (current: Record<string, unknown>) => ({
                  ...current,
                  page: nextPage,
                  pageSize,
                }),
              })
            }
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const CockpitCardsCreatePage = () => <Editor mode="create" />;
export const CockpitCardsEditPage = () => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return <Editor mode="edit" contentId={params.contentId ?? params.id} />;
};
