import { useState } from 'react';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';
import { useVoucherFormFields, type VoucherFormProps } from './vouchers.form-fields.js';
import type { VoucherDraft } from './vouchers.form-model.js';
export function VoucherLocationFields(props: VoucherFormProps) {
  const { t, section, field } = useVoucherFormFields(props);
  const [locationSearch, setLocationSearch] = useState('');
  const matchingLocations = props.locations.filter(
    (item) =>
      item.id === props.draft.pointOfInterestIds[0] ||
      item.name.toLocaleLowerCase().includes(locationSearch.toLocaleLowerCase())
  );
  return section(
    'location',
    <>
      {!props.edit && (
        <StudioField id="voucher-location-search" label={t('fields.search')}>
          <Input
            id="voucher-location-search"
            type="search"
            value={locationSearch}
            onChange={(event) => setLocationSearch(event.target.value)}
          />
        </StudioField>
      )}
      {field(
        'location',
        <Select
          id="voucher-location"
          required
          disabled={props.edit}
          value={props.draft.pointOfInterestIds[0] ?? ''}
          aria-invalid={props.errors.includes('location')}
          onChange={(event) =>
            props.change('pointOfInterestIds', event.target.value ? [event.target.value] : [])
          }
        >
          <option value="">{t('values.choose')}</option>
          {matchingLocations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>,
        true,
        t('help.location')
      )}
      {!props.locations.length && <p role="status">{t('help.noLocations')}</p>}
      {props.hasMoreLocations && (
        <Button type="button" variant="secondary" onClick={props.loadMoreLocations}>
          {t('actions.next')}
        </Button>
      )}
      <p className="text-sm text-muted-foreground">{t('confirmation.hint')}</p>
    </>
  );
}
export function VoucherDiscountFields(props: VoucherFormProps) {
  const { t, section, field, text } = useVoucherFormFields(props);
  return section(
    'discount',
    <>
      {field(
        'discountMode',
        <Select
          id="voucher-discountMode"
          required
          value={props.discountChosen ? props.draft.discountMode : ''}
          onChange={(event) => {
            props.chooseDiscount();
            props.change('discountMode', event.target.value as VoucherDraft['discountMode']);
          }}
        >
          <option value="">{t('values.choose')}</option>
          {(['percentage', 'amount', 'price'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`values.${value}`)}
            </option>
          ))}
        </Select>,
        true
      )}
      {props.draft.discountMode === 'price' &&
        field('originalPrice', text('originalPrice', 'text', true), true)}
      {field(
        'discountValue',
        text('discountValue', 'text', true),
        true,
        t(
          props.draft.discountMode === 'percentage'
            ? 'help.percentage'
            : props.draft.discountMode === 'amount'
              ? 'help.amount'
              : 'help.reducedPrice'
        )
      )}
      <p className="text-sm text-muted-foreground">{t('help.price')}</p>
    </>
  );
}
