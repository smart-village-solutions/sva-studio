import type { IdentityProviderPort } from '../identity-provider-port.js';
import { haveEqualIdentityAttributes } from '../identity-attributes.js';
import {
  buildMainserverIdentityAttributes,
  createMainserverCredentialFingerprint,
  getSvaMainserverCredentialAttributeNames,
  verifyMainserverCredentialReadback,
} from '../mainserver-credentials.js';

import type { ProvisionedMainserverUserCredentials } from './mainserver-user-provisioning.js';
import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';

type TrackKeycloakCall = <T>(operation: string, execute: () => Promise<T>) => Promise<T>;

export const persistProvisionedMainserverCredentials = async (input: {
  identityProvider: Pick<IdentityProviderPort, 'getUserAttributes' | 'updateUser'>;
  instanceId: string;
  keycloakSubject: string;
  credentials: ProvisionedMainserverUserCredentials;
  trackKeycloakCall: TrackKeycloakCall;
}): Promise<void> => {
  const normalizedCredentials = {
    apiKey: input.credentials.mainserverUserApplicationId.trim(),
    apiSecret: input.credentials.mainserverUserApplicationSecret.trim(),
  };
  const readAttributes = async (attributeNames?: readonly string[]) => {
    try {
      return await input.trackKeycloakCall('get_user_attributes', () =>
        attributeNames
          ? input.identityProvider.getUserAttributes(input.keycloakSubject, attributeNames)
          : input.identityProvider.getUserAttributes(input.keycloakSubject)
      );
    } catch {
      throw new MainserverUserProvisioningError({
        code: 'mainserver_credentials_unavailable',
        message: 'Mainserver-Credentials konnten nach dem Speichern nicht geprüft werden.',
        statusCode: 503,
        retryable: true,
      });
    }
  };

  const existingAttributes = await readAttributes();
  const nextAttributes = buildMainserverIdentityAttributes({
    existingAttributes,
    mainserverUserApplicationId: normalizedCredentials.apiKey,
    mainserverUserApplicationSecret: normalizedCredentials.apiSecret,
  });
  const requiresWrite = !haveEqualIdentityAttributes(existingAttributes, nextAttributes);

  if (requiresWrite) {
    await input.trackKeycloakCall('update_user', () =>
      input.identityProvider.updateUser(input.keycloakSubject, {
        attributes: nextAttributes,
      })
    );
  }

  let readbackAttributes = existingAttributes;
  if (requiresWrite) {
    readbackAttributes = await readAttributes(getSvaMainserverCredentialAttributeNames());
  }

  const readback = verifyMainserverCredentialReadback({
    attributes: readbackAttributes,
    expectedFingerprint: createMainserverCredentialFingerprint({
      instanceId: input.instanceId,
      source: 'user',
      principalId: input.keycloakSubject,
      credentials: normalizedCredentials,
    }),
    instanceId: input.instanceId,
    principalId: input.keycloakSubject,
  });
  if (readback.status !== 'ready') {
    throw new MainserverUserProvisioningError({
      code: `mainserver_credentials_${readback.status}`,
      message: 'Mainserver-Credentials wurden nach dem Speichern nicht vollständig bestätigt.',
      statusCode: readback.status === 'unavailable' ? 503 : 409,
      retryable: readback.status === 'unavailable',
    });
  }
};
