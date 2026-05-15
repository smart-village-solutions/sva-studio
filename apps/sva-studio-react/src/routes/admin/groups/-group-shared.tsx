import React from 'react';

import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';

export type GroupFormValues = {
  groupKey: string;
  displayName: string;
  description: string;
};

export const createGroupFormValues = (): GroupFormValues => ({
  groupKey: '',
  displayName: '',
  description: '',
});

export const groupErrorMessage = (error: IamHttpError | null, fallbackKey: TranslationKey): string => {
  if (!error) {
    return t(fallbackKey);
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.groups.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.groups.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.groups.errors.rateLimited');
    case 'conflict':
      return t('admin.groups.errors.conflict');
    case 'invalid_request':
      return t('admin.groups.errors.invalidRequest');
    case 'database_unavailable':
      return error.safeDetails?.reason_code === 'schema_drift'
        ? t('admin.groups.errors.databaseSchemaDrift')
        : t('admin.groups.errors.databaseUnavailable');
    default:
      return t(fallbackKey);
  }
};

export const normalizeGroupKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '_');

export const toCreateGroupPayload = (values: GroupFormValues) => ({
  groupKey: normalizeGroupKey(values.groupKey),
  displayName: values.displayName.trim(),
  description: values.description.trim() || undefined,
});

export const diffGroupRoleIds = (currentRoleIds: readonly string[], nextRoleIds: readonly string[]) => {
  const current = new Set(currentRoleIds);
  const next = new Set(nextRoleIds);

  return {
    roleIdsToAssign: nextRoleIds.filter((roleId) => !current.has(roleId)),
    roleIdsToRemove: currentRoleIds.filter((roleId) => !next.has(roleId)),
  };
};

type GroupTextFieldsProps<TFormValues extends { displayName: string; description: string }> = {
  readonly descriptionId: string;
  readonly displayNameId: string;
  readonly formValues: TFormValues;
  readonly setFormValues: React.Dispatch<React.SetStateAction<TFormValues>>;
};

export const GroupTextFields = <TFormValues extends { displayName: string; description: string }>({
  descriptionId,
  displayNameId,
  formValues,
  setFormValues,
}: GroupTextFieldsProps<TFormValues>) => (
  <>
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor={displayNameId}>{t('admin.groups.dialogs.displayNameLabel')}</Label>
      <Input
        id={displayNameId}
        required
        value={formValues.displayName}
        onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
      />
    </div>
    <div className="grid gap-2 text-sm text-foreground">
      <Label htmlFor={descriptionId}>{t('admin.groups.dialogs.descriptionLabel')}</Label>
      <Textarea
        id={descriptionId}
        value={formValues.description}
        onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
      />
    </div>
  </>
);
