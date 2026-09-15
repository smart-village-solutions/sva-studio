import { describe, expect, it } from 'vitest';

import {
  isInstanceIdMapperAligned,
  isKeycloakRealmBaselineAligned,
  KEYCLOAK_REALM_BASELINE,
  KEYCLOAK_REALM_BASELINE_FINGERPRINT,
} from './keycloak-realm-baseline.js';

describe('keycloak realm baseline', () => {
  it('contains only the German locale and no SMTP password', () => {
    expect(KEYCLOAK_REALM_BASELINE.realm.supportedLocales).toEqual(['de']);
    expect(KEYCLOAK_REALM_BASELINE.realm.defaultLocale).toBe('de');
    expect(KEYCLOAK_REALM_BASELINE.realm.smtpServer).not.toHaveProperty('password');
    expect(KEYCLOAK_REALM_BASELINE_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
  });

  it('requires every owned realm and SMTP field while allowing foreign fields', () => {
    const realm = {
      ...KEYCLOAK_REALM_BASELINE.realm,
      attributes: {
        ...KEYCLOAK_REALM_BASELINE.realm.attributes,
        tenantSpecific: 'preserved',
      },
      smtpServer: {
        ...KEYCLOAK_REALM_BASELINE.realm.smtpServer,
        password: 'masked-but-ignored',
      },
    };

    expect(isKeycloakRealmBaselineAligned(realm)).toBe(true);
    expect(isKeycloakRealmBaselineAligned({ ...realm, supportedLocales: ['de', 'en'] })).toBe(
      false
    );
    expect(
      isKeycloakRealmBaselineAligned({
        ...realm,
        smtpServer: { ...realm.smtpServer, host: 'other.example.org' },
      })
    ).toBe(false);
  });

  it('validates the complete instanceId mapper contract', () => {
    const mapper = {
      name: 'instanceId',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-usermodel-attribute-mapper',
      config: {
        'user.attribute': 'instanceId',
        'claim.name': 'instanceId',
        'jsonType.label': 'String',
        multivalued: 'false',
        'id.token.claim': 'true',
        'access.token.claim': 'true',
        'userinfo.token.claim': 'true',
      },
    };

    expect(isInstanceIdMapperAligned(mapper)).toBe(true);
    expect(
      isInstanceIdMapperAligned({
        ...mapper,
        config: { ...mapper.config, 'claim.name': 'wrongClaim' },
      })
    ).toBe(false);
  });
});
