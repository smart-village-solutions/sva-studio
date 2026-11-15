/** Explicit, preview-bound deletion of a single fraction. */
export type WasteFractionDeleteMode = 'detach' | 'delete-tours' | 'replace';
export type WasteFractionDeleteInput = Readonly<{
  fractionId: string;
  mode: WasteFractionDeleteMode;
  targetFractionId?: string;
}>;
export type WasteFractionDeleteConfirmation = WasteFractionDeleteInput &
  Readonly<{
    confirmationToken: string;
  }>;
export type WasteFractionDeletePreview = Readonly<{
  token: string;
  input: WasteFractionDeleteInput;
  canDetach: boolean;
  targets: readonly Readonly<{ id: string; name: string }>[];
  tours: readonly Readonly<{
    id: string;
    name: string;
    status: string;
    otherFractions: readonly string[];
  }>[];
  counts: Readonly<{
    links: number;
    pickupDates: number;
    assignments: number;
    shifts: number;
    reminderItems: number;
    pendingReminders: number;
  }>;
  conflicts: readonly Readonly<{
    tourIds: readonly string[];
    tourNames?: readonly string[];
    locationLabel?: string;
    locationId: string;
    pickupDate: string;
  }>[];
  blockedReason:
    | 'empty-tour'
    | 'invalid-target'
    | 'date-conflict'
    | 'unbounded-schedule'
    | 'reminder-dispatching'
    | null;
}>;
