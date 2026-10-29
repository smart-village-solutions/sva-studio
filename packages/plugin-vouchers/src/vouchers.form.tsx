import type { VoucherFormProps } from './vouchers.form-fields.js';
import { VoucherBasicsFields } from './vouchers.form-basics.js';
import { VoucherLocationFields, VoucherDiscountFields } from './vouchers.form-place-benefit.js';
import {
  VoucherQuotaFields,
  VoucherDateFields,
  VoucherSaveSummary,
} from './vouchers.form-conditions.js';
export function VoucherFormSections(props: VoucherFormProps) {
  return (
    <>
      <VoucherBasicsFields {...props} />
      <VoucherLocationFields {...props} />
      <VoucherDiscountFields {...props} />
      <VoucherQuotaFields {...props} />
      <VoucherDateFields {...props} />
      <VoucherSaveSummary {...props} />
    </>
  );
}
