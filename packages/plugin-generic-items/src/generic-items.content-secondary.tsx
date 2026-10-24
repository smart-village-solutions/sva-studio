import {
  mapPriceInformationsToInput,
  mapAccessibilityInformationsToInput,
} from './generic-items.detail-form.write-helpers.js';
import { useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';
import { GenericItemsContentAccessibility } from './generic-items.content-accessibility.js';
import { GenericItemsContentPrices } from './generic-items.content-prices.js';

export const GenericItemsContentSecondary = ({
  labels,
  createMode = false,
}: Readonly<{ labels: Record<string, string>; createMode?: boolean }>) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const prices = useWatch({ control, name: 'priceInformations' });
  const accessibility = useWatch({ control, name: 'accessibilityInformations' });
  return createMode ? (
    <div className="space-y-4">
      <GenericItemsDetailCard
        title={labels.priceInformations}
        collapsible
        invalid={Boolean(errors.priceInformations)}
        summary={`${labels.optional} (${mapPriceInformationsToInput(prices).length})`}
      >
        <GenericItemsContentPrices labels={labels} />
      </GenericItemsDetailCard>
      <GenericItemsDetailCard
        title={labels.accessibilityInformations}
        collapsible
        invalid={Boolean(errors.accessibilityInformations)}
        summary={`${labels.optional} (${mapAccessibilityInformationsToInput(accessibility).length})`}
      >
        <GenericItemsContentAccessibility labels={labels} />
      </GenericItemsDetailCard>
    </div>
  ) : (
    <GenericItemsDetailCard title={labels.secondaryTitle} description={labels.secondaryDescription}>
      <GenericItemsContentAccessibility labels={labels} />
      <GenericItemsContentPrices labels={labels} />
    </GenericItemsDetailCard>
  );
};
