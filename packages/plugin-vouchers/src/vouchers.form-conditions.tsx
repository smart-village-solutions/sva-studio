import { Select } from '@sva/studio-ui-react';
import { useVoucherFormFields, type VoucherFormProps } from './vouchers.form-fields.js';
import type { VoucherDraft } from './vouchers.form-model.js';
export function VoucherQuotaFields(props: VoucherFormProps) {
  const { t, section, field, text } = useVoucherFormFields(props);
  return section(
    'quota',
    <>
      {field(
        'frequency',
        <Select
          id="voucher-frequency"
          required
          aria-invalid={props.errors.includes('frequency')}
          value={props.draft.frequency}
          onChange={(event) =>
            props.change('frequency', event.target.value as VoucherDraft['frequency'])
          }
        >
          <option value="">{t('values.choose')}</option>
          {(['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`values.${value}`)}
            </option>
          ))}
        </Select>
      )}
      <p className="text-sm text-muted-foreground">{t('help.quota')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('maxQuantity', text('maxQuantity', 'text', true), true)}
        {field('maxPerPerson', text('maxPerPerson'))}
      </div>
      <p className="text-sm">
        {props.draft.maxPerPerson
          ? t('usage.person', { maximum: props.draft.maxPerPerson })
          : t('help.noPersonLimit')}
      </p>
      <p className="text-sm">{t(`usage.period.${props.draft.frequency || 'unknown'}`)}</p>
      {props.draft.maxQuantity && (
        <p className="text-sm" role="status">
          {t('help.quotaSummary', {
            maximum: props.draft.maxQuantity,
            period: t(`usage.period.${props.draft.frequency || 'unknown'}`),
          })}
        </p>
      )}
      {Number(props.draft.maxPerPerson) > Number(props.draft.maxQuantity) &&
        props.draft.maxQuantity && <p className="text-sm">{t('help.personAboveTotal')}</p>}
    </>
  );
}
export function VoucherDateFields(props: VoucherFormProps) {
  const { t, section, field, text } = useVoucherFormFields(props);
  return section(
    'dates',
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('dateStart', text('dateStart', 'date'))}
        {field('dateEnd', text('dateEnd', 'date'))}
      </div>
      <p className="text-sm text-muted-foreground">{t('help.dates')}</p>
    </>
  );
}
export function VoucherSaveSummary(props: VoucherFormProps) {
  const { t, section, field } = useVoucherFormFields(props);
  return section(
    'save',
    <>
      {!props.edit &&
        field(
          'visible',
          <Select
            id="voucher-visible"
            value={String(props.draft.visible)}
            onChange={(event) => props.change('visible', event.target.value === 'true')}
          >
            <option value="false">{t('values.hidden')}</option>
            {props.canPublish && <option value="true">{t('values.visible')}</option>}
          </Select>,
          false,
          t('help.visibility')
        )}
      <h3 className="font-medium">{t('sections.summary')}</h3>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {(
          [
            ['title', props.draft.title, 'basics'],
            [
              'location',
              props.locations.find((item) => item.id === props.draft.pointOfInterestIds[0])?.name ??
                '',
              'location',
            ],
            [
              'discountValue',
              `${t(`values.${props.draft.discountMode}`)}: ${props.draft.discountValue}`,
              'discount',
            ],
            [
              'maxQuantity',
              `${props.draft.maxQuantity} · ${t(`values.${props.draft.frequency}`)}`,
              'quota',
            ],
            ['dateStart', props.draft.dateStart ?? '', 'dates'],
            ['dateEnd', props.draft.dateEnd ?? '', 'dates'],
            ['visible', t(props.draft.visible ? 'values.visible' : 'values.hidden'), 'save'],
          ] as const
        ).map(([key, value, id]) => (
          <div key={key}>
            <dt>
              <a className="underline" href={`#voucher-section-${id}`}>
                {t(`fields.${key}`)}
              </a>
            </dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
