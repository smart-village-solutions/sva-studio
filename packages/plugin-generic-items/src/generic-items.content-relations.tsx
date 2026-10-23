import {
  mapAddressesToInput,
  mapLocationsToInput,
  mapContactsToInput,
} from './generic-items.detail-form.write-helpers.js';
import { useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import * as React from 'react';
import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentAddresses } from './generic-items.content-relations-addresses.js';
import { GenericItemsContentContacts } from './generic-items.content-relations-contacts.js';
import { GenericItemsContentLocations } from './generic-items.content-relations-locations.js';

export const GenericItemsContentRelations = ({
  labels,
  createMode = false,
}: Readonly<{
  labels: Record<string, string>;
  createMode?: boolean;
}>) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const addresses = useWatch({ control, name: 'addresses' });
  const locations = useWatch({ control, name: 'locations' });
  const contacts = useWatch({ control, name: 'contacts' });
  const [isGeocodingEnabled, setIsGeocodingEnabled] = React.useState(true);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = React.useState(true);
  const [isMapEnabled, setIsMapEnabled] = React.useState(true);
  const [mapStyleUrl, setMapStyleUrl] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void getHostMapGeocodingConfig()
      .then((config) => {
        if (!active) return;
        setIsGeocodingEnabled(config.geocodeEnabled);
        setIsReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setIsMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setIsGeocodingEnabled(false);
        setIsReverseGeocodingEnabled(false);
        setIsMapEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const config = { isGeocodingEnabled, isReverseGeocodingEnabled, isMapEnabled, mapStyleUrl };
  if (createMode)
    return (
      <div className="space-y-4">
        <GenericItemsDetailCard
          title={labels.addresses}
          collapsible
          invalid={Boolean(errors.addresses)}
          summary={`${labels.optional} (${mapAddressesToInput(addresses).length})`}
        >
          <GenericItemsContentAddresses labels={labels} config={config} />
        </GenericItemsDetailCard>
        <GenericItemsDetailCard
          title={labels.locations}
          collapsible
          invalid={Boolean(errors.locations)}
          summary={`${labels.optional} (${mapLocationsToInput(locations).length})`}
        >
          <GenericItemsContentLocations labels={labels} config={config} />
        </GenericItemsDetailCard>
        <GenericItemsDetailCard
          title={labels.contacts}
          collapsible
          invalid={Boolean(errors.contacts)}
          summary={`${labels.optional} (${mapContactsToInput(contacts).length})`}
        >
          <GenericItemsContentContacts labels={labels} />
        </GenericItemsDetailCard>
      </div>
    );
  return (
    <GenericItemsDetailCard title={labels.relationsTitle} description={labels.relationsDescription}>
      <GenericItemsContentAddresses labels={labels} config={config} />
      <GenericItemsContentContacts labels={labels} />
      <GenericItemsContentLocations labels={labels} config={config} />
    </GenericItemsDetailCard>
  );
};
