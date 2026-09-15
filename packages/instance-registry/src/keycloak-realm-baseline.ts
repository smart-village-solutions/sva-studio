import { buildPayloadFingerprint } from './payload-fingerprint.js';

export const KEYCLOAK_REALM_BASELINE = {
  version: '1.0',
  loginClientId: 'sva-studio-login',
  tenantAdminClientId: 'sva-studio-realm-admin',
  realm: {
    loginTheme: 'sva-kern2',
    internationalizationEnabled: true,
    supportedLocales: ['de'],
    defaultLocale: 'de',
    eventsEnabled: true,
    eventsListeners: ['jboss-logging'],
    eventsExpiration: 604_800,
    adminEventsEnabled: true,
    adminEventsDetailsEnabled: false,
    resetPasswordAllowed: true,
    verifyEmail: false,
    attributes: {
      adminEventsExpiration: '604800',
      darkMode: 'true',
    },
    smtpServer: {
      auth: 'true',
      authType: 'basic',
      debug: 'true',
      envelopeFrom: '',
      from: 'sva-studio-sandbox@smart-village.app',
      fromDisplayName: 'SVA Studio',
      host: 'mail.smart-village.solutions',
      port: '587',
      replyTo: '',
      replyToDisplayName: '',
      ssl: 'false',
      starttls: 'false',
      user: 'sva-studio@smart-village.solutions',
    },
  },
  userProfileAttributes: [
    { name: 'instanceId', multivalued: false },
    { name: 'mainserverUserApplicationId', multivalued: false },
    { name: 'mainserverUserApplicationSecret', multivalued: false },
  ],
  instanceIdMapper: {
    name: 'instanceId',
    userAttribute: 'instanceId',
    claimName: 'instanceId',
  },
} as const;

export type KeycloakRealmBaselineSettings = typeof KEYCLOAK_REALM_BASELINE.realm;

export const KEYCLOAK_REALM_BASELINE_FINGERPRINT = buildPayloadFingerprint(KEYCLOAK_REALM_BASELINE);

const equalStringArrays = (
  actual: readonly string[] | undefined,
  expected: readonly string[]
): boolean =>
  Boolean(
    actual && actual.length === expected.length && expected.every((value) => actual.includes(value))
  );

export const isKeycloakRealmBaselineAligned = (
  realm: Readonly<{
    loginTheme?: string;
    internationalizationEnabled?: boolean;
    supportedLocales?: readonly string[];
    defaultLocale?: string;
    eventsEnabled?: boolean;
    eventsListeners?: readonly string[];
    eventsExpiration?: number;
    adminEventsEnabled?: boolean;
    adminEventsDetailsEnabled?: boolean;
    resetPasswordAllowed?: boolean;
    verifyEmail?: boolean;
    attributes?: Readonly<Record<string, string>>;
    smtpServer?: Readonly<Record<string, string>>;
  }> | null
): boolean => {
  if (!realm) return false;
  const expected = KEYCLOAK_REALM_BASELINE.realm;
  return (
    realm.loginTheme === expected.loginTheme &&
    realm.internationalizationEnabled === expected.internationalizationEnabled &&
    equalStringArrays(realm.supportedLocales, expected.supportedLocales) &&
    realm.defaultLocale === expected.defaultLocale &&
    realm.eventsEnabled === expected.eventsEnabled &&
    equalStringArrays(realm.eventsListeners, expected.eventsListeners) &&
    realm.eventsExpiration === expected.eventsExpiration &&
    realm.adminEventsEnabled === expected.adminEventsEnabled &&
    realm.adminEventsDetailsEnabled === expected.adminEventsDetailsEnabled &&
    realm.resetPasswordAllowed === expected.resetPasswordAllowed &&
    realm.verifyEmail === expected.verifyEmail &&
    Object.entries(expected.attributes).every(
      ([key, value]) => realm.attributes?.[key] === value
    ) &&
    Object.entries(expected.smtpServer).every(([key, value]) => realm.smtpServer?.[key] === value)
  );
};
