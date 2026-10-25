import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, StudioField } from '@sva/studio-ui-react';
import type { VoucherDraft } from './vouchers.form-model.js';
export type VoucherFormProps = Readonly<{
  draft: VoucherDraft;
  edit: boolean;
  canPublish: boolean;
  errors: readonly string[];
  locations: readonly {
    id: string;
    name: string;
  }[];
  categories: readonly {
    id: string;
    name: string;
  }[];
  hasMoreLocations: boolean;
  loadMoreLocations: () => void;
  discountChosen: boolean;
  chooseDiscount: () => void;
  change: <K extends keyof VoucherDraft>(key: K, value: VoucherDraft[K]) => void;
}>;
export function useVoucherFormFields({ draft, errors, change }: VoucherFormProps) {
  const t = usePluginTranslation('vouchers');
  const section = (id: string, children: ReactNode) => (
    <section id={`voucher-section-${id}`} className="space-y-4 border-b border-border pb-6">
      <h2 className="text-lg font-semibold">{t(`sections.${id}`)}</h2>
      {children}
    </section>
  );
  const field = (key: string, child: ReactNode, required = false, description?: string) => (
    <StudioField
      id={`voucher-${key}`}
      label={t(`fields.${key}`)}
      required={required}
      description={description}
      error={errors.includes(key) ? t('messages.invalid') : undefined}
    >
      {child}
    </StudioField>
  );
  const text = (
    key:
      | 'title'
      | 'teaser'
      | 'discountValue'
      | 'originalPrice'
      | 'maxQuantity'
      | 'maxPerPerson'
      | 'dateStart'
      | 'dateEnd',
    type = 'text',
    required = false
  ) => (
    <Input
      id={`voucher-${key}`}
      type={type}
      required={required}
      value={draft[key] ?? ''}
      aria-invalid={errors.includes(key)}
      onChange={(event) => change(key, event.target.value)}
      inputMode={
        ['discountValue', 'originalPrice'].includes(key)
          ? 'decimal'
          : ['maxQuantity', 'maxPerPerson'].includes(key)
            ? 'numeric'
            : undefined
      }
    />
  );
  return { t, section, field, text };
}
