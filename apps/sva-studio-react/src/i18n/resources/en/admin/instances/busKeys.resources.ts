export const busKeysInstancesAdminENResources = {
  title: 'Bus API keys',
  requestId: 'Request ID:',
  inactive: 'New keys and reactivation are available only for active instances.',
  notActivatable: 'Only revoked keys that have not expired can be reactivated.',
  keyNotFound:
    'This key does not belong to this instance or no longer exists. Please inspect the metadata.',
  accessDenied:
    'The current session is not authorized for this action. Please check access or sign in again.',
  create: 'Create key',
  rotation:
    'Rotation: Create a new key, distribute and verify it in the client, then deliberately revoke the old key. Creating a key keeps existing keys valid.',
  formDescription:
    'Place and instance ID come from the instance registry. Confirm contact and creator initials for each creation.',
  keyId: 'Key ID',
  contact: 'Customer contact email',
  createdBy: 'Creator initials',
  createdAt: 'Created at (UTC)',
  validThrough: 'Valid through and including',
  status: 'Status',
  actions: 'Actions',
  utcExplanation:
    'The key expires at the beginning of the following UTC day. Exact expiry:',
  noExpiry: 'No expiry date',
  missing: 'Not provided',
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired',
  loading: 'Loading Bus API keys …',
  empty: 'No Bus API keys exist for this instance.',
  loadError: 'Bus API keys could not be loaded. Please reload.',
  notConfigured: 'The Bus connection has not been configured for this Studio environment.',
  invalid: 'Enter a valid contact email, initials using letters, and an expiry in the future.',
  reauth: 'Please sign in again, then deliberately repeat the action.',
  reauthAction: 'Sign in again',
  unavailable:
    'The Bus service is currently unreachable or rejected the request. Reload the metadata and check the current status.',
  revokeOutcomeUnknown:
    'Revocation could not be confirmed. Metadata is being reloaded. Check the current key status before trying to revoke it again.',
  activateOutcomeUnknown:
    'Reactivation could not be confirmed. Metadata is being reloaded. Check the current key status before trying to reactivate it again.',
  outcomeUnknown:
    'The outcome could not be confirmed. A key may already have been created or changed. Metadata is being reloaded. Deliberately revoke and replace an unusable new key; verify the state before creating another.',
  auditWarning:
    'The Bus change succeeded, but the Studio audit could not be saved. Do not repeat the operation; use the response request ID to investigate.',
  reload: 'Reload metadata',
  activate: 'Reactivate',
  revoke: 'Revoke',
  revokeConfirmation:
    'This key will no longer authorize proxy requests. Has a replacement key already been verified in the client?',
  confirmRevoke: 'Revoke key now',
  cancel: 'Cancel',
  close: 'Close',
  closeTitle: 'API key copied?',
  closeDescription:
    'This API key is only visible once. Copy it before closing, as it cannot be displayed again afterwards. Have you copied it?',
  closeCopied: 'Yes, I have copied the API key',
  returnToCopy: 'No, I still need to copy the API key',
  oneTimeTitle: 'Save this key now',
  oneTimeDescription:
    'This raw key is shown only once. Store it securely in the intended client. It cannot be shown again after closing or switching instances.',
  copy: 'Copy key',
  copied: 'Key copied to the clipboard.',
  copyError: 'The key could not be copied. Please copy the displayed value manually.',
} as const;
