import type { WasteHolidayRuleRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import { WasteHolidayRuleForm } from './waste-management.holiday-rules-form.js';

const groupHolidayRulesByYear = (rules: readonly WasteHolidayRuleRecord[]) => {
  const groups = new Map<number, WasteHolidayRuleRecord[]>();
  for (const rule of rules) {
    const group = groups.get(rule.year);
    if (group) {
      group.push(rule);
      continue;
    }
    groups.set(rule.year, [rule]);
  }
  return [...groups.entries()].sort((left, right) => left[0] - right[0]);
};

export const WasteHolidayRulesList = ({
  rules,
  saving,
  onRunSync,
  onSaveRule,
}: {
  readonly rules: readonly WasteHolidayRuleRecord[];
  readonly saving: boolean;
  readonly onRunSync: () => Promise<void>;
  readonly onSaveRule: (
    rule: WasteHolidayRuleRecord,
    input: {
      readonly scope?: WasteHolidayRuleRecord['scope'];
      readonly strategy?: WasteHolidayRuleRecord['strategy'];
    }
  ) => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const yearGroups = groupHolidayRulesByYear(rules);

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('scheduling.holidayRules.title')}</h3>
          <p className="text-sm text-muted-foreground">{pt('scheduling.holidayRules.description')}</p>
        </div>
        <Button type="button" disabled={saving} onClick={() => void onRunSync()}>
          {pt('scheduling.holidayRules.syncAction')}
        </Button>
      </div>
      {yearGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{pt('scheduling.holidayRules.empty')}</p>
      ) : (
        <div className="space-y-4">
          {yearGroups.map(([year, yearRules]) => (
            <div key={year} className="space-y-2">
              <h4 className="text-sm font-medium">{pt('scheduling.holidayRules.yearHeading', { value: year })}</h4>
              <div className="space-y-3">
                {yearRules.map((rule) => (
                  <article key={rule.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{rule.holidayName}</span>
                      <span className="text-muted-foreground">{rule.holidayDate}</span>
                      <span className="text-muted-foreground">{pt(`scheduling.holidayRules.sourceStatus.${rule.sourceStatus}`)}</span>
                      <span className="text-muted-foreground">{pt(`scheduling.holidayRules.conflictStatus.${rule.conflictStatus}`)}</span>
                    </div>
                    <WasteHolidayRuleForm rule={rule} saving={saving} onSave={(input) => onSaveRule(rule, input)} />
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
