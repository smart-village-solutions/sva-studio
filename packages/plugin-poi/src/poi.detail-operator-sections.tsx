import {
  Alert,
  AlertDescription,
  Button,
  Input,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';

import type { PoiDetailOperatorController } from './poi.detail-operator-controller.js';
import type {
  PoiOperatorFieldValues,
  PoiOperatorTextFieldPath,
} from './poi.detail-operator-shared.js';

type Translate = (key: string) => string;

type TextFieldDefinition = Readonly<{
  id: string;
  labelKey: string;
  path: PoiOperatorTextFieldPath;
  valueKey: keyof PoiOperatorFieldValues;
}>;

const CONTACT_FIELDS = [
  {
    id: 'poi-operator-name',
    labelKey: 'fields.operatorName',
    path: 'content.operator.name',
    valueKey: 'name',
  },
  {
    id: 'poi-operator-email',
    labelKey: 'fields.email',
    path: 'content.operator.contact.email',
    valueKey: 'email',
  },
  {
    id: 'poi-operator-contact-first-name',
    labelKey: 'fields.firstName',
    path: 'content.operator.contact.firstName',
    valueKey: 'firstName',
  },
  {
    id: 'poi-operator-contact-last-name',
    labelKey: 'fields.lastName',
    path: 'content.operator.contact.lastName',
    valueKey: 'lastName',
  },
  {
    id: 'poi-operator-phone',
    labelKey: 'fields.phone',
    path: 'content.operator.contact.phone',
    valueKey: 'phone',
  },
  {
    id: 'poi-operator-fax',
    labelKey: 'fields.fax',
    path: 'content.operator.contact.fax',
    valueKey: 'fax',
  },
] as const satisfies readonly TextFieldDefinition[];

const ADDRESS_FIELDS = [
  {
    id: 'poi-operator-location-name',
    labelKey: 'fields.locationName',
    path: 'content.operator.address.addition',
    valueKey: 'locationName',
  },
  {
    id: 'poi-operator-street',
    labelKey: 'fields.street',
    path: 'content.operator.address.street',
    valueKey: 'street',
  },
  {
    id: 'poi-operator-zip',
    labelKey: 'fields.zip',
    path: 'content.operator.address.zip',
    valueKey: 'zip',
  },
  {
    id: 'poi-operator-city',
    labelKey: 'fields.city',
    path: 'content.operator.address.city',
    valueKey: 'city',
  },
] as const satisfies readonly TextFieldDefinition[];

type OperatorTextFieldsProps = Pick<PoiDetailOperatorController, 'setTextValue' | 'values'> &
  Readonly<{ fields: readonly TextFieldDefinition[]; pt: Translate }>;

function OperatorTextFields({ fields, pt, setTextValue, values }: OperatorTextFieldsProps) {
  return fields.map((field) => (
    <StudioField key={field.id} id={field.id} label={pt(field.labelKey)}>
      <Input
        id={field.id}
        value={values[field.valueKey]}
        onChange={(event) => setTextValue(field.path, event.target.value)}
      />
    </StudioField>
  ));
}

export function PoiDetailOperatorContactFields({
  pt,
  setTextValue,
  updateWebUrl,
  urlError,
  values,
}: Pick<PoiDetailOperatorController, 'setTextValue' | 'updateWebUrl' | 'urlError' | 'values'> &
  Readonly<{ pt: Translate }>) {
  return (
    <StudioFieldGroup columns={2}>
      <OperatorTextFields
        fields={CONTACT_FIELDS}
        pt={pt}
        setTextValue={setTextValue}
        values={values}
      />
      <StudioField
        id="poi-operator-url"
        label={pt('fields.url')}
        error={urlError ? pt('validation.webUrls') : undefined}
        errorId="poi-operator-url-error"
      >
        <Input
          id="poi-operator-url"
          aria-describedby={urlError ? 'poi-operator-url-error' : undefined}
          aria-invalid={urlError ? true : undefined}
          value={values.webUrl}
          onChange={(event) => updateWebUrl({ url: event.target.value })}
        />
      </StudioField>
      <StudioField id="poi-operator-url-description" label={pt('fields.urlDescription')}>
        <Input
          id="poi-operator-url-description"
          value={values.webUrlDescription}
          onChange={(event) => updateWebUrl({ description: event.target.value })}
        />
      </StudioField>
    </StudioFieldGroup>
  );
}

export function PoiDetailOperatorAddressFields({
  pt,
  setTextValue,
  values,
}: Pick<PoiDetailOperatorController, 'setTextValue' | 'values'> & Readonly<{ pt: Translate }>) {
  return (
    <StudioFieldGroup columns={2}>
      <OperatorTextFields
        fields={ADDRESS_FIELDS}
        pt={pt}
        setTextValue={setTextValue}
        values={values}
      />
    </StudioFieldGroup>
  );
}

export function PoiDetailOperatorGeocodingControls({
  error,
  geocode,
  geocoding,
  hasGeocodingInput,
  hasReverseGeocodingInput,
  pt,
  reverseGeocode,
  reverseGeocoding,
}: Pick<
  PoiDetailOperatorController,
  | 'error'
  | 'geocode'
  | 'geocoding'
  | 'hasGeocodingInput'
  | 'hasReverseGeocodingInput'
  | 'reverseGeocode'
  | 'reverseGeocoding'
> &
  Readonly<{ pt: Translate }>) {
  if (!hasGeocodingInput && !hasReverseGeocodingInput) return null;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void geocode()}
          disabled={geocoding}
        >
          {geocoding ? pt('actions.geocodingAddress') : pt('actions.geocodeAddress')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void reverseGeocode()}
          disabled={reverseGeocoding || !hasReverseGeocodingInput}
        >
          {reverseGeocoding
            ? pt('actions.reverseGeocodingAddress')
            : pt('actions.reverseGeocodeAddress')}
        </Button>
      </div>
      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
