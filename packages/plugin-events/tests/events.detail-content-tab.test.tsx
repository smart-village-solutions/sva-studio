import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { EventsDetailContentTab } from '../src/events.detail-content-tab.js';
import type { EventsDetailFormValues } from '../src/events.detail-form.js';

const pt = (key: string) =>
  ({
    'cards.content.descriptions.title': 'Beschreibung',
    'cards.content.descriptions.description': 'Beschreibung des Events',
    'cards.content.dates.title': 'Termine',
    'cards.content.dates.description': 'Datumsangaben',
    'cards.content.addresses.title': 'Adresse',
    'cards.content.addresses.description': 'Ort des Events',
    'cards.content.contact.title': 'Kontakt',
    'cards.content.contact.description': 'Kontaktmöglichkeiten',
    'cards.content.links.title': 'Links',
    'cards.content.links.description': 'Externe Links',
    'cards.content.recurrence.title': 'Wiederholung',
    'cards.content.recurrence.description': 'Wiederkehrend',
    'cards.content.poi.title': 'POI',
    'cards.content.poi.description': 'Verknüpfter POI',
    'fields.description': 'Beschreibung',
    'fields.dateStart': 'Startdatum',
    'fields.dateEnd': 'Enddatum',
    'fields.timeStart': 'Startzeit',
    'fields.timeEnd': 'Endzeit',
    'fields.street': 'Straße',
    'fields.city': 'Ort',
    'fields.email': 'E-Mail',
    'fields.phone': 'Telefon',
    'fields.url': 'URL',
    'fields.urlDescription': 'Link-Beschreibung',
    'fields.repeat': 'Wiederholung',
    'fields.pointOfInterestId': 'Zugehöriger POI',
  })[key] ?? key;

function renderTab(defaultValues?: Partial<EventsDetailFormValues>) {
  const onDateStartInputChange = vi.fn();
  const onDateEndInputChange = vi.fn();
  let latestValues: EventsDetailFormValues | undefined;

  const Wrapper = () => {
    const methods = useForm<EventsDetailFormValues>({
      defaultValues: {
        title: '',
        categoryName: '',
        content: {
          description: '',
          dates: [{ dateStart: '', dateEnd: '', timeStart: '', timeEnd: '' }],
          addresses: [{ street: '', city: '' }],
          contact: { email: '', phone: '' },
          urls: [{ url: '', description: '' }],
          repeat: false,
          pointOfInterestId: '',
        },
        settings: { headerImageAssetId: '' },
        ...defaultValues,
      } as EventsDetailFormValues,
    });
    latestValues = methods.getValues();

    return (
      <FormProvider {...methods}>
        <EventsDetailContentTab
          dateEndInput=""
          dateInputsInvalid={{ dateStart: false, dateEnd: false }}
          dateStartInput=""
          onDateEndInputChange={onDateEndInputChange}
          onDateStartInputChange={onDateStartInputChange}
          pois={[
            { id: 'poi-1', name: 'Rathaus' },
            { id: 'poi-2', name: 'Bibliothek' },
          ]}
          pt={pt}
        />
      </FormProvider>
    );
  };

  const view = render(<Wrapper />);

  return {
    ...view,
    onDateEndInputChange,
    onDateStartInputChange,
    getValues: () => latestValues as EventsDetailFormValues,
  };
}

describe('EventsDetailContentTab', () => {
  it('propagates date input callbacks and persists the remaining content fields', () => {
    const { onDateEndInputChange, onDateStartInputChange, getValues } = renderTab();

    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-06-12T10:15' } });
    fireEvent.change(screen.getByLabelText('Enddatum'), { target: { value: '2026-06-12T12:30' } });
    fireEvent.change(screen.getByLabelText('Startzeit'), { target: { value: '10:15' } });
    fireEvent.change(screen.getByLabelText('Endzeit'), { target: { value: '12:30' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Marktplatz 1' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'kontakt@example.com' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '01234 5678' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/event' } });
    fireEvent.change(screen.getByLabelText('Link-Beschreibung'), { target: { value: 'Weitere Infos' } });
    fireEvent.click(screen.getByLabelText('Wiederholung'));
    fireEvent.change(screen.getByLabelText('Zugehöriger POI'), { target: { value: 'poi-2' } });

    expect(onDateStartInputChange).toHaveBeenCalledWith('2026-06-12T10:15');
    expect(onDateEndInputChange).toHaveBeenCalledWith('2026-06-12T12:30');
    expect(getValues().content.dates?.[0]).toMatchObject({ timeStart: '10:15', timeEnd: '12:30' });
    expect(getValues().content.addresses?.[0]).toMatchObject({ street: 'Marktplatz 1', city: 'Musterstadt' });
    expect(getValues().content.contact).toMatchObject({ email: 'kontakt@example.com', phone: '01234 5678' });
    expect(getValues().content.urls?.[0]).toMatchObject({
      url: 'https://example.com/event',
      description: 'Weitere Infos',
    });
    expect(getValues().content.repeat).toBe(true);
    expect(getValues().content.pointOfInterestId).toBe('poi-2');
  });

  it('renders fallback values when optional arrays are initially missing', () => {
    renderTab({
      content: {
        description: '',
        dates: [],
        addresses: [],
        contact: {},
        urls: [],
        repeat: false,
        pointOfInterestId: '',
      },
    });

    expect((screen.getByLabelText('Startzeit') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('');
  });
});
