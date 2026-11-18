export const SSF_TRANSFER_PERMISSION = 'ssf.recording.access.transfer' as const;
export const SSF_RECORDING_PERMISSION_IDS = [
  'ssf.recording.request',
  'ssf.recording.review',
  'ssf.recording.review.sworn',
  SSF_TRANSFER_PERMISSION,
  'ssf.recording.supervise',
  'ssf.recording.recovery.custodian',
] as const;

export const SSF_DIRECTORY_PERMISSION_IDS = [
  ...SSF_RECORDING_PERMISSION_IDS,
  'ssf.configuration.tenant.manage',
] as const;
