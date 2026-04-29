import React from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  Select,
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

import {
  createEvent,
  deleteEvent,
  EventsApiError,
  getEvent,
  listEvents,
  listPoiForEventSelection,
  updateEvent,
} from './events.api.js';
import { normalizeListSearch } from './list-pagination.js';
import type { EventContentItem, EventFormInput, EventListResult, PoiSelectItem } from './events.types.js';
import { validateEventForm } from './events.validation.js';

type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

const defaultForm = (): EventFormInput => ({
  title: '',
  description: '',
  categoryName: '',
  dates: [{ dateStart: '', dateEnd: '', timeStart: '', timeEnd: '' }],
  addresses: [{ street: '', zip: '', city: '' }],
  contact: { firstName: '', lastName: '', phone: '', email: '' },
  urls: [{ url: '', description: '' }],
  tags: [],
  pointOfInterestId: '',
  repeat: false,
  recurring: '',
  recurringType: '',
  recurringInterval: '',
  recurringWeekdays: [],
});

const compactString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const toDatetimeLocalValue = (value?: string) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const fromDatetimeLocalValue = (value: string) => {
  if (value.length === 0) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const itemToForm = (item: EventContentItem): EventFormInput => ({
  ...defaultForm(),
  title: item.title,
  description: item.description ?? '',
  categoryName: item.categoryName ?? '',
  dates: item.dates && item.dates.length > 0 ? item.dates : defaultForm().dates,
  addresses: item.addresses && item.addresses.length > 0 ? item.addresses : defaultForm().addresses,
  contact: item.contact ?? item.contacts?.[0] ?? defaultForm().contact,
  urls: item.urls && item.urls.length > 0 ? item.urls : defaultForm().urls,
  tags: item.tags ?? [],
  pointOfInterestId: item.pointOfInterestId ?? '',
  repeat: item.repeat ?? false,
  recurring: item.recurring ?? '',
  recurringType: item.recurringType ?? '',
  recurringInterval: item.recurringInterval ?? '',
  recurringWeekdays: item.recurringWeekdays ?? [],
});

const compactForm = (form: EventFormInput): EventFormInput => ({
  title: form.title.trim(),
  ...(compactString(form.description) ? { description: compactString(form.description) } : {}),
  ...(compactString(form.categoryName) ? { categoryName: compactString(form.categoryName) } : {}),
  dates: (form.dates ?? [])
    .map((date) => ({
      ...(compactString(date.dateStart) ? { dateStart: date.dateStart } : {}),
      ...(compactString(date.dateEnd) ? { dateEnd: date.dateEnd } : {}),
      ...(compactString(date.timeStart) ? { timeStart: date.timeStart } : {}),
      ...(compactString(date.timeEnd) ? { timeEnd: date.timeEnd } : {}),
      ...(compactString(date.timeDescription) ? { timeDescription: compactString(date.timeDescription) } : {}),
    }))
    .filter((date) => Object.keys(date).length > 0),
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
  urls: (form.urls ?? [])
    .map((url) => ({
      ...(compactString(url.url) ? { url: compactString(url.url) as string } : {}),
      ...(compactString(url.description) ? { description: compactString(url.description) } : {}),
    }))
    .filter((url): url is { url: string; description?: string } => Boolean(url.url)),
  tags: (form.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  ...(compactString(form.pointOfInterestId) ? { pointOfInterestId: compactString(form.pointOfInterestId) } : {}),
  ...(form.repeat !== undefined ? { repeat: form.repeat } : {}),
  ...(compactString(form.recurring) ? { recurring: compactString(form.recurring) } : {}),
  ...(compactString(form.recurringType) ? { recurringType: compactString(form.recurringType) } : {}),
  ...(compactString(form.recurringInterval) ? { recurringInterval: compactString(form.recurringInterval) } : {}),
  recurringWeekdays: (form.recurringWeekdays ?? []).map((day) => day.trim()).filter(Boolean),
});

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) =>
  error instanceof EventsApiError ? error.message : pt(fallbackKey);

export function EventsListPage() {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const [result, setResult] = React.useState<EventListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (search.page === page && search.pageSize === pageSize) {
      return;
    }

    void navigate({
      to: '/plugins/events',
      replace: true,
      search: (current: Record<string, unknown>) => ({
        ...current,
        page,
        pageSize,
      }),
    });
  }, [navigate, page, pageSize, search.page, search.pageSize]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listEvents({ page, pageSize })
      .then((data) => {
        if (active) {
          setResult(data);
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
          <Link to="/admin/events/new">{pt('actions.create')}</Link>
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
            columns={[
              { id: 'title', header: pt('fields.title'), cell: (item: EventContentItem) => item.title },
              { id: 'categoryName', header: pt('fields.categoryName'), cell: (item: EventContentItem) => item.categoryName ?? '—' },
              {
                id: 'dateStart',
                header: pt('fields.dateStart'),
                cell: (item: EventContentItem) =>
                  item.dates?.[0]?.dateStart ? new Date(item.dates[0].dateStart).toLocaleString() : '—',
              },
            ]}
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/events/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            emptyState={null}
            getRowId={(item) => item.id}
            selectionMode="none"
          />
          <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p key={result.pagination.page} aria-live="polite" className="animate-pagination-active">
              {pt('pagination.pageLabel', { page: result.pagination.page })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={result.pagination.page <= 1}
                onClick={() =>
                  void navigate({
                    to: '/admin/events',
                    search: (current: Record<string, unknown>) => ({
                      ...current,
                      page: Math.max(1, result.pagination.page - 1),
                      pageSize: result.pagination.pageSize,
                    }),
                  })
                }
              >
                {pt('pagination.previous')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!result.pagination.hasNextPage}
                onClick={() =>
                  void navigate({
                    to: '/admin/events',
                    search: (current: Record<string, unknown>) => ({
                      ...current,
                      page: result.pagination.page + 1,
                      pageSize: result.pagination.pageSize,
                    }),
                  })
                }
              >
                {pt('pagination.next')}
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

function EventsEditor({ mode }: { readonly mode: 'create' | 'edit' }) {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  const contentId = params.contentId ?? params.id;
  const [form, setForm] = React.useState<EventFormInput>(defaultForm);
  const [pois, setPois] = React.useState<readonly PoiSelectItem[]>([]);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);

  React.useEffect(() => {
    void listPoiForEventSelection().then(setPois).catch(() => setPois([]));
  }, []);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }
    let active = true;
    getEvent(contentId)
      .then((item) => {
        if (active) {
          setForm(itemToForm(item));
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

  const errors = validateEventForm(form);
  const setField = <TKey extends keyof EventFormInput>(key: TKey, value: EventFormInput[TKey]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const firstDate = form.dates?.[0] ?? {};
  const firstAddress = form.addresses?.[0] ?? {};
  const firstUrl = form.urls?.[0] ?? { url: '', description: '' };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const compacted = compactForm(form);
    const validationErrors = validateEventForm(compacted);
    if (validationErrors.length > 0) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
      return;
    }
    try {
      const saved =
        mode === 'create' ? await createEvent(compacted) : await updateEvent(contentId as string, compacted);
      setStatus({ kind: 'success', text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess') });
      if (mode === 'create') {
        await navigate({ to: '/admin/events/$id', params: { id: saved.id } });
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
      await deleteEvent(contentId);
      await navigate({ to: '/admin/events' });
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
          <Link to="/admin/events">{pt('actions.back')}</Link>
        </Button>
      }
    >
      <form onSubmit={(submitEvent) => void submit(submitEvent)} className="space-y-5">
        {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
        <StudioFieldGroup columns={2}>
          <StudioField id="event-title" label={pt('fields.title')} required error={errors.includes('title') ? pt('validation.title') : undefined}>
            <Input id="event-title" value={form.title} onChange={(event) => setField('title', event.target.value)} />
          </StudioField>
          <StudioField id="event-category" label={pt('fields.categoryName')} error={errors.includes('categoryName') ? pt('validation.categoryName') : undefined}>
            <Input id="event-category" value={form.categoryName ?? ''} onChange={(event) => setField('categoryName', event.target.value)} />
          </StudioField>
        </StudioFieldGroup>
        <StudioField id="event-description" label={pt('fields.description')}>
          <Textarea id="event-description" value={form.description ?? ''} onChange={(event) => setField('description', event.target.value)} rows={7} />
        </StudioField>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-date-start" label={pt('fields.dateStart')} error={errors.includes('dates') ? pt('validation.dates') : undefined}>
            <Input id="event-date-start" type="datetime-local" value={toDatetimeLocalValue(firstDate.dateStart)} onChange={(event) => setField('dates', [{ ...firstDate, dateStart: fromDatetimeLocalValue(event.target.value) }])} />
          </StudioField>
          <StudioField id="event-date-end" label={pt('fields.dateEnd')}>
            <Input id="event-date-end" type="datetime-local" value={toDatetimeLocalValue(firstDate.dateEnd)} onChange={(event) => setField('dates', [{ ...firstDate, dateEnd: fromDatetimeLocalValue(event.target.value) }])} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-street" label={pt('fields.street')}>
            <Input id="event-street" value={firstAddress.street ?? ''} onChange={(event) => setField('addresses', [{ ...firstAddress, street: event.target.value }])} />
          </StudioField>
          <StudioField id="event-city" label={pt('fields.city')}>
            <Input id="event-city" value={firstAddress.city ?? ''} onChange={(event) => setField('addresses', [{ ...firstAddress, city: event.target.value }])} />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-email" label={pt('fields.email')}>
            <Input id="event-email" value={form.contact?.email ?? ''} onChange={(event) => setField('contact', { ...(form.contact ?? {}), email: event.target.value })} />
          </StudioField>
          <StudioField id="event-url" label={pt('fields.url')} error={errors.includes('urls') ? pt('validation.urls') : undefined}>
            <Input id="event-url" value={firstUrl.url} onChange={(event) => setField('urls', [{ ...firstUrl, url: event.target.value }])} />
          </StudioField>
        </StudioFieldGroup>
        <StudioField id="event-poi" label={pt('fields.pointOfInterestId')}>
          <Select id="event-poi" value={form.pointOfInterestId ?? ''} onChange={(event) => setField('pointOfInterestId', event.target.value)}>
            <option value="">—</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.name}
              </option>
            ))}
          </Select>
        </StudioField>
        <StudioField id="event-repeat" label={pt('fields.repeat')}>
          <Checkbox id="event-repeat" checked={form.repeat ?? false} onChange={(event) => setField('repeat', event.target.checked)} />
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

export function EventsCreatePage() {
  return <EventsEditor mode="create" />;
}

export function EventsEditPage() {
  return <EventsEditor mode="edit" />;
}
