import type { InstanceRealmMode } from '@sva/core';

import type { KeycloakTenantPlan } from './keycloak-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import type { KeycloakReadState } from './provisioning-auth-types.js';

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

export const isInstanceIdMapperAligned = (
  mapper: KeycloakReadState['protocolMappers'][number] | undefined
): boolean =>
  mapper?.name === KEYCLOAK_REALM_BASELINE.instanceIdMapper.name &&
  mapper.protocol === 'openid-connect' &&
  mapper.protocolMapper === 'oidc-usermodel-attribute-mapper' &&
  mapper.config?.['user.attribute'] === KEYCLOAK_REALM_BASELINE.instanceIdMapper.userAttribute &&
  mapper.config?.['claim.name'] === KEYCLOAK_REALM_BASELINE.instanceIdMapper.claimName &&
  mapper.config?.['jsonType.label'] === 'String' &&
  mapper.config?.multivalued === 'false' &&
  mapper.config?.['id.token.claim'] === 'true' &&
  mapper.config?.['access.token.claim'] === 'true' &&
  mapper.config?.['userinfo.token.claim'] === 'true';

const buildRealmBaselineStep = (
  realmMode: InstanceRealmMode,
  state: KeycloakReadState | undefined,
  blocked: boolean
): KeycloakTenantPlan['steps'][number] => {
  if (realmMode === 'existing') {
    return {
      stepKey: 'realm_baseline',
      title: 'Realm-Baseline prüfen',
      action: 'skip',
      status: blocked ? 'blocked' : 'ready',
      summary: 'Bestands-Realms werden nicht automatisch auf die New-Realm-Baseline umgestellt.',
      details: {
        applicable: false,
        titleKey: 'admin.instances.operations.keycloakSteps.realmBaseline.title',
        summaryKey: 'admin.instances.operations.keycloakSteps.realmBaseline.existing',
      },
    };
  }

  const realmBaselineAligned = Boolean(state?.realmBaselineAligned);
  const userProfileBaselineAligned = Boolean(state?.userProfileBaselineAligned);
  const instanceIdMapperAligned = (state?.protocolMappers ?? []).some(isInstanceIdMapperAligned);
  const aligned = realmBaselineAligned && userProfileBaselineAligned && instanceIdMapperAligned;

  return {
    stepKey: 'realm_baseline',
    title: 'Realm-Baseline anwenden',
    action: state?.realm ? (aligned ? 'verify' : 'update') : 'create',
    status: blocked ? 'blocked' : 'ready',
    summary: aligned
      ? 'Realm-Einstellungen, Benutzerprofil und instanceId-Mapper entsprechen der Baseline.'
      : 'Theme, deutsche Lokalisierung, Events, E-Mail-Grundkonfiguration, Benutzerprofil und Mapper werden automatisch eingerichtet.',
    details: {
      applicable: true,
      realmBaselineAligned,
      userProfileBaselineAligned,
      instanceIdMapperAligned,
      titleKey: 'admin.instances.operations.keycloakSteps.realmBaseline.title',
      summaryKey: aligned
        ? 'admin.instances.operations.keycloakSteps.realmBaseline.aligned'
        : 'admin.instances.operations.keycloakSteps.realmBaseline.pending',
    },
  };
};

const buildSmtpPasswordStep = (
  realmMode: InstanceRealmMode,
  state: KeycloakReadState | undefined,
  blocked: boolean
): KeycloakTenantPlan['steps'][number] => {
  const applicable = realmMode === 'new';
  const configured = Boolean(state?.realm?.smtpPasswordConfigured);
  return {
    stepKey: 'smtp_password',
    title: 'SMTP-Passwort manuell setzen',
    action: 'skip',
    status: blocked ? 'blocked' : 'ready',
    summary:
      realmMode === 'existing'
        ? 'Das SMTP-Passwort des Bestands-Realm bleibt unverändert.'
        : configured
          ? 'In Keycloak ist ein SMTP-Passwort hinterlegt.'
          : 'Nach der automatischen Grundkonfiguration muss nur das SMTP-Passwort direkt in Keycloak gesetzt werden.',
    details: {
      applicable,
      configured,
      reasonCode: !applicable
        ? 'new_realm_baseline_not_applicable'
        : configured
          ? 'smtp_password_configured'
          : 'smtp_password_required',
      actionCode: !applicable || configured ? 'none' : 'set_smtp_password_in_keycloak',
      titleKey: 'admin.instances.operations.keycloakSteps.smtpPassword.title',
      summaryKey: !applicable
        ? 'admin.instances.operations.keycloakSteps.smtpPassword.existing'
        : configured
          ? 'admin.instances.operations.keycloakSteps.smtpPassword.configured'
          : 'admin.instances.operations.keycloakSteps.smtpPassword.required',
    },
  };
};

export const buildRealmBaselinePlanSteps = (
  realmMode: InstanceRealmMode,
  state: KeycloakReadState | undefined,
  blocked: boolean
): KeycloakTenantPlan['steps'] => [
  buildRealmBaselineStep(realmMode, state, blocked),
  buildSmtpPasswordStep(realmMode, state, blocked),
];
