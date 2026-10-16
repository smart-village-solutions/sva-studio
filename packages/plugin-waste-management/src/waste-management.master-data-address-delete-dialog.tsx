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
}): ReactNode => (
  <div className="space-y-2 text-sm">
    <p>{pt('masterData.locationsWorkspace.addresses.impact.addresses', { regions: counts.regions, cities: counts.cities, streets: counts.streets, houseNumbers: counts.houseNumbers })}</p>
    <p>{pt('masterData.locationsWorkspace.addresses.impact.locations', { count: counts.collectionLocations })}</p>
    <p>{pt('masterData.locationsWorkspace.addresses.impact.subscriptions', { count: counts.emailReminderSubscriptions })}</p>
    {counts.sentEmailReminderOutbox > 0 ? <p className="font-medium text-destructive">{pt('masterData.locationsWorkspace.addresses.impact.sent', { count: counts.sentEmailReminderOutbox })}</p> : null}
    {counts.inconsistentCollectionLocations > 0 ? <p role="alert" className="text-destructive">{pt('masterData.locationsWorkspace.addresses.inconsistent', { count: counts.inconsistentCollectionLocations })}</p> : null}
    <details>
      <summary className="cursor-pointer font-medium">{pt('masterData.locationsWorkspace.addresses.details')}</summary>
      <div className="mt-2 space-y-1">
        <p>{pt('masterData.locationsWorkspace.addresses.impact.links', { count: counts.locationTourLinks })}</p>
        <p>{pt('masterData.locationsWorkspace.addresses.impact.pickupDates', { count: counts.locationTourPickupDates })}</p>
        <p>{pt('masterData.locationsWorkspace.addresses.impact.assignments', { removed: counts.fullyRemovedTourAssignments, retained: counts.retainedTourAssignments })}</p>
        <p>{pt('masterData.locationsWorkspace.addresses.impact.subscriptionItems', { count: counts.emailReminderSubscriptionItems })}</p>
        <p>{pt('masterData.locationsWorkspace.addresses.impact.outbox', { count: counts.emailReminderOutbox })}</p>
      </div>
    </details>
    <p className="text-muted-foreground">{pt('masterData.locationsWorkspace.addresses.keptData')}</p>
  </div>
);
