import { Button } from '@sva/studio-ui-react';

import { StudioTableSurface } from '../../../components/StudioTableSurface';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import { formatEditorDateTime } from '../../../lib/editor-date-time';

import type { GroupDetailState } from './-group-detail-page';

const formatDateTime = (value?: string) => {
  if (!value) {
    return t('admin.groups.labels.noValidity');
  }
  return formatEditorDateTime(value) ?? value;
};

export const GroupDetailMemberships = ({ state }: Readonly<{ state: GroupDetailState }>) => {
  const {
    group,
    canUpdateGroup,
    membershipForm,
    setMembershipForm,
    onAssignMembership,
    onRemoveMembership,
  } = state;
  if (!group) {
    return null;
  }
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {t('admin.groups.memberships.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('admin.groups.memberships.subtitle')}</p>
      </header>
      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
        aria-readonly={!canUpdateGroup}
        onSubmit={onAssignMembership}
      >
        <fieldset className="contents" disabled={!canUpdateGroup}>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="group-membership-subject">
              {t('admin.groups.memberships.subjectLabel')}
            </Label>
            <Input
              id="group-membership-subject"
              required
              value={membershipForm.keycloakSubject}
              onChange={(event) =>
                setMembershipForm((current) => ({
                  ...current,
                  keycloakSubject: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="group-membership-valid-from">
              {t('admin.groups.memberships.validFromLabel')}
            </Label>
            <Input
              id="group-membership-valid-from"
              type="datetime-local"
              value={membershipForm.validFrom}
              onChange={(event) =>
                setMembershipForm((current) => ({
                  ...current,
                  validFrom: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="group-membership-valid-until">
              {t('admin.groups.memberships.validUntilLabel')}
            </Label>
            <Input
              id="group-membership-valid-until"
              type="datetime-local"
              value={membershipForm.validUntil}
              onChange={(event) =>
                setMembershipForm((current) => ({
                  ...current,
                  validUntil: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-end">
            <Button type="submit">{t('admin.groups.memberships.assign')}</Button>
          </div>
        </fieldset>
      </form>

      <StudioTableSurface tone="background">
        <table
          className="min-w-full border-collapse"
          aria-label={t('admin.groups.memberships.tableAriaLabel')}
        >
          <caption className="sr-only">{t('admin.groups.memberships.caption')}</caption>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.memberships.tableSubject')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.memberships.tableValidity')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.memberships.tableOrigin')}
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                {t('admin.groups.memberships.tableActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {group.memberships.length > 0 ? (
              group.memberships.map((membership) => (
                <tr
                  key={`${membership.groupId}-${membership.accountId}`}
                  className="border-t border-border text-sm text-foreground"
                >
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    <div className="space-y-1">
                      <div>
                        {membership.displayName ??
                          (membership.keycloakSubject || membership.accountId)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {membership.keycloakSubject || membership.accountId}
                      </div>
                    </div>
                  </th>
                  <td className="px-3 py-3">
                    {membership.validFrom || membership.validUntil
                      ? t('admin.groups.memberships.validityRange', {
                          from: formatDateTime(membership.validFrom),
                          to: formatDateTime(membership.validUntil),
                        })
                      : t('admin.groups.labels.noValidity')}
                  </td>
                  <td className="px-3 py-3">
                    {membership.assignedByAccountId
                      ? t('admin.groups.memberships.originManual', {
                          accountId: membership.assignedByAccountId,
                        })
                      : t('admin.groups.memberships.originUnknown')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      {canUpdateGroup ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!membership.keycloakSubject}
                          onClick={() => void onRemoveMembership(membership.keycloakSubject)}
                        >
                          {t('admin.groups.memberships.remove')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-border text-sm text-muted-foreground">
                <td colSpan={4} className="px-3 py-4">
                  {t('admin.groups.memberships.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </StudioTableSurface>
    </section>
  );
};
