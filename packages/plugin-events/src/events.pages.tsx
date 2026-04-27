import React from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
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
import type { EventContentItem, EventFormInput, PoiSelectItem } from './events.types.js';
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
  const [items, setItems] = React.useState<readonly EventContentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    listEvents()
      .then((data) => {
        if (active) {
          setItems(data);
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
  }, [pt]);

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/plugins/events/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
      {error ? <StudioErrorState>{error}</StudioErrorState> : null}
      {!loading && !error && items.length === 0 ? <StudioEmptyState>{pt('empty.title')}</StudioEmptyState> : null}
      {!loading && !error && items.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{pt('fields.title')}</th>
                <th className="px-4 py-3 font-medium">{pt('fields.categoryName')}</th>
                <th className="px-4 py-3 font-medium">{pt('fields.dateStart')}</th>
                <th className="px-4 py-3 text-right font-medium">{pt('fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{item.title}</td>
                  <td className="px-4 py-3">{item.categoryName ?? '—'}</td>
                  <td className="px-4 py-3">{item.dates?.[0]?.dateStart ? new Date(item.dates[0].dateStart).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/plugins/events/$contentId" params={{ contentId: item.id }}>
                        {pt('actions.edit')}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

function EventsEditor({ mode }: { readonly mode: 'create' | 'edit' }) {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { readonly contentId?: string };
  const contentId = params.contentId;
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
        await navigate({ to: '/plugins/events/$contentId', params: { contentId: saved.id } });
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
      await navigate({ to: '/plugins/events' });
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
          <Link to="/plugins/events">{pt('actions.back')}</Link>
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
