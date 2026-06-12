import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { PoiDetailContentTab } from '../src/poi.detail-content-tab.js';
import type { PoiDetailFormValues } from '../src/poi.detail-form.js';

const pt = (key: string) =>
  ({
    'messages.validationError': 'Bitte Eingaben prüfen.',
    'validation.webUrls': 'URL muss mit https:// beginnen.',
    'validation.payload': 'Payload muss valides JSON sein.',
    'cards.content.descriptions.title': 'Beschreibungen',
    'cards.content.descriptions.description': 'Texte',
    'cards.content.location.title': 'Lage',
    'cards.content.location.description': 'Adresse',
    'cards.content.contact.title': 'Kontakt',
    'cards.content.contact.description': 'Kontaktfelder',
    'cards.content.openingHours.title': 'Öffnungszeiten',
    'cards.content.openingHours.description': 'Zeitfenster',
    'cards.content.links.title': 'Links',
    'cards.content.links.description': 'Weblinks',
    'cards.content.payload.title': 'Payload',
    'cards.content.payload.description': 'Zusatzdaten',
    'fields.description': 'Beschreibung',
    'fields.mobileDescription': 'Mobile Beschreibung',
    'fields.street': 'Straße',
    'fields.city': 'Ort',
    'fields.email': 'E-Mail',
    'fields.phone': 'Telefon',
    'fields.weekday': 'Wochentag',
    'fields.timeFrom': 'Öffnet',
    'fields.open': 'Geöffnet',
    'fields.url': 'URL',
    'fields.urlDescription': 'Link-Beschreibung',
    'fields.payload': 'Payload',
  })[key] ?? key;

function renderTab(defaultValues?: Partial<PoiDetailFormValues>) {
  let latestValues: PoiDetailFormValues | undefined;

  const Wrapper = () => {
    const methods = useForm<PoiDetailFormValues>({
      defaultValues: {
        name: '',
        active: true,
        basis: { categoryName: '' },
        content: {
          description: '',
          mobileDescription: '',
          addresses: [{ street: '', city: '' }],
          contact: { email: '', phone: '' },
          openingHours: [{ weekday: '', timeFrom: '', open: true }],
          webUrls: [{ url: '', description: '' }],
          payloadText: '{}',
        },
        settings: { teaserImageAssetId: '' },
        ...defaultValues,
      } as PoiDetailFormValues,
    });
    latestValues = methods.getValues();

    return (
      <FormProvider {...methods}>
        <PoiDetailContentTab pt={pt} />
      </FormProvider>
    );
  };

  const view = render(<Wrapper />);

  return {
    ...view,
    getValues: () => latestValues as PoiDetailFormValues,
  };
}

describe('PoiDetailContentTab', () => {
  it('renders translated summary errors and persists content field edits', () => {
    const { getValues } = renderTab({
      content: {
        description: '',
        mobileDescription: '',
        addresses: [{ street: '', city: '' }],
        contact: { email: '', phone: '' },
        openingHours: [{ weekday: '', timeFrom: '', open: true }],
        webUrls: [{ url: '', description: '' }],
        payloadText: '{}',
      },
    });

    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Bürgerservice' } });
    fireEvent.change(screen.getByLabelText('Mobile Beschreibung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Straße'), { target: { value: 'Markt 2' } });
    fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'poi@example.com' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '01234 9876' } });
    fireEvent.change(screen.getByLabelText('Wochentag'), { target: { value: 'Montag' } });
    fireEvent.change(screen.getByLabelText('Öffnet'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByLabelText('Geöffnet'));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/poi' } });
    fireEvent.change(screen.getByLabelText('Link-Beschreibung'), { target: { value: 'Website' } });
    fireEvent.change(screen.getByLabelText('Payload'), { target: { value: '{"source":"test"}' } });

    expect(getValues().content).toMatchObject({
      description: 'Bürgerservice',
      mobileDescription: 'Kurztext',
      contact: { email: 'poi@example.com', phone: '01234 9876' },
      payloadText: '{"source":"test"}',
    });
    expect(getValues().content.addresses?.[0]).toMatchObject({ street: 'Markt 2', city: 'Musterstadt' });
    expect(getValues().content.openingHours?.[0]).toMatchObject({ weekday: 'Montag', timeFrom: '09:00', open: false });
    expect(getValues().content.webUrls?.[0]).toMatchObject({
      url: 'https://example.com/poi',
      description: 'Website',
    });
  });

  it('falls back to empty values and hides summary errors without field errors', () => {
    renderTab({
      content: {
        description: '',
        mobileDescription: '',
        addresses: [],
        contact: {},
        openingHours: [],
        webUrls: [],
        payloadText: '',
      },
    });

    expect((screen.getByLabelText('Straße') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Wochentag') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('Bitte Eingaben prüfen.')).toBeNull();
  });
});
