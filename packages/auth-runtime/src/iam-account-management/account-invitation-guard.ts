import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import { readMailTemplate } from '../iam-instance-registry/mail-template-sync.js';

export const ensureAccountInvitationRealmValues = async (input: { readonly instanceId: string }): Promise<void> => {
  try {
    const view = await readMailTemplate(input.instanceId, 'invitation');
    if (view.status === 'synced') return;
  } catch { /* A failed comparison must never authorize a send. */ }
  throw new KeycloakAdminRequestError({
    message: 'Versand blockiert: Die Einladungsvorlage ist nicht synchronisiert. Unter Benutzerverwaltung > Einladungsvorlage den Keycloak-Abgleich öffnen und beheben.',
    statusCode: 409, code: 'account_invitation_template_drift', retryable: false,
  });
};
