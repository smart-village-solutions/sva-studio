import type { IamLegalTextListItem } from '@sva/core';
import React from 'react';

import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { t } from '../../../i18n';
import { formatLegalTextDateTime, type LegalTextStatus } from './-legal-texts-shared';
import { LegalTextRichTextEditor } from './-legal-text-rich-text-editor';

export type LegalTextDetailFormValues = {
  name: string;
  legalTextVersion: string;
  locale: string;
  contentHtml: string;
  status: LegalTextStatus;
  publishedAt: string;
  targetRoleIds: string;
  targetGroupIds: string;
};

export const LegalTextDetailForm = ({
  canDelete,
  canUpdate,
  formValues,
  onDelete,
  onSubmit,
  selectedLegalText,
  setFormValues,
}: Readonly<{
  canDelete: boolean;
  canUpdate: boolean;
  formValues: LegalTextDetailFormValues;
  onDelete: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  selectedLegalText: IamLegalTextListItem;
  setFormValues: React.Dispatch<React.SetStateAction<LegalTextDetailFormValues>>;
}>) => (
  <Card className="space-y-4 p-4">
    <form
      id="legal-text-edit-form"
      className="space-y-4"
      aria-readonly={!canUpdate}
      onSubmit={onSubmit}
    >
      <fieldset className="contents" disabled={!canUpdate}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-name">{t('admin.legalTexts.fields.name')}</Label>
            <Input
              id="legal-text-edit-name"
              value={formValues.name}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-version">
              {t('admin.legalTexts.fields.legalTextVersion')}
            </Label>
            <Input
              id="legal-text-edit-version"
              value={formValues.legalTextVersion}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, legalTextVersion: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-locale">{t('admin.legalTexts.fields.locale')}</Label>
            <Input
              id="legal-text-edit-locale"
              value={formValues.locale}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, locale: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-status">{t('admin.legalTexts.fields.status')}</Label>
            <Select
              id="legal-text-edit-status"
              value={formValues.status}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  status: event.target.value as LegalTextStatus,
                }))
              }
            >
              <option value="draft">{t('admin.legalTexts.status.draft')}</option>
              <option value="valid">{t('admin.legalTexts.status.valid')}</option>
              <option value="archived">{t('admin.legalTexts.status.archived')}</option>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="legal-text-edit-published">
              {t('admin.legalTexts.fields.publishedAt')}
            </Label>
            <Input
              id="legal-text-edit-published"
              type="datetime-local"
              value={formValues.publishedAt}
              required={formValues.status === 'valid'}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, publishedAt: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-role-targets">
              {t('admin.legalTexts.fields.targetRoleIds')}
            </Label>
            <Input
              id="legal-text-edit-role-targets"
              value={formValues.targetRoleIds}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, targetRoleIds: event.target.value }))
              }
              placeholder={t('admin.legalTexts.fields.targetRoleIdsPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-text-edit-group-targets">
              {t('admin.legalTexts.fields.targetGroupIds')}
            </Label>
            <Input
              id="legal-text-edit-group-targets"
              value={formValues.targetGroupIds}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, targetGroupIds: event.target.value }))
              }
              placeholder={t('admin.legalTexts.fields.targetGroupIdsPlaceholder')}
            />
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground md:grid-cols-3">
          <p>{t('admin.legalTexts.meta.uuid', { value: selectedLegalText.id })}</p>
          <p>
            {t('admin.legalTexts.meta.createdAt', {
              value: formatLegalTextDateTime(selectedLegalText.createdAt),
            })}
          </p>
          <p>
            {t('admin.legalTexts.meta.updatedAt', {
              value: formatLegalTextDateTime(selectedLegalText.updatedAt),
            })}
          </p>
        </div>

        <div className="space-y-2">
          <Label id="legal-text-edit-content-label" htmlFor="legal-text-edit-content">
            {t('admin.legalTexts.fields.contentHtml')}
          </Label>
          <LegalTextRichTextEditor
            id="legal-text-edit-content"
            labelId="legal-text-edit-content-label"
            value={formValues.contentHtml}
            onChange={(contentHtml) => setFormValues((current) => ({ ...current, contentHtml }))}
            disabled={!canUpdate}
          />
        </div>

        <div className="flex justify-end gap-3">
          {canDelete ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
              {t('admin.legalTexts.actions.delete')}
            </Button>
          ) : null}
        </div>
      </fieldset>
    </form>
  </Card>
);
