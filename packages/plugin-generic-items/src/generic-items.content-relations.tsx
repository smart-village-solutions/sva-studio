import * as React from 'react';
import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentAddresses } from './generic-items.content-relations-addresses.js';
import { GenericItemsContentContacts } from './generic-items.content-relations-contacts.js';
import { GenericItemsContentLocations } from './generic-items.content-relations-locations.js';

export const GenericItemsContentRelations = ({
  labels,
}: Readonly<{
  labels: Record<string, string>;
}>) => {
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
  return (
    <GenericItemsDetailCard title={labels.relationsTitle} description={labels.relationsDescription}>
      <GenericItemsContentAddresses labels={labels} config={config} />
      <GenericItemsContentContacts labels={labels} />
      <GenericItemsContentLocations labels={labels} config={config} />
    </GenericItemsDetailCard>
  );
};
