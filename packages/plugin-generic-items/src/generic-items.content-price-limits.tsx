import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFormContext } from 'react-hook-form';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

export type PriceFieldsProps = Readonly<{
  labels: Record<string, string>;
  index: number;
  priceInformation: GenericItemsDetailFormValues['priceInformations'][number];
}>;

export const PriceAgeFields = ({ labels, index, priceInformation }: PriceFieldsProps) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <StudioFieldGroup columns={2}>
      <StudioField id={`generic-item-price-age-from-${index}`} label={labels.ageFrom}>
        <Input
          id={`generic-item-price-age-from-${index}`}
          type="number"
          value={priceInformation.ageFrom}
          onChange={(event) =>
            setValue(`priceInformations.${index}.ageFrom`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <StudioField id={`generic-item-price-age-to-${index}`} label={labels.ageTo}>
        <Input
          id={`generic-item-price-age-to-${index}`}
          type="number"
          value={priceInformation.ageTo}
          onChange={(event) =>
            setValue(`priceInformations.${index}.ageTo`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
    </StudioFieldGroup>
  );
};

export const PriceAdultFields = ({ labels, index, priceInformation }: PriceFieldsProps) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <StudioFieldGroup columns={2}>
      <StudioField id={`generic-item-price-min-adults-${index}`} label={labels.minAdultCount}>
        <Input
          id={`generic-item-price-min-adults-${index}`}
          type="number"
          value={priceInformation.minAdultCount}
          onChange={(event) =>
            setValue(`priceInformations.${index}.minAdultCount`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <StudioField id={`generic-item-price-max-adults-${index}`} label={labels.maxAdultCount}>
        <Input
          id={`generic-item-price-max-adults-${index}`}
          type="number"
          value={priceInformation.maxAdultCount}
          onChange={(event) =>
            setValue(`priceInformations.${index}.maxAdultCount`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
    </StudioFieldGroup>
  );
};

export const PriceChildrenFields = ({ labels, index, priceInformation }: PriceFieldsProps) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <StudioFieldGroup columns={2}>
      <StudioField id={`generic-item-price-min-children-${index}`} label={labels.minChildrenCount}>
        <Input
          id={`generic-item-price-min-children-${index}`}
          type="number"
          value={priceInformation.minChildrenCount}
          onChange={(event) =>
            setValue(`priceInformations.${index}.minChildrenCount`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
      <StudioField id={`generic-item-price-max-children-${index}`} label={labels.maxChildrenCount}>
        <Input
          id={`generic-item-price-max-children-${index}`}
          type="number"
          value={priceInformation.maxChildrenCount}
          onChange={(event) =>
            setValue(`priceInformations.${index}.maxChildrenCount`, event.target.value, {
              shouldDirty: true,
            })
          }
        />
      </StudioField>
    </StudioFieldGroup>
  );
};
