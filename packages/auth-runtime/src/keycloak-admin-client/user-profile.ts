import { KeycloakProtocolMapperOperations } from './protocol-mappers.js';
import { KeycloakAdminRequestError } from './errors.js';
import { encodePathSegment, isPreservedJson, isSemanticallyEqualJson } from './helpers.js';
import type { KeycloakUserProfileConfig } from './internal-models.js';

const hasAdminOnlyUserProfileAttributes = (
  profile: KeycloakUserProfileConfig,
  desiredAttributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
): boolean =>
  desiredAttributes.every((desired) => {
    const matches = (profile.attributes ?? []).filter(
      (attribute) => attribute.name === desired.name
    );
    const attribute = matches[0];
    return (
      matches.length === 1 &&
      Boolean(attribute?.multivalued) === desired.multivalued &&
      attribute?.permissions?.view?.length === 1 &&
      attribute.permissions.view[0] === 'admin' &&
      attribute.permissions.edit?.length === 1 &&
      attribute.permissions.edit[0] === 'admin'
    );
  });

export class KeycloakUserProfileOperations extends KeycloakProtocolMapperOperations {
  async ensureAdminOnlyUserProfileAttributes(
    attributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
  ): Promise<void> {
    await this.assertWriteAvailability();
    const path = `/admin/realms/${encodePathSegment(this.realm)}/users/profile`;
    const profile = await this.executeWithResilience<KeycloakUserProfileConfig>({
      method: 'GET',
      path,
      operation: 'read_user_profile',
    });
    const desiredByName = new Map(attributes.map((attribute) => [attribute.name, attribute]));
    const existingAttributes = profile.attributes ?? [];
    const adminOnlyPermissions = { view: ['admin'], edit: ['admin'] } as const;
    if (hasAdminOnlyUserProfileAttributes(profile, attributes)) return;

    const retainedNames = new Set<string>();
    const nextAttributes = existingAttributes.map((attribute) => {
      const desired = desiredByName.get(attribute.name);
      if (!desired || retainedNames.has(attribute.name)) return attribute;
      retainedNames.add(attribute.name);
      return {
        ...attribute,
        multivalued: desired.multivalued,
        permissions: adminOnlyPermissions,
      };
    });
    for (const desired of attributes) {
      if (retainedNames.has(desired.name)) continue;
      nextAttributes.push({
        name: desired.name,
        multivalued: desired.multivalued,
        permissions: adminOnlyPermissions,
      });
    }

    const preWriteProfile = await this.executeWithResilience<KeycloakUserProfileConfig>({
      method: 'GET',
      path,
      operation: 'verify_user_profile_precondition',
    });
    if (!isSemanticallyEqualJson(profile, preWriteProfile)) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak user profile changed concurrently.',
        statusCode: 409,
        code: 'user_profile_concurrent_modification',
        retryable: true,
      });
    }

    await this.executeWithResilience<void>({
      method: 'PUT',
      path,
      body: JSON.stringify({ ...profile, attributes: nextAttributes }),
      operation: 'update_user_profile',
    });
    const readBack = await this.executeWithResilience<KeycloakUserProfileConfig>({
      method: 'GET',
      path,
      operation: 'verify_user_profile',
    });
    if (!hasAdminOnlyUserProfileAttributes(readBack, attributes)) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak user profile attribute read-back mismatch.',
        statusCode: 502,
        code: 'user_profile_attribute_readback_mismatch',
        retryable: true,
      });
    }
    if (!isPreservedJson({ ...profile, attributes: nextAttributes }, readBack)) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak user profile preservation read-back mismatch.',
        statusCode: 502,
        code: 'user_profile_preservation_readback_mismatch',
        retryable: false,
      });
    }
  }

  async hasAdminOnlyUserProfileAttributes(
    attributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
  ): Promise<boolean> {
    const profile = await this.executeWithResilience<KeycloakUserProfileConfig>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/profile`,
      operation: 'verify_user_profile_permissions',
    });
    return hasAdminOnlyUserProfileAttributes(profile, attributes);
  }
}
