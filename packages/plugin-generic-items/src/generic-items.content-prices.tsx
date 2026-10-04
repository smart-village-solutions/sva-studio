import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

import {
  PriceAgeFields,
  PriceAdultFields,
  PriceChildrenFields,
  type PriceFieldsProps,
} from './generic-items.content-price-limits.js';

const PriceIdentityFields = ({ labels, index, priceInformation }: PriceFieldsProps) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <StudioFieldGroup columns={2}>
      <StudioField id={`generic-item-price-name-${index}`} label={labels.priceName}>
        <Input
          id={`generic-item-price-name-${index}`}
          value={priceInformation.name}
          onChange={(event) =>
            setValue(`priceInformations.${index}.name`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <StudioField id={`generic-item-price-category-${index}`} label={labels.priceCategory}>
        <Input
          id={`generic-item-price-category-${index}`}
          value={priceInformation.category}
          onChange={(event) =>
            setValue(`priceInformations.${index}.category`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
    </StudioFieldGroup>
  );
};

const PriceAmountFields = ({ labels, index, priceInformation }: PriceFieldsProps) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <StudioFieldGroup columns={2}>
      <StudioField id={`generic-item-price-amount-${index}`} label={labels.priceAmount}>
        <Input
          id={`generic-item-price-amount-${index}`}
          type="number"
          value={priceInformation.amount}
          onChange={(event) =>
            setValue(`priceInformations.${index}.amount`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <StudioField id={`generic-item-price-group-${index}`} label={labels.groupPrice}>
        <Checkbox
          id={`generic-item-price-group-${index}`}
          checked={priceInformation.groupPrice}
          onChange={(event) =>
            setValue(`priceInformations.${index}.groupPrice`, event.currentTarget.checked, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
    </StudioFieldGroup>
  );
};

const PriceDescriptionField = ({ labels, index, priceInformation }: PriceFieldsProps) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <StudioField id={`generic-item-price-description-${index}`} label={labels.priceDescription}>
      <Input
        id={`generic-item-price-description-${index}`}
        value={priceInformation.description}
        onChange={(event) =>
          setValue(`priceInformations.${index}.description`, event.target.value, {
            shouldDirty: true,
          })
        }
      />
    </StudioField>
  );
};

const PriceRow = ({
  labels,
  index,
  priceInformation,
  canRemove,
  onRemove,
}: PriceFieldsProps & Readonly<{ canRemove: boolean; onRemove: () => void }>) => (
  <div className="space-y-4 rounded-xl border border-border/60 p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-foreground">{labels.priceInformationItem}</p>
      {canRemove ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => onRemove()}>
          {labels.remove}
        </Button>
      ) : null}
    </div>
    <PriceIdentityFields labels={labels} index={index} priceInformation={priceInformation} />
    <PriceAmountFields labels={labels} index={index} priceInformation={priceInformation} />
    <PriceAgeFields labels={labels} index={index} priceInformation={priceInformation} />
    <PriceAdultFields labels={labels} index={index} priceInformation={priceInformation} />
    <PriceChildrenFields labels={labels} index={index} priceInformation={priceInformation} />
    <PriceDescriptionField labels={labels} index={index} priceInformation={priceInformation} />
  </div>
);

export const GenericItemsContentPrices = ({
  labels,
}: Readonly<{ labels: Record<string, string> }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const priceInformationsArray = useFieldArray({ control, name: 'priceInformations' });
  const priceInformations = useWatch({ control, name: 'priceInformations' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.priceInformations}</p>
          <p className="text-sm text-muted-foreground">{labels.priceInformationsHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            priceInformationsArray.append({
              name: '',
              amount: '',
              groupPrice: false,
              ageFrom: '',
              ageTo: '',
              minAdultCount: '',
              maxAdultCount: '',
              minChildrenCount: '',
              maxChildrenCount: '',
              description: '',
              category: '',
            })
          }
        >
          {labels.addPriceInformation}
        </Button>
      </div>
      {priceInformations.map((priceInformation, index) => (
        <PriceRow
          key={priceInformationsArray.fields[index]?.id ?? `fallback-price-information-${index}`}
          labels={labels}
          index={index}
          priceInformation={priceInformation}
          canRemove={priceInformations.length > 1}
          onRemove={() => priceInformationsArray.remove(index)}
        />
      ))}
    </div>
  );
};
