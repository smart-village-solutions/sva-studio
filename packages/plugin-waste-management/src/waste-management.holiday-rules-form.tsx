import { useEffect, useState } from 'react';
import type { WasteHolidayRuleRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Select } from '@sva/studio-ui-react';

export const WasteHolidayRuleForm = ({
  rule,
  saving,
  onSave,
}: {
  readonly rule: WasteHolidayRuleRecord;
  readonly saving: boolean;
  readonly onSave: (input: {
    readonly scope?: WasteHolidayRuleRecord['scope'];
    readonly strategy?: WasteHolidayRuleRecord['strategy'];
  }) => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [scope, setScope] = useState<WasteHolidayRuleRecord['scope'] | ''>(rule.scope ?? '');
  const [strategy, setStrategy] = useState<WasteHolidayRuleRecord['strategy'] | ''>(rule.strategy ?? '');

  useEffect(() => {
    setScope(rule.scope ?? '');
    setStrategy(rule.strategy ?? '');
  }, [rule.id, rule.scope, rule.strategy]);

  return (
    <div className="grid gap-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <span className="font-medium">{pt('scheduling.holidayRules.scopeLabel')}</span>
        <Select
          value={scope}
          aria-label={pt('scheduling.holidayRules.scopeLabel')}
          onChange={(event) => setScope(event.target.value as WasteHolidayRuleRecord['scope'] | '')}
        >
          <option value="">{pt('scheduling.holidayRules.scopeUnset')}</option>
          <option value="holiday-only">{pt('scheduling.holidayRules.scopeOptions.holidayOnly')}</option>
          <option value="full-week">{pt('scheduling.holidayRules.scopeOptions.fullWeek')}</option>
        </Select>
      </div>
      <div>
        <span className="font-medium">{pt('scheduling.holidayRules.strategyLabel')}</span>
        <Select
          value={strategy}
          aria-label={pt('scheduling.holidayRules.strategyLabel')}
          onChange={(event) => setStrategy(event.target.value as WasteHolidayRuleRecord['strategy'] | '')}
        >
          <option value="">{pt('scheduling.holidayRules.strategyUnset')}</option>
          <option value="advance">{pt('scheduling.holidayRules.strategyOptions.advance')}</option>
          <option value="postpone">{pt('scheduling.holidayRules.strategyOptions.postpone')}</option>
        </Select>
      </div>
      <Button
        type="button"
        disabled={saving}
        onClick={() => void onSave({ scope: scope || undefined, strategy: strategy || undefined })}
      >
        {pt('scheduling.holidayRules.saveAction')}
      </Button>
    </div>
  );
};
