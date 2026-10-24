/**
 * Komponiert die Neuanlage für Veranstaltungen als durchgehendes Formular.
 * Bestehende Feldabschnitte verwalten ihre Eingaben; der bestehende Editor behält den Submit.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { StudioSection } from '@sva/studio-ui-react';
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

function EventsCreateNavigation({ pt }: Pick<ComponentProps<typeof EventsDetailEditorTabs>, 'pt'>) {
  const nav = [
    'title',
    'dates',
    'recurrence',
    'addresses',
    'description',
    'media',
    'categories',
    'organizer',
    'contacts',
    'links',
    'prices',
    'technical',
    'publication',
  ] as const;
  return (
    <nav aria-label={pt('create.navigation')} className="flex flex-wrap gap-3">
      {nav.map((id) => (
        <a
          key={id}
          href={`#event-create-${id}`}
          onClick={(event) => {
            const target = event.currentTarget.ownerDocument.getElementById(`event-create-${id}`);
            if (!target) return;
            event.preventDefault();
            target.focus();
            target.scrollIntoView?.({ block: 'start' });
          }}
        >
          {pt(`create.sections.${id}`)}
        </a>
      ))}
    </nav>
  );
}

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
  const { control } = useFormContext<EventsDetailFormValues>();
  const visible = useWatch({ control, name: 'settings.visible' });
  const basisProps = { ...props, availableCategories: props.categoryOptions };
  const capabilities = useEventsMapCapabilities();
  return (
    <div className="space-y-6">
      <p>{pt('create.intro')}</p>
      <EventsCreateNavigation pt={pt} />
      <div id="event-create-title" tabIndex={-1}>
        <EventsDetailBasisTab {...basisProps} section="title" />
      </div>
      <div id="event-create-dates" tabIndex={-1}>
        <EventsDateSection pt={pt} />
      </div>
      <div id="event-create-recurrence" tabIndex={-1}>
        <EventsDetailBasisTab {...basisProps} section="recurrence" />
      </div>
      <div id="event-create-addresses" tabIndex={-1}>
        <EventsAddressSection pt={pt} capabilities={capabilities} />
      </div>
      <div id="event-create-description" tabIndex={-1}>
        <EventsDescriptionSection pt={pt} />
      </div>
      <div id="event-create-media" tabIndex={-1}>
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
      </div>
      <div id="event-create-categories" tabIndex={-1}>
        <EventsDetailBasisTab {...basisProps} section="categories" />
      </div>
      <EventsCreateOptionalFields pt={pt} capabilities={capabilities} />
      <div id="event-create-publication" tabIndex={-1}>
        <EventsDetailSettingsTab pt={pt} section="publication" />
        <StudioSection description={pt(visible ? 'create.visibleEffect' : 'create.hiddenEffect')}>
          <p>{pt('create.editHint')}</p>
        </StudioSection>
      </div>
    </div>
  );
}
