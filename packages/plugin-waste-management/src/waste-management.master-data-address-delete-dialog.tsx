import type { RefObject, ReactNode } from 'react';
import type { WasteAddressImpactPreview } from '@sva/waste-management-contracts';
import { Button, StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import type { AddressRow } from './waste-management.master-data-addresses.helpers.js';

export type PendingAddressDelete = Readonly<{
  row: AddressRow;
  preview?: WasteAddressImpactPreview;
  loading: boolean;
  error?: string;
  previewFresh?: boolean;
}>;

type Props = Readonly<{
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  pendingDelete: PendingAddressDelete | null;
  deleting: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onReloadPreview: () => void;
}>;

export const WasteMasterDataAddressDeleteDialog = ({
  pt, pendingDelete, deleting, triggerRef, onCancel, onConfirm, onReloadPreview,
}: Props) => (
  <StudioDestructiveActionDialog
    open={pendingDelete !== null}
    title={pt('masterData.locationsWorkspace.addresses.deleteTitle', { value: pendingDelete?.row.name ?? '' })}
    description={pendingDelete?.loading ? pt('masterData.locationsWorkspace.addresses.previewLoading') : pt('masterData.locationsWorkspace.addresses.deleteDescription')}
    confirmLabel={pt('masterData.locationsWorkspace.addresses.deleteConfirm')}
    pendingLabel={pt('common.deleting')}
    cancelLabel={pt('masterData.locationsWorkspace.addresses.cancel')}
    confirmDisabled={!pendingDelete?.preview || pendingDelete.loading || (Boolean(pendingDelete.error) && !pendingDelete.previewFresh) || (pendingDelete.preview.counts.inconsistentCollectionLocations > 0)}
    pending={deleting || pendingDelete?.loading}
    errorMessage={pendingDelete?.error}
    fallbackFocusRef={triggerRef}
    onCancel={onCancel}
    onConfirm={onConfirm}
  >
    {pendingDelete?.preview ? <DeleteImpact pt={pt} counts={pendingDelete.preview.counts} /> : null}
    {pendingDelete?.error && !pendingDelete.previewFresh ? (
      <Button type="button" variant="secondary" disabled={pendingDelete.loading || deleting} onClick={onReloadPreview}>
        {pt('masterData.locationsWorkspace.addresses.reloadPreview')}
      </Button>
    ) : null}
  </StudioDestructiveActionDialog>
);

const DeleteImpact = ({ pt, counts }: {
  pt: Props['pt'];
  counts: WasteAddressImpactPreview['counts'];
}): ReactNode => {
  const details = [
    { key: 'links', count: counts.locationTourLinks, label: pt('masterData.locationsWorkspace.addresses.impact.links', { count: counts.locationTourLinks }) },
    { key: 'pickupDates', count: counts.locationTourPickupDates, label: pt('masterData.locationsWorkspace.addresses.impact.pickupDates', { count: counts.locationTourPickupDates }) },
    { key: 'assignments', count: counts.fullyRemovedTourAssignments + counts.retainedTourAssignments, label: pt('masterData.locationsWorkspace.addresses.impact.assignments', { removed: counts.fullyRemovedTourAssignments, retained: counts.retainedTourAssignments }) },
    { key: 'subscriptionItems', count: counts.emailReminderSubscriptionItems, label: pt('masterData.locationsWorkspace.addresses.impact.subscriptionItems', { count: counts.emailReminderSubscriptionItems }) },
    { key: 'outbox', count: counts.emailReminderOutbox, label: pt('masterData.locationsWorkspace.addresses.impact.outbox', { count: counts.emailReminderOutbox }) },
  ].filter((impact) => impact.count > 0);
  return (
    <div className="space-y-2 text-sm">
      <p>{pt('masterData.locationsWorkspace.addresses.impact.addresses', { regions: counts.regions, cities: counts.cities, streets: counts.streets, houseNumbers: counts.houseNumbers })}</p>
      {impactRow(counts.collectionLocations, pt('masterData.locationsWorkspace.addresses.impact.locations', { count: counts.collectionLocations }))}
      {impactRow(counts.emailReminderSubscriptions, pt('masterData.locationsWorkspace.addresses.impact.subscriptions', { count: counts.emailReminderSubscriptions }))}
      {impactRow(counts.sentEmailReminderOutbox, pt('masterData.locationsWorkspace.addresses.impact.sent', { count: counts.sentEmailReminderOutbox }), 'font-medium text-destructive')}
      {impactRow(counts.inconsistentCollectionLocations, pt('masterData.locationsWorkspace.addresses.inconsistent', { count: counts.inconsistentCollectionLocations }), 'text-destructive', 'alert')}
      {details.length > 0 ? <details>
        <summary className="cursor-pointer font-medium">{pt('masterData.locationsWorkspace.addresses.details')}</summary>
        <div className="mt-2 space-y-1">{details.map((impact) => <p key={impact.key}>{impact.label}</p>)}</div>
      </details> : null}
      <p className="text-muted-foreground">{pt('masterData.locationsWorkspace.addresses.keptData')}</p>
    </div>
  );
};

const impactRow = (count: number, label: string, className?: string, role?: 'alert'): ReactNode =>
  count > 0 ? <p className={className} role={role}>{label}</p> : null;
