import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentAccessibility } from './generic-items.content-accessibility.js';
import { GenericItemsContentPrices } from './generic-items.content-prices.js';

export const GenericItemsContentSecondary = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => (
  <GenericItemsDetailCard title={labels.secondaryTitle} description={labels.secondaryDescription}>
    <GenericItemsContentAccessibility labels={labels} />
    <GenericItemsContentPrices labels={labels} />
  </GenericItemsDetailCard>
);
