import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { NewsDetailContentTab } from '../src/news.detail-content-tab.js';
import type { NewsDetailFormValues } from '../src/news.types.js';

vi.mock('@sva/studio-ui-react', async () => {
  const actual = await vi.importActual<typeof import('@sva/studio-ui-react')>('@sva/studio-ui-react');
  return {
    ...actual,
    RichTextHtmlEditor: ({
      id,
      value,
      onChange,
      labelId,
      describedBy,
      ariaInvalid,
    }: {
      id: string;
      value: string;
      onChange: (nextValue: string) => void;
      labelId?: string;
      describedBy?: string;
      ariaInvalid?: boolean;
    }) => (
      <textarea
        id={id}
        data-testid="rich-text-editor"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ? 'true' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
  };
});

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) =>
  (
    {
      'cards.content.text.title': 'Textinhalt',
      'cards.content.text.description': 'Textinhalt der News.',
      'cards.content.media.title': 'Medien',
      'cards.content.media.description': 'Medien des ersten Inhaltsblocks.',
      'cards.content.media.empty': 'Noch keine Medien zugeordnet.',
      'cards.content.media.itemLabel': 'Medium {{index}}',
      'cards.content.source.title': 'Quelle',
      'cards.content.source.description': 'Quellenangaben.',
      'fields.headline': 'Headline',
      'fields.contentTeaser': 'Teaser',
      'fields.contentBody': 'Inhalt',
      'fields.sourceUrl': 'Quell-URL',
      'fields.sourceUrlDescription': 'Quellbeschreibung',
      'fields.mediaUrl': 'Medien-URL',
      'fields.mediaCaption': 'Bildunterschrift',
      'fields.mediaUrlDescription': 'Bildquelle',
      'fields.mediaCopyright': 'Copyright',
      'fields.mediaWidth': 'Breite',
      'fields.mediaHeight': 'Höhe',
      'fields.imageSearch': 'Bilder suchen',
      'fields.characterCount': `${variables?.count ?? 0} Zeichen`,
      'messages.validationSummary': 'Bitte prüfen Sie die folgenden Felder:',
      'actions.addImage': 'Bild aus Mediathek',
      'actions.uploadMedia': 'Bild hochladen',
      'actions.uploadingMedia': 'Bild wird hochgeladen',
      'actions.addMediaManual': 'Link manuell eintragen',
      'actions.remove': 'Entfernen',
      'actions.removeImage': 'Bild entfernen',
      'messages.imagePickerEmpty': 'Keine Bilder gefunden.',
      'messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
      'messages.mediaUploadUploading': 'Bild wird hochgeladen.',
      'messages.mediaUploadFinalizing': 'Bild wird verarbeitet.',
      'messages.mediaUploadSuccess': 'Bild wurde hochgeladen.',
      'messages.mediaUploadError': 'Bild konnte nicht hochgeladen werden.',
      'messages.mediaUploadUnsupportedType': 'Dateityp wird nicht unterstützt.',
      'messages.mediaUploadUnavailableUrl': 'Bild-URL konnte nicht ermittelt werden.',
      'values.mediaContentTypes.image': 'Bild',
      'values.mediaContentTypes.audio': 'Audio',
      'values.mediaContentTypes.video': 'Video',
      'values.mediaContentTypes.logo': 'Logo',
      'values.mediaContentTypes.attachment': 'Anhang',
      'values.mediaContentTypes.unspecified': 'Nicht angegeben',
      'richText.heading2': 'Überschrift 2',
      'richText.heading3': 'Überschrift 3',
      'richText.heading4': 'Überschrift 4',
      'richText.blockType': 'Textformat',
      'richText.paragraph': 'Absatz',
      'richText.blockquote': 'Zitat',
      'richText.bulletList': 'Aufzählung',
      'richText.orderedList': 'Nummerierung',
      'richText.bold': 'Fett',
      'richText.italic': 'Kursiv',
      'richText.undo': 'Zurück',
      'richText.redo': 'Vorwärts',
      'richText.linkInput': 'Link-URL',
      'richText.applyLink': 'Link setzen',
    } as const
  )[key] ?? key;

function renderTab(defaultValues?: Partial<NewsDetailFormValues>) {
  const valuesRef: { current?: NewsDetailFormValues } = {};
  const onUploadFile = vi.fn(async () => ({ id: 'asset-1', metadata: { title: 'Testbild' } }));

  const Wrapper = () => {
    const methods = useForm<NewsDetailFormValues>({
      defaultValues: {
        title: 'Bestehende Headline',
        author: '',
        categories: [],
        contentTeaser: '<p>Teaser</p>',
        contentBody: '<p>Body</p>',
        contentMedia: [],
        sourceUrl: { url: '', description: '' },
        sourceUrlDescription: '',
        pushNotificationEnabled: false,
        publicationMode: 'draft',
        scheduledPublicationAt: '',
        ...defaultValues,
      },
    });

    valuesRef.current = methods.getValues();

    return (
      <FormProvider {...methods}>
        <NewsDetailContentTab mediaAssets={[]} onUploadFile={onUploadFile} pt={pt} />
        <button type="button" onClick={() => (valuesRef.current = methods.getValues())}>
          Werte lesen
        </button>
      </FormProvider>
    );
  };

  render(<Wrapper />);

  return valuesRef;
}

describe('NewsDetailContentTab', () => {
  it('renders teaser and content with RichTextHtmlEditor bindings', () => {
    const valuesRef = renderTab();

    expect(screen.getAllByTestId('rich-text-editor')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Teaser'), { target: { value: '<p>Neuer Teaser</p>' } });
    fireEvent.change(screen.getByLabelText('Inhalt'), { target: { value: '<p>Neuer Inhalt</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));

    expect(valuesRef.current?.contentTeaser).toBe('<p>Neuer Teaser</p>');
    expect(valuesRef.current?.contentBody).toBe('<p>Neuer Inhalt</p>');
  });
});
