export const recordingKeyTranslationsEn = {
  keys: {
    confirmedStatus: 'Confirmed operation',
    retryConfirmed: 'Check result again',
    policyNotice:
      'Each new recording also requires an active organisation key and a personal key for the recording employee.',
    replaceNotice:
      'A replacement applies to new recordings. Keep each earlier private key for recordings created with that version. Replacing a lost key cannot restore those recordings.',
    history: 'Public key history',
    version: 'Key version',
    noActive:
      'No organisation key is active. Recording is unavailable until you activate a saved key.',
    create: 'Create organisation key',
    replace: 'Prepare replacement',
    reload: 'Reload',
    custody: 'Save the private organisation key',
    custodyNotice:
      'This file contains an unencrypted private key. Keep it in your organisation’s password manager or physical safe. Anyone with the file and the transfer permission can restore access to recordings protected by this key.',
    printNotice:
      'Unencrypted private organisation key. Store this page in a safe. The complete text below is base64url-encoded UTF-8 JSON. Decode it into a JSON file for import.',
    download: 'Download key file',
    print: 'Print complete key',
    saved: 'I have secured the complete private key.',
    activate: 'Activate saved key',
    activated: 'Activation was confirmed. The list shows the current Gateway state.',
    cancel: 'Cancel',
    login: 'Sign in',
    states: { active: 'Active', prepared: 'Prepared', superseded: 'Superseded' },
    errors: {
      AUTHENTICATION_REQUIRED: 'Your session has ended. Sign in to continue.',
      PERMISSION_REQUIRED: 'You do not have permission for this operation.',
      PREPARATION_NOT_FOUND: 'This selection is no longer available. Reload and choose again.',
      KEY_VERSION_CHANGED:
        'The key version has changed. Check the current version and prepare again.',
      SCOPE_CHANGED:
        'The selected recordings or keys have changed. Reload the selection and confirm it again.',
      PREPARATION_USED: 'This preparation has already been used. Start a new preparation.',
      PREPARATION_EXPIRED: 'This preparation expired. Start again.',
      INVALID_KEY: 'The key file or signed key data does not match this operation.',
      INVALID_PROOF: 'Key possession could not be verified. Check the version and prepare again.',
      TRANSFER_SCOPE_TOO_LARGE: 'Select fewer recordings for this transfer.',
      RECORDING_PROTOCOL_UPGRADE_REQUIRED:
        'This tenant still uses the previous recording protocol. Ask the operator to review and authorize the switch to the new version.',
      RECORDING_UNAVAILABLE:
        'The recording service is unavailable. If a submission may have reached it, retry the same confirmed operation.',
    },
  },
  transfer: {
    description:
      'Grant access to specific recordings using the private organisation key. Recordings protected by different key versions require separate confirmations. Existing grants remain in place.',
    selection: 'Selected recordings and keys',
    sourceHint: 'Select a name or enter a known former user ID',
    source: 'Source employee',
    target: 'Recipient',
    reason: 'Reason for granting access',
    choose: 'Choose a person',
    find: 'Find recordings',
    more: 'Load more recordings',
    keyCount: 'Content keys',
    preview: 'Prepare this group',
    confirmTitle: 'Confirm recording access',
    targetKey: 'Recipient key version and fingerprint',
    file: 'Private organisation key file',
    confirm: 'I confirm this recipient, key version, reason and exact recording selection.',
    commit: 'Grant access',
    receipt: 'Access granted. Receipt',
  },
} as const;
