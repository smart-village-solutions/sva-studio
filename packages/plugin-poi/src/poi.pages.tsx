import React from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  findHostMediaReferenceAssetId,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  replaceHostMediaReferences,
  toHostMediaFieldOptions,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  MediaReferenceField,
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFieldGroup,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioDataTable,
  Textarea,
} from '@sva/studio-ui-react';

import { createPoi, deletePoi, getPoi, listPoi, PoiApiError, updatePoi } from './poi.api.js';
import { normalizeListSearch } from './list-pagination.js';
import { pluginPoiMediaPickers } from './plugin.js';
import type { PoiContentItem, PoiFormInput, PoiListResult } from './poi.types.js';
import { validatePoiForm } from './poi.validation.js';

type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

const defaultForm = (): PoiFormInput => ({
  name: '',
  description: '',
  mobileDescription: '',
  active: true,
  categoryName: '',
  addresses: [{ street: '', zip: '', city: '' }],
  contact: { firstName: '', lastName: '', phone: '', email: '' },
  openingHours: [{ weekday: '', timeFrom: '', timeTo: '', open: true, description: '' }],
  webUrls: [{ url: '', description: '' }],
  tags: [],
  payload: {},
});

const compactString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const itemToForm = (item: PoiContentItem): PoiFormInput => ({
  ...defaultForm(),
  name: item.name,
  description: item.description ?? '',
  mobileDescription: item.mobileDescription ?? '',
  active: item.active ?? true,
  categoryName: item.categoryName ?? '',
  addresses: item.addresses && item.addresses.length > 0 ? item.addresses : defaultForm().addresses,
  contact: item.contact ?? defaultForm().contact,
  openingHours: item.openingHours && item.openingHours.length > 0 ? item.openingHours : defaultForm().openingHours,
  webUrls: item.webUrls && item.webUrls.length > 0 ? item.webUrls : defaultForm().webUrls,
  tags: item.tags ?? [],
  payload: item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) ? item.payload : {},
});

