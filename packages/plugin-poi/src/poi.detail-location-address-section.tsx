import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';

type PoiDetailLocationAddressSectionProps = Readonly<{
  pt: (key: string) => string;
  street: string;
  zip: string;
  city: string;
  locationName: string;
  onStreetChange: (value: string) => void;
  onZipChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onLocationNameChange: (value: string) => void;
}>;

export function PoiDetailLocationAddressSection({
  pt,
  street,
  zip,
  city,
  locationName,
  onStreetChange,
  onZipChange,
  onCityChange,
  onLocationNameChange,
}: PoiDetailLocationAddressSectionProps) {
  return (
    <PoiDetailSectionCard title={pt('cards.location.address.title')} description={pt('cards.location.address.description')}>
      <StudioFieldGroup columns={2}>
        <StudioField id="poi-street" label={pt('fields.street')}>
          <Input id="poi-street" value={street} onChange={(event) => onStreetChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-zip" label={pt('fields.zip')}>
          <Input id="poi-zip" value={zip} onChange={(event) => onZipChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-city" label={pt('fields.city')}>
          <Input id="poi-city" value={city} onChange={(event) => onCityChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-location-name" label={pt('fields.locationName')}>
          <Input id="poi-location-name" value={locationName} onChange={(event) => onLocationNameChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
    </PoiDetailSectionCard>
  );
}
