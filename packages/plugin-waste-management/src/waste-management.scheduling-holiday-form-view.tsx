import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioPageHeader } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteHolidayRuleForm } from './waste-management.holiday-rules-form.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const WasteSchedulingHolidayFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();
  const pt = usePluginTranslation('wasteManagement');
  const rule = controller.overview?.holidayRules.find((candidate) => candidate.id === search.schedulingEntryId);

  if (!rule) {
    return null;
  }

  const handleCancel = () => {
    controller.setMessage(null);
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        schedulingView: 'list',
        schedulingEntryType: undefined,
        schedulingEntryId: undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={pt('scheduling.holidayRules.editTitle')}
        description={pt('scheduling.holidayRules.editDescription', { value: rule.holidayName })}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={controller.saving}>
              {pt('scheduling.holidayRules.cancelAction')}
            </Button>
          </div>
        }
      />

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
        <div className="space-y-1">
          <p className="text-sm font-medium">{rule.holidayName}</p>
          <p className="text-sm text-muted-foreground">
            {pt('scheduling.holidayRules.meta', { value: `${rule.holidayDate} · ${rule.stateCode} · ${String(rule.year)}` })}
          </p>
        </div>
        <WasteHolidayRuleForm
          rule={rule}
          saving={controller.saving}
          onSave={(input) => controller.onSaveHolidayRule(rule, input)}
        />
      </section>
    </div>
  );
};