const compactForm = (form: PoiFormInput): PoiFormInput => ({
  name: form.name.trim(),
  ...(compactString(form.description) ? { description: compactString(form.description) } : {}),
  ...(compactString(form.mobileDescription) ? { mobileDescription: compactString(form.mobileDescription) } : {}),
  active: form.active !== false,
  ...(compactString(form.categoryName) ? { categoryName: compactString(form.categoryName) } : {}),
  addresses: (form.addresses ?? [])
    .map((address) => ({
      ...(compactString(address.street) ? { street: compactString(address.street) } : {}),
      ...(compactString(address.zip) ? { zip: compactString(address.zip) } : {}),
      ...(compactString(address.city) ? { city: compactString(address.city) } : {}),
    }))
    .filter((address) => Object.keys(address).length > 0),
  ...(form.contact &&
  (compactString(form.contact.firstName) ||
    compactString(form.contact.lastName) ||
    compactString(form.contact.phone) ||
    compactString(form.contact.email))
    ? { contact: form.contact }
    : {}),
  openingHours: (form.openingHours ?? [])
    .map((entry) => ({
      ...(compactString(entry.weekday) ? { weekday: compactString(entry.weekday) } : {}),
      ...(compactString(entry.timeFrom) ? { timeFrom: compactString(entry.timeFrom) } : {}),
      ...(compactString(entry.timeTo) ? { timeTo: compactString(entry.timeTo) } : {}),
      ...(entry.open !== undefined ? { open: entry.open } : {}),
      ...(compactString(entry.description) ? { description: compactString(entry.description) } : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0),
  webUrls: (form.webUrls ?? [])
    .map((url) => ({
      ...(compactString(url.url) ? { url: compactString(url.url) as string } : {}),
      ...(compactString(url.description) ? { description: compactString(url.description) } : {}),
    }))
    .filter((url): url is { url: string; description?: string } => Boolean(url.url)),
  tags: (form.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  ...(form.payload && Object.keys(form.payload).length > 0 ? { payload: form.payload } : {}),
});

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) =>
  error instanceof PoiApiError ? error.message : pt(fallbackKey);

type ListSearchState = Record<string, unknown>;

type ListPaginationState = Readonly<{
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}>;

type ListPaginationNavProps = Readonly<{
  ariaLabel: string;
  pageLabel: string;
  previousLabel: string;
  nextLabel: string;
  pagination: ListPaginationState;
  onPageChange: (page: number) => void;
}>;

const updateListSearchPage = (
  current: ListSearchState,
  page: number,
  pageSize: number
): ListSearchState => ({
  ...current,
  page,
  pageSize,
});

const PoiListEditAction = ({ id, label }: Readonly<{ id: string; label: string }>) => (
  <Button asChild variant="outline" size="sm">
    <Link to="/admin/poi/$id" params={{ id }}>
      {label}
    </Link>
  </Button>
);

const PoiPaginationNav = ({
  ariaLabel,
  pageLabel,
  previousLabel,
  nextLabel,
  pagination,
  onPageChange,
}: ListPaginationNavProps) => (
  <nav aria-label={ariaLabel} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
    <p key={pagination.page} aria-live="polite" className="animate-pagination-active">
      {pageLabel}
    </p>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
      >
        {previousLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!pagination.hasNextPage}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        {nextLabel}
      </Button>
    </div>
  </nav>
);

const createPoiListColumns = (pt: ReturnType<typeof usePluginTranslation>) => [
  { id: 'name', header: pt('fields.name'), cell: (item: PoiContentItem) => item.name },
  { id: 'categoryName', header: pt('fields.categoryName'), cell: (item: PoiContentItem) => item.categoryName ?? '—' },
  { id: 'active', header: pt('fields.active'), cell: (item: PoiContentItem) => (item.active === false ? '—' : '✓') },
];

export function PoiListPage() {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const editLabel = pt('actions.edit');
  const [result, setResult] = React.useState<PoiListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      Promise.resolve(
        navigate({
          to: '/admin/poi',
          search: (current: ListSearchState) => updateListSearchPage(current, nextPage, result.pagination.pageSize),
        })
      ).catch(() => undefined);
    },
    [navigate, result.pagination.pageSize]
  );

  React.useEffect(() => {
    if (search.page === page && search.pageSize === pageSize) {
      return;
    }

    Promise.resolve(
      navigate({
        to: '/admin/poi',
        replace: true,
        search: (current: ListSearchState) => updateListSearchPage(current, page, pageSize),
      })
    ).catch(() => undefined);
  }, [navigate, page, pageSize, search.page, search.pageSize]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listPoi({ page, pageSize })
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(errorMessage(pt, loadError, 'messages.loadError'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
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
          <Link to="/admin/poi/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
      {error ? <StudioErrorState>{error}</StudioErrorState> : null}
      {!loading && !error && result.data.length === 0 ? <StudioEmptyState>{pt('empty.title')}</StudioEmptyState> : null}
      {!loading && !error && result.data.length > 0 ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            labels={{
              selectionColumn: pt('fields.actions'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
            data={result.data}
            columns={createPoiListColumns(pt)}
            rowActions={(item) => <PoiListEditAction id={item.id} label={editLabel} />}
            emptyState={null}
            getRowId={(item) => item.id}
            selectionMode="none"
          />
          <PoiPaginationNav
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel', { page: result.pagination.page })}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            pagination={result.pagination}
            onPageChange={handlePageChange}
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

function PoiEditor({ mode }: { readonly mode: 'create' | 'edit' }) {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  const contentId = params.contentId ?? params.id;
  const [form, setForm] = React.useState<PoiFormInput>(defaultForm);
  const [payloadText, setPayloadText] = React.useState('{}');
  const [mediaOptions, setMediaOptions] = React.useState<readonly { assetId: string; label: string }[]>([]);
  const [teaserImageAssetId, setTeaserImageAssetId] = React.useState<string | null>(null);
  const [existingMediaReferenceCount, setExistingMediaReferenceCount] = React.useState(0);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [payloadError, setPayloadError] = React.useState(false);

  React.useEffect(() => {
    void listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis) })
      .then((assets) => setMediaOptions(toHostMediaFieldOptions(assets)))
      .catch(() => setMediaOptions([]));
  }, []);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }
    let active = true;
    getPoi(contentId)
      .then((item) => {
        if (active) {
          const nextForm = itemToForm(item);
          setForm(nextForm);
          setPayloadText(JSON.stringify(nextForm.payload ?? {}, null, 2));
          void listHostMediaReferencesByTarget({
            fetch: globalThis.fetch.bind(globalThis),
            targetType: 'poi',
            targetId: item.id,
          })
            .then((references) => {
              setExistingMediaReferenceCount(references.length);
              setTeaserImageAssetId(
                findHostMediaReferenceAssetId(references, pluginPoiMediaPickers.teaserImage.roles[0])
              );
            })
            .catch(() => {
              setExistingMediaReferenceCount(0);
              setTeaserImageAssetId(null);
            });
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setStatus({ kind: 'error', text: errorMessage(pt, loadError, 'messages.missingContent') });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [contentId, mode, pt]);

  const errors = validatePoiForm(form);
  const setField = <TKey extends keyof PoiFormInput>(key: TKey, value: PoiFormInput[TKey]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const firstAddress = form.addresses?.[0] ?? {};
  const firstUrl = form.webUrls?.[0] ?? { url: '', description: '' };
  const firstOpeningHour = form.openingHours?.[0] ?? {};

  const parsePayload = () => {
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false) {
        setPayloadError(false);
        return parsed as Record<string, unknown>;
      }
    } catch {
      // handled below
    }
    setPayloadError(true);
    return null;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = parsePayload();
    if (!payload) {
      setStatus({ kind: 'error', text: pt('validation.payload') });
      return;
    }
    const compacted = compactForm({ ...form, payload });
    const validationErrors = validatePoiForm(compacted);
    if (validationErrors.length > 0) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
      return;
    }
    try {
      const saved = mode === 'create' ? await createPoi(compacted) : await updatePoi(contentId as string, compacted);
      const mediaReferences = teaserImageAssetId
        ? [
            {
              assetId: teaserImageAssetId,
              role: pluginPoiMediaPickers.teaserImage.roles[0],
              sortOrder: 0,
            },
          ]
        : [];
      if (mediaReferences.length > 0 || existingMediaReferenceCount > 0) {
        await replaceHostMediaReferences({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: 'poi',
          targetId: saved.id,
          references: mediaReferences,
        });
      }
      setStatus({ kind: 'success', text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess') });
      if (mode === 'create') {
        await navigate({ to: '/admin/poi/$id', params: { id: saved.id } });
      }
    } catch (saveError) {
      setStatus({ kind: 'error', text: errorMessage(pt, saveError, 'messages.saveError') });
    }
  };

  const remove = async () => {
    if (!contentId || !globalThis.confirm(pt('actions.deleteConfirm'))) {
      return;
    }
    try {
      await deletePoi(contentId);
      await navigate({ to: '/admin/poi' });
    } catch (deleteError) {
      setStatus({ kind: 'error', text: errorMessage(pt, deleteError, 'messages.deleteError') });
    }
  };

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
      description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
      actions={
        <Button asChild variant="outline">
          <Link to="/admin/poi">{pt('actions.back')}</Link>
        </Button>
      }
    >
      <form onSubmit={(submitEvent) => void submit(submitEvent)} className="space-y-5">
        {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-name" label={pt('fields.name')} required error={errors.includes('name') ? pt('validation.name') : undefined}>
            <Input id="poi-name" value={form.name} onChange={(event) => setField('name', event.target.value)} />
          </StudioField>
          <StudioField id="poi-category" label={pt('fields.categoryName')} error={errors.includes('categoryName') ? pt('validation.categoryName') : undefined}>
            <Input id="poi-category" value={form.categoryName ?? ''} onChange={(event) => setField('categoryName', event.target.value)} />
          </StudioField>
        </StudioFieldGroup>
        <StudioField id="poi-description" label={pt('fields.description')}>
          <Textarea id="poi-description" value={form.description ?? ''} onChange={(event) => setField('description', event.target.value)} rows={6} />
        </StudioField>
        <StudioField id="poi-mobile-description" label={pt('fields.mobileDescription')}>
          <Textarea id="poi-mobile-description" value={form.mobileDescription ?? ''} onChange={(event) => setField('mobileDescription', event.target.value)} rows={4} />
        </StudioField>
        <MediaReferenceField
          id="poi-teaser-image"
          label={pt('fields.teaserImage')}
          value={teaserImageAssetId}
          options={mediaOptions}
          onChange={setTeaserImageAssetId}
          placeholder={pt('fields.mediaPlaceholder')}
          clearLabel={pt('actions.clearMedia')}
        />
        <StudioField id="poi-active" label={pt('fields.active')}>
          <Checkbox id="poi-active" checked={form.active !== false} onChange={(event) => setField('active', event.target.checked)} />
        </StudioField>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-street" label={pt('fields.street')}>
            <Input id="poi-street" value={firstAddress.street ?? ''} onChange={(event) => setField('addresses', [{ ...firstAddress, street: event.target.value }])} />
          </StudioField>
          <StudioField id="poi-city" label={pt('fields.city')}>
            <Input id="poi-city" value={firstAddress.city ?? ''} onChange={(event) => setField('addresses', [{ ...firstAddress, city: event.target.value }])} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-email" label={pt('fields.email')}>
            <Input id="poi-email" value={form.contact?.email ?? ''} onChange={(event) => setField('contact', { ...(form.contact ?? {}), email: event.target.value })} />
          </StudioField>
          <StudioField id="poi-url" label={pt('fields.url')} error={errors.includes('webUrls') ? pt('validation.webUrls') : undefined}>
            <Input id="poi-url" value={firstUrl.url} onChange={(event) => setField('webUrls', [{ ...firstUrl, url: event.target.value }])} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-weekday" label={pt('fields.weekday')}>
            <Input id="poi-weekday" value={firstOpeningHour.weekday ?? ''} onChange={(event) => setField('openingHours', [{ ...firstOpeningHour, weekday: event.target.value }])} />
          </StudioField>
          <StudioField id="poi-time-from" label={pt('fields.timeFrom')}>
            <Input id="poi-time-from" value={firstOpeningHour.timeFrom ?? ''} onChange={(event) => setField('openingHours', [{ ...firstOpeningHour, timeFrom: event.target.value }])} />
          </StudioField>
        </StudioFieldGroup>
        <StudioField id="poi-payload" label={pt('fields.payload')} error={payloadError ? pt('validation.payload') : undefined}>
          <Textarea id="poi-payload" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} rows={6} />
        </StudioField>
        <div className="flex gap-2">
          <Button type="submit">{mode === 'create' ? pt('actions.create') : pt('actions.update')}</Button>
          {mode === 'edit' ? (
            <Button type="button" variant="destructive" onClick={() => void remove()}>
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      </form>
    </StudioDetailPageTemplate>
  );
}

export function PoiCreatePage() {
  return <PoiEditor mode="create" />;
}

export function PoiEditPage() {
  return <PoiEditor mode="edit" />;
}
