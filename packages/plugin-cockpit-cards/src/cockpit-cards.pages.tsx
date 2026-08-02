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
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
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

const panel = (title: string, children: React.ReactNode) => (
  <section className="space-y-4 rounded-2xl border border-border/60 p-5">
    <h2 className="text-base font-semibold">{title}</h2>
    {children}
  </section>
);

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
      <StudioField id="cockpit-card-text" label={pt('fields.text')}>
        <Textarea id="cockpit-card-text" className="min-h-32" {...form.register('text')} />
      </StudioField>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium">{pt('fields.images')}</h3>
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
        </div>
        {mediaError ? (
          <p role="alert" className="text-sm text-destructive">
            {pt('messages.mediaError')}
          </p>
        ) : null}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-3 rounded-xl border p-3">
            <StudioField
              className="flex-1"
              id={`cockpit-card-image-${index}`}
              label={pt('fields.imageUrl')}
            >
              <Input
                id={`cockpit-card-image-${index}`}
                type="url"
                {...form.register(`images.${index}.sourceUrl.url`)}
              />
            </StudioField>
            <div className="flex gap-2">
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
        ))}
        {form.formState.errors.images ? (
          <p role="alert" className="text-sm text-destructive">
            {pt('validation.images')}
          </p>
        ) : null}
      </div>
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
  const save = form.handleSubmit(async (values) => {
    const input = mapCockpitCardFormValuesToGenericItemInput(values, payload);
    if (mode === 'create') {
      const item = await createCockpitCard(input);
      await navigate({ to: '/admin/cockpit-cards/$id', params: { id: item.id } });
    } else if (contentId) await updateCockpitCard(contentId, input);
  });
  const tabs: readonly Tab[] =
    mode === 'edit'
      ? ['basis', 'content', 'settings', 'history']
      : ['basis', 'content', 'settings'];
  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' && contentId ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void deleteCockpitCard(contentId).then(() => navigate({ to: '/admin/content' }))
              }
            >
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={
        <Button type="button" onClick={() => void save()}>
          {pt('actions.save')}
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList aria-label={pt('tabs.ariaLabel')}>
          {tabs.map((item) => (
            <TabsTrigger key={item} value={item}>
              {pt(`tabs.${item}.label`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="basis" forceMount className="data-[state=inactive]:hidden">
          {panel(
            pt('tabs.basis.title'),
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
          )}
        </TabsContent>
        <TabsContent value="content" forceMount className="data-[state=inactive]:hidden">
          {panel(pt('tabs.content.title'), <ContentFields form={form} pt={pt} />)}
        </TabsContent>
        <TabsContent value="settings" forceMount className="data-[state=inactive]:hidden">
          {panel(
            pt('tabs.settings.title'),
            <div className="space-y-4">
              <StudioField id="cockpit-card-link" label={pt('fields.link')}>
                <Input id="cockpit-card-link" type="url" {...form.register('link')} />
              </StudioField>
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
          )}
        </TabsContent>
        {mode === 'edit' && contentId ? (
          <TabsContent value="history">
            {panel(pt('tabs.history.title'), <History contentId={contentId} />)}
          </TabsContent>
        ) : null}
      </Tabs>
    </StudioDetailPageTemplate>
  );
}

function History({ contentId }: Readonly<{ contentId: string }>) {
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
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full" aria-label={pt('history.label')}>
        <thead>
          <tr>
            <th>{pt('history.time')}</th>
            <th>{pt('history.action')}</th>
            <th>{pt('history.actor')}</th>
            <th>{pt('history.summary')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t">
              <td>{formatDateTimeInEditorTimeZone(entry.createdAt) ?? entry.createdAt}</td>
              <td>{entry.action}</td>
              <td>{entry.actor}</td>
              <td>{entry.summary || entry.changedFields.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CockpitCardsListPage() {
  const pt = usePluginTranslation('cockpit-cards');
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page ?? 1) : 1;
  const pageSize = search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25;
  const [items, setItems] = React.useState<readonly Awaited<ReturnType<typeof getCockpitCard>>[]>(
    []
  );
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  React.useEffect(() => {
    let active = true;
    void listCockpitCards({ page, pageSize }).then(
      (result) => {
        if (active) {
          setItems(result.data);
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
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const CockpitCardsCreatePage = () => <Editor mode="create" />;
export const CockpitCardsEditPage = () => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return <Editor mode="edit" contentId={params.contentId ?? params.id} />;
};
