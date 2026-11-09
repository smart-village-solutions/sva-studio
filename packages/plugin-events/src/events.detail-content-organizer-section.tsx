import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { StudioDetailCard, StudioFieldGroup } from '@sva/studio-ui-react';

import {
  createDefaultAddress,
  createDefaultContact,
  createDefaultOrganizer,
  type EventOrganizerFormValue,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import {
  ContentInput,
  optionalText,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';
import {
  dirty,
  type LocationSectionProps,
  type SetValue,
} from './events.detail-content-location-sections.js';
import {
  hasEventOrganizerAddressContent,
  hasEventOrganizerContent,
} from './events.detail-form-structured-serializers.js';
import { EventsGeoAddressFields } from './events.geo-address-fields.js';

const normalizeOrganizer = (organizer: EventOrganizerFormValue) => {
  const address = organizer.address ?? createDefaultAddress();
  return {
    address,
    contact: organizer.contact ?? createDefaultContact(),
    geoLocation: address.geoLocation ?? { latitude: '', longitude: '' },
  };
};

function OrganizerContactFields({
  organizer,
  nameError,
  nameRequired,
  pt,
  setValue,
}: Readonly<{
  organizer: EventOrganizerFormValue;
  nameError?: string;
  nameRequired: boolean;
  pt: Translator;
  setValue: SetValue;
}>) {
  const contact = organizer.contact ?? createDefaultContact();
  const update = (key: 'email' | 'phone', value: string) =>
    setValue('content.organizer.contact', { ...(organizer.contact ?? {}), [key]: value }, dirty);
  return (
    <>
      <ContentInput
        id="event-organizer-name"
        label={pt('fields.organizerName')}
        value={organizer.name}
        ariaInvalid={nameError ? true : undefined}
        description={pt('fields.organizerNameHelp')}
        error={nameError}
        required={nameRequired}
        onChange={(value) => setValue('content.organizer.name', value, dirty)}
      />
      <StudioFieldGroup columns={2}>
        <ContentInput
          id="event-organizer-email"
          label={pt('fields.email')}
          value={contact.email}
          onChange={(value) => update('email', value)}
        />
        <ContentInput
          id="event-organizer-phone"
          label={pt('fields.phone')}
          value={contact.phone}
          onChange={(value) => update('phone', value)}
        />
      </StudioFieldGroup>
    </>
  );
}

export function EventsOrganizerSection({ capabilities, pt }: LocationSectionProps) {
  const {
    control,
    clearErrors,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const organizer = useWatch({ control, name: 'content.organizer' }) ?? createDefaultOrganizer();
  const { address, geoLocation } = normalizeOrganizer(organizer);
  const organizerErrors = errors.content?.organizer?.address?.geoLocation;
  const organizerNameError = errors.content?.organizer?.name;
  const organizerHasContent = hasEventOrganizerContent(organizer);
  const organizerNameMissing = organizerHasContent && (organizer.name ?? '').trim().length === 0;
  const [addressOpen, setAddressOpen] = useState(() => hasEventOrganizerAddressContent(organizer));
  const path = 'content.organizer.address' as const;

  useEffect(() => {
    if (!organizerNameMissing) {
      clearErrors('content.organizer.name');
    }
  }, [clearErrors, organizerNameMissing]);

  return (
    <StudioDetailCard
      title={pt('cards.content.organizer.title')}
      description={pt('organizer.description')}
    >
      <OrganizerContactFields
        organizer={organizer}
        nameError={organizerNameError ? pt('validation.organizerName') : undefined}
        nameRequired={organizerHasContent}
        pt={pt}
        setValue={setValue}
      />
      <details
        className="space-y-4"
        open={addressOpen}
        onToggle={(event) => setAddressOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          {pt('organizer.address')} · {pt('create.optional')}
        </summary>
        <p className="text-sm text-muted-foreground">{pt('organizer.addressHelp')}</p>
        <EventsGeoAddressFields
          pt={pt}
          addition={optionalText(address.addition)}
          additionId="event-organizer-addition"
          city={optionalText(address.city)}
          cityId="event-organizer-city"
          geocodingEnabled={capabilities.geocodingEnabled}
          mapEnabled={capabilities.mapEnabled}
          mapStyleUrl={capabilities.mapStyleUrl}
          latitude={optionalText(geoLocation.latitude)}
          latitudeError={organizerErrors?.latitude ? pt('validation.geoLocation') : undefined}
          latitudeId="event-organizer-latitude"
          longitude={optionalText(geoLocation.longitude)}
          longitudeError={organizerErrors?.longitude ? pt('validation.geoLocation') : undefined}
          longitudeId="event-organizer-longitude"
          reverseGeocodingEnabled={capabilities.reverseGeocodingEnabled}
          street={optionalText(address.street)}
          streetId="event-organizer-street"
          zip={optionalText(address.zip)}
          zipId="event-organizer-zip"
          onAdditionChange={(value) => setValue(`${path}.addition`, value, dirty)}
          onCityChange={(value) => setValue(`${path}.city`, value, dirty)}
          onCoordinatesChange={({ latitude, longitude }) => {
            setValue(`${path}.geoLocation.latitude`, latitude, dirty);
            setValue(`${path}.geoLocation.longitude`, longitude, dirty);
          }}
          onLatitudeChange={(value) => setValue(`${path}.geoLocation.latitude`, value, dirty)}
          onLongitudeChange={(value) => setValue(`${path}.geoLocation.longitude`, value, dirty)}
          onStreetChange={(value) => setValue(`${path}.street`, value, dirty)}
          onZipChange={(value) => setValue(`${path}.zip`, value, dirty)}
        />
      </details>
    </StudioDetailCard>
  );
}
