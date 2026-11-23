export const wasteEmailMonitoringPermission = 'waste-management.email-reminder-monitoring.read';

export const isWasteReminderEmailAddress = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());

export type WasteEmailSubscriptionStatus = 'pending' | 'active' | 'unsubscribed' | 'expired';
export type WasteEmailDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
export type WasteEmailMonitoringQuery = Readonly<{
  page: number;
  pageSize: number;
  status?: WasteEmailSubscriptionStatus;
  subscriptionId?: string;
  deliveryPage: number;
}>;
export type WasteEmailMonitoringSearchQuery = Omit<WasteEmailMonitoringQuery, 'status'> & Readonly<{
  email: string;
}>;
export type WasteEmailSubscriptionSummary = Readonly<{
  id: string;
  maskedEmail: string;
  status: WasteEmailSubscriptionStatus;
  city: string | null;
  createdAt: string;
  activatedAt: string | null;
  unsubscribedAt: string | null;
  items: readonly Readonly<{ fraction: string; slotId: string }>[];
  /** Absent with older API versions; null means no matching stored message. */
  lastSentEmail?: Readonly<Pick<WasteEmailDeliverySummary, 'kind' | 'sentAt'>> | null;
  /** Absent with older API versions; null means no stored confirmation email. */
  doiEmail?: Readonly<Pick<WasteEmailDeliverySummary, 'status' | 'sentAt'>> | null;
  nextEmail?: Readonly<
    Pick<WasteEmailDeliverySummary, 'kind' | 'scheduledAt'> & {
      status: 'pending' | 'processing';
    }
  > | null;
}>;
export type WasteEmailDeliverySummary = Readonly<{
  id: string;
  kind: 'doi' | 'reminder';
  status: WasteEmailDeliveryStatus;
  createdAt: string;
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  fraction: string | null;
  pickupDate: string | null;
  error: 'transport_unavailable' | 'cancelled' | 'dispatch_failed' | 'outcome_unknown' | null;
}>;
export type WasteEmailMonitoringOverview = Readonly<{
  subscriptions: readonly WasteEmailSubscriptionSummary[];
  total: number;
  /** Tenant-wide active subscriptions, independent of the current list filter. */
  activeTotal?: number;
  deliveries: readonly WasteEmailDeliverySummary[];
  deliveryTotal: number;
}>;
