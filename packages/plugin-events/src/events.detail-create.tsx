/**
 * Komponiert die Neuanlage für Veranstaltungen als durchgehendes Formular.
 * Bestehende Feldabschnitte verwalten ihre Eingaben; der bestehende Editor behält den Submit.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { EventsDetailBasisTab } from './events.detail-basis-tab.js';
import { EventsDetailSettingsTab } from './events.detail-settings-tab.js';
import {
  EventsDateSection,
  useEventsMapCapabilities,
} from './events.detail-content-primary-sections.js';
import {
  EventsAddressSection,
  EventsOrganizerSection,
} from './events.detail-content-location-sections.js';
import {
  EventsDescriptionSection,
  EventsMediaSection,
} from './events.detail-content-secondary-sections.js';
import {
  EventsContactSection,
  EventsLinkSection,
  EventsPriceSection,
} from './events.detail-content-repeater-sections.js';
import { loadEventsContentAssetSnapshot } from './events.detail-media-actions.js';
import type { EventsDetailFormValues } from './events.detail-form.js';
import type { EventsDetailEditorTabs } from './events.detail-editor-tabs.js';
import type { ComponentProps } from 'react';

const hasText = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return value !== null && typeof value === 'object' && Object.values(value).some(hasText);
};

function EventsCreateOptionalFields({
  pt,
  capabilities,
}: Readonly<{
  pt: ComponentProps<typeof EventsDetailEditorTabs>['pt'];
  capabilities: ReturnType<typeof useEventsMapCapabilities>;
}>) {
  const { control } = useFormContext<EventsDetailFormValues>();
  const content = useWatch({ control, name: 'content' });
  const externalId = useWatch({ control, name: 'settings.externalId' });
  const summary = (value: unknown) => pt(hasText(value) ? 'create.filled' : 'create.empty');
  return (
    <>
      <details>
        <summary id="event-create-organizer">
          {pt('create.sections.organizer')} · {pt('create.optional')} ·{' '}
          {summary(content?.organizer)}
        </summary>
        <EventsOrganizerSection pt={pt} capabilities={capabilities} />
      </details>
      <details>
        <summary id="event-create-contacts">
          {pt('create.sections.contacts')} · {pt('create.optional')} · {summary(content?.contacts)}
        </summary>
        <EventsContactSection pt={pt} />
      </details>
      <details>
        <summary id="event-create-links">
          {pt('create.sections.links')} · {pt('create.optional')} · {summary(content?.urls)}
        </summary>
        <EventsLinkSection pt={pt} />
      </details>
      <details>
        <summary id="event-create-prices">
          {pt('create.sections.prices')} · {pt('create.optional')} ·{' '}
          {summary(content?.priceInformations)}
        </summary>
        <EventsPriceSection pt={pt} />
      </details>
      <details>
        <summary id="event-create-technical">
          {pt('create.sections.technical')} · {pt('create.optional')} · {summary(externalId)}
        </summary>
        <EventsDetailSettingsTab pt={pt} section="technical" />
      </details>
    </>
  );
}

export function EventsDetailCreate(props: ComponentProps<typeof EventsDetailEditorTabs>) {
  const { pt } = props;
  const basisProps = { ...props, availableCategories: props.categoryOptions };
  const capabilities = useEventsMapCapabilities();
  return (
    <div className="space-y-6">
      <p>{pt('create.intro')}</p>
      {props.categoryOptionsError ? (
        <p role="status" className="text-sm text-destructive">
          {pt('create.categoryUnavailable')}
        </p>
      ) : null}
      <div id="event-create-title" tabIndex={-1}>
        <EventsDetailBasisTab {...basisProps} section="title" />
      </div>
      <div id="event-create-dates" tabIndex={-1}>
        <EventsDateSection pt={pt} createMode />
      </div>
      <details>
        <summary id="event-create-recurrence">
          {pt('create.sections.recurrence')} · {pt('create.optional')}
        </summary>
        <EventsDetailBasisTab {...basisProps} section="recurrence" />
      </details>
      <div id="event-create-addresses" tabIndex={-1}>
        <EventsAddressSection pt={pt} capabilities={capabilities} createMode />
      </div>
      <div id="event-create-description" tabIndex={-1}>
        <EventsDescriptionSection pt={pt} />
      </div>
      <details>
        <summary id="event-create-media">
          {pt('create.sections.media')} · {pt('create.optional')}
        </summary>
        <EventsMediaSection
          pt={pt}
          mediaUsages={props.mediaUsages}
          onAddManualMedia={props.addManualMedia}
          onChangeMediaUsages={props.onChangeMediaUsages}
          canSelectMedia={props.canSelectMedia}
          canUploadMedia={props.canUploadMedia}
          mediaEditingDisabled={props.mediaEditingDisabled}
          onOpenMediaPicker={props.onOpenMediaPicker}
          onLoadAssetSnapshot={loadEventsContentAssetSnapshot}
        />
      </details>
      <details>
        <summary id="event-create-categories">
          {pt('create.sections.categories')} · {pt('create.optional')}
        </summary>
        <EventsDetailBasisTab {...basisProps} section="categories" />
      </details>
      <EventsCreateOptionalFields pt={pt} capabilities={capabilities} />
      <div id="event-create-publication" tabIndex={-1}>
        <EventsDetailSettingsTab pt={pt} section="publication" />

      </div>
    </div>
  );
}
