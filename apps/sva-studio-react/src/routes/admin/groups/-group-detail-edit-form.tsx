import { Button, StudioSaveButton } from '@sva/studio-ui-react';

import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import { GroupTextFields } from './-group-shared';

import type { GroupDetailState } from './-group-detail-page';

export const GroupDetailEditForm = ({ state }: Readonly<{ state: GroupDetailState }>) => {
  const {
    canUpdateGroup,
    canDeleteGroup,
    formValues,
    setDirtyFormValues,
    rolesApi,
    setDeleteConfirmOpen,
    saveFeedback,
    onEdit,
  } = state;
  return (
    <Card className="space-y-4 p-4">
      <form className="grid gap-4" aria-readonly={!canUpdateGroup} onSubmit={onEdit}>
        <fieldset className="contents" disabled={!canUpdateGroup}>
          <GroupTextFields
            descriptionId="edit-group-description"
            displayNameId="edit-group-name"
            formValues={formValues}
            setFormValues={setDirtyFormValues}
          />
          <fieldset className="grid gap-2 text-sm text-foreground">
            <legend>{t('admin.groups.dialogs.rolesLabel')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {rolesApi.roles.map((role) => {
                const checked = formValues.roleIds.includes(role.id);
                return (
                  <Label
                    key={role.id}
                    className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2"
                  >
                    <Checkbox
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setDirtyFormValues((current) => ({
                          ...current,
                          roleIds: event.target.checked
                            ? [...current.roleIds, role.id]
                            : current.roleIds.filter((entry) => entry !== role.id),
                        }))
                      }
                    />
                    <span>{role.roleName}</span>
                  </Label>
                );
              })}
            </div>
          </fieldset>
          <Label className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
            <Checkbox
              type="checkbox"
              checked={formValues.isActive}
              onChange={(event) =>
                setDirtyFormValues((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            <span>{t('admin.groups.labels.active')}</span>
          </Label>
          <div className="flex justify-end gap-3">
            {canDeleteGroup ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                {t('admin.groups.actions.delete')}
              </Button>
            ) : null}
            <StudioSaveButton
              type="submit"
              status={saveFeedback.status}
              labels={{
                idle: t('admin.groups.actions.save'),
                saving: t('account.actions.saving'),
                saved: t('account.actions.saved'),
              }}
            />
          </div>
        </fieldset>
      </form>
    </Card>
  );
};
