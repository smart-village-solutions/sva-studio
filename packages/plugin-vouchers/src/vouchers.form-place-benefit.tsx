import { SearchableSelect, Select } from '@sva/studio-ui-react';
import { useVoucherFormFields, type VoucherFormProps } from './vouchers.form-fields.js';
import type { VoucherDraft } from './vouchers.form-model.js';
export function VoucherLocationFields(props: VoucherFormProps) {
  const { t, section, field } = useVoucherFormFields(props);
  const options = [...props.locations]
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true })
    )
    .map((item) => ({ value: item.id, label: item.name }));
  return section(
    'location',
    <>
      {field(
        'location',
        <SearchableSelect
          id="voucher-location"
          label={t('fields.location')}
          showLabel={false}
          disabled={props.edit}
          value={props.draft.pointOfInterestIds[0] ?? ''}
          ariaInvalid={props.errors.includes('location')}
          placeholder={t('values.choose')}
          searchPlaceholder={t('fields.locationSearch')}
          emptyText={t(
            props.locationsLoading ? 'messages.loadingLocations' : 'fields.locationsEmpty'
          )}
          options={options}
          onValueChange={(value) => props.change('pointOfInterestIds', value ? [value] : [])}
        />,
        true,
        t('help.location')
      )}
      {props.locationsLoading ? (
        <p role="status">{t('messages.loadingLocations')}</p>
      ) : !props.locations.length ? (
        <p role="status">{t('help.noLocations')}</p>
      ) : null}
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
