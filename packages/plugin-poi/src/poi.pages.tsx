import React from 'react';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
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
  StudioFormSummaryErrors,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioDataTable,
  Textarea,
  getStudioFormFieldProps,
  type StudioFormFieldError,
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

type PoiEditorFormValues = Readonly<{
  name: string;
  description: string;
  mobileDescription: string;
  active: boolean;
  categoryName: string;
  street: string;
  city: string;
  email: string;
  url: string;
  weekday: string;
  timeFrom: string;
  payloadText: string;
  teaserImageAssetId: string;
}>;

const createResolverError = (message: string) => ({
  type: 'validate',
  message,
});

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

const defaultEditorForm = (): PoiEditorFormValues => ({
  name: '',
  description: '',
  mobileDescription: '',
  active: true,
  categoryName: '',
  street: '',
  city: '',
  email: '',
  url: '',
  weekday: '',
  timeFrom: '',
  payloadText: '{}',
  teaserImageAssetId: '',
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

const formToEditorValues = (form: PoiFormInput, teaserImageAssetId: string | null = null): PoiEditorFormValues => ({
  name: form.name,
  description: form.description ?? '',
  mobileDescription: form.mobileDescription ?? '',
  active: form.active !== false,
  categoryName: form.categoryName ?? '',
  street: form.addresses?.[0]?.street ?? '',
  city: form.addresses?.[0]?.city ?? '',
  email: form.contact?.email ?? '',
  url: form.webUrls?.[0]?.url ?? '',
  weekday: form.openingHours?.[0]?.weekday ?? '',
  timeFrom: form.openingHours?.[0]?.timeFrom ?? '',
  payloadText: JSON.stringify(form.payload ?? {}, null, 2),
  teaserImageAssetId: teaserImageAssetId ?? '',
});

const editorValuesToForm = (values: PoiEditorFormValues, payload: Record<string, unknown>): PoiFormInput => ({
  name: values.name,
  description: values.description,
  mobileDescription: values.mobileDescription,
  active: values.active,
  categoryName: values.categoryName,
  addresses: [{ street: values.street, city: values.city }],
  contact: { email: values.email },
  openingHours: [{ weekday: values.weekday, timeFrom: values.timeFrom, open: true }],
  webUrls: [{ url: values.url }],
  payload,
});

const collectSummaryErrors = (fields: readonly ReturnType<typeof getStudioFormFieldProps>[]): readonly StudioFormFieldError[] =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const parsePayloadText = (payloadText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(payloadText) as unknown;
    return parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const poiEditorResolver: Resolver<PoiEditorFormValues> = async (values) => {
  const errors: FieldErrors<PoiEditorFormValues> = {
    ...(parsePayloadText(values.payloadText) ? {} : { payloadText: createResolverError('validation.payload') }),
  };
  const payload = parsePayloadText(values.payloadText);

  const compacted = compactForm(editorValuesToForm(values, payload ?? {}));
  const validationErrors = validatePoiForm(compacted);

  const resolvedErrors: FieldErrors<PoiEditorFormValues> = {
    ...errors,
    ...(validationErrors.includes('name') ? { name: createResolverError('validation.name') } : {}),
    ...(validationErrors.includes('categoryName') ? { categoryName: createResolverError('validation.categoryName') } : {}),
    ...(validationErrors.includes('webUrls') ? { url: createResolverError('validation.webUrls') } : {}),
  };

  return {
    values: Object.keys(resolvedErrors).length === 0 ? values : {},
    errors: resolvedErrors,
  };
};

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

const createPoiListColumns = (pt: ReturnType<typeof usePluginTranslation>) => [
  { id: 'name', header: pt('fields.name'), cell: (item: PoiContentItem) => item.name },
  {
    id: 'categoryName',
    header: pt('fields.categoryName'),
    cell: (item: PoiContentItem) => item.categoryName ?? pt('values.notAvailable'),
  },
  {
    id: 'active',
    header: pt('fields.active'),
    cell: (item: PoiContentItem) => (item.active === false ? pt('values.notAvailable') : pt('values.active')),
  },
];

const PoiPaginationNav = ({
  page,
  hasNextPage,
  onPageChange,
  pt,
}: Readonly<{
  page: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  pt: ReturnType<typeof usePluginTranslation>;
}>) => (
  <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
    <p key={page} aria-live="polite" className="animate-pagination-active">
      {pt('pagination.pageLabel', { page })}
    </p>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        {pt('pagination.previous')}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
        {pt('pagination.next')}
      </Button>
    </div>
  </nav>
);

export function PoiListPage() {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ListSearchState;
  const normalizedSearch = normalizeListSearch(search);
  const page = normalizedSearch.page;
  const pageSize = normalizedSearch.pageSize;
  const [result, setResult] = React.useState<PoiListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      void navigate({
        to: '/admin/poi',
        search: (current: Record<string, unknown>) => ({
          ...current,
          page: nextPage,
          pageSize: result.pagination.pageSize,
        }),
      });
    },
    [navigate, result.pagination.pageSize]
  );

  React.useEffect(() => {
    let active = true;
    setLoading(true);
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
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/poi/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            emptyState={null}
            getRowId={(item) => item.id}
            selectionMode="none"
          />
          <PoiPaginationNav
            page={result.pagination.page}
            hasNextPage={result.pagination.hasNextPage}
            onPageChange={handlePageChange}
            pt={pt}
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
  const {
    control,
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<PoiEditorFormValues>({
    defaultValues: defaultEditorForm(),
    resolver: poiEditorResolver,
    reValidateMode: 'onChange',
  });
  const [mediaOptions, setMediaOptions] = React.useState<readonly { assetId: string; label: string }[]>([]);
  const [existingMediaReferenceCount, setExistingMediaReferenceCount] = React.useState(0);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const missingContentMessage = pt('messages.missingContent');

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
          reset(formToEditorValues(nextForm));
          void listHostMediaReferencesByTarget({
            fetch: globalThis.fetch.bind(globalThis),
            targetType: 'poi',
            targetId: item.id,
          })
            .then((references) => {
              setExistingMediaReferenceCount(references.length);
              setValue(
                'teaserImageAssetId',
                findHostMediaReferenceAssetId(references, pluginPoiMediaPickers.teaserImage.roles[0]) ?? ''
              );
            })
            .catch(() => {
              setExistingMediaReferenceCount(0);
              setValue('teaserImageAssetId', '');
            });
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setStatus({
            kind: 'error',
            text: loadError instanceof PoiApiError ? loadError.message : missingContentMessage,
          });
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
  }, [contentId, missingContentMessage, mode, reset, setValue]);

  const nameField = getStudioFormFieldProps({
    id: 'poi-name',
    error: errors.name,
  });
  const categoryField = getStudioFormFieldProps({
    id: 'poi-category',
    error: errors.categoryName,
  });
  const urlField = getStudioFormFieldProps({
    id: 'poi-url',
    error: errors.url,
  });
  const payloadField = getStudioFormFieldProps({
    id: 'poi-payload',
    error: errors.payloadText,
  });
  const summaryErrors = collectSummaryErrors([nameField, categoryField, urlField, payloadField]);

  const submit = handleSubmit(async (values) => {
    setStatus(null);
    const payload = parsePayloadText(values.payloadText);
    if (!payload) {
      return;
    }
    const compacted = compactForm(editorValuesToForm(values, payload));
    try {
      const saved = mode === 'create' ? await createPoi(compacted) : await updatePoi(contentId as string, compacted);
      const mediaReferences = values.teaserImageAssetId
        ? [
            {
              assetId: values.teaserImageAssetId,
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
  });

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
      <form onSubmit={(submitEvent) => void submit(submitEvent)} className="space-y-5" noValidate>
        <StudioFormSummaryErrors errors={summaryErrors} />
        {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
        <StudioFieldGroup columns={2}>
          <StudioField {...nameField} label={pt('fields.name')} required>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  {...nameField.controlProps}
                  {...field}
                  onChange={(event) => {
                    clearErrors('name');
                    field.onChange(event.target.value);
                  }}
                />
              )}
            />
          </StudioField>
          <StudioField {...categoryField} label={pt('fields.categoryName')}>
            <Input
              {...categoryField.controlProps}
              {...register('categoryName')}
            />
          </StudioField>
        </StudioFieldGroup>
        <StudioField id="poi-description" label={pt('fields.description')}>
          <Textarea id="poi-description" {...register('description')} rows={6} />
        </StudioField>
        <StudioField id="poi-mobile-description" label={pt('fields.mobileDescription')}>
          <Textarea id="poi-mobile-description" {...register('mobileDescription')} rows={4} />
        </StudioField>
        <Controller
          name="teaserImageAssetId"
          control={control}
          render={({ field }) => (
            <MediaReferenceField
              id="poi-teaser-image"
              label={pt('fields.teaserImage')}
              value={field.value || null}
              options={mediaOptions}
              onChange={(assetId) => field.onChange(assetId ?? '')}
              placeholder={pt('fields.mediaPlaceholder')}
              clearLabel={pt('actions.clearMedia')}
            />
          )}
        />
        <StudioField id="poi-active" label={pt('fields.active')}>
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="poi-active"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
        </StudioField>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-street" label={pt('fields.street')}>
            <Input id="poi-street" {...register('street')} />
          </StudioField>
          <StudioField id="poi-city" label={pt('fields.city')}>
            <Input id="poi-city" {...register('city')} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-email" label={pt('fields.email')}>
            <Input id="poi-email" {...register('email')} />
          </StudioField>
          <StudioField {...urlField} label={pt('fields.url')}>
            <Input
              {...urlField.controlProps}
              {...register('url')}
            />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-weekday" label={pt('fields.weekday')}>
            <Input id="poi-weekday" {...register('weekday')} />
          </StudioField>
          <StudioField id="poi-time-from" label={pt('fields.timeFrom')}>
            <Input id="poi-time-from" {...register('timeFrom')} />
          </StudioField>
        </StudioFieldGroup>
        <StudioField {...payloadField} label={pt('fields.payload')}>
          <Textarea
            {...payloadField.controlProps}
              {...register('payloadText')}
            rows={6}
          />
        </StudioField>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {mode === 'create' ? pt('actions.create') : pt('actions.update')}
          </Button>
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
