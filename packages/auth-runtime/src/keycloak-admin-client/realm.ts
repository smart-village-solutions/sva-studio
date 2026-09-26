import { KeycloakTransport } from './transport.js';
import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './errors.js';
import { encodePathSegment, logKeycloakWriteFailure, logKeycloakWriteSuccess } from './helpers.js';
import type {
  KeycloakRealmReadRepresentation,
  KeycloakRealmRepresentation,
  KeycloakRealmSettings,
} from './internal-models.js';

export class KeycloakRealmOperations extends KeycloakTransport {
  async listRealms(): Promise<readonly { readonly realm: string }[]> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and realm listing is temporarily disabled.'
      );
    }
    const realms = await this.executeWithResilience<readonly KeycloakRealmRepresentation[]>({
      method: 'GET',
      path: '/admin/realms',
      operation: 'list_realms',
    });
    return realms.map(({ realm }) => ({ realm }));
  }

  async hasRealmCreateCapability(): Promise<boolean> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and realm-create capability inspection is temporarily disabled.'
      );
    }
    const token = await this.getAccessToken();
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    try {
      const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as {
        realm_access?: { roles?: unknown };
      };
      const roles = Array.isArray(payload.realm_access?.roles)
        ? payload.realm_access.roles.filter((role): role is string => typeof role === 'string')
        : [];
      return roles.includes('admin') || roles.includes('create-realm');
    } catch {
      return false;
    }
  }

  async ensureRealm(input: {
    displayName?: string;
    settings?: KeycloakRealmSettings;
  }): Promise<boolean> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: '/admin/realms',
        body: JSON.stringify({
          realm: this.realm,
          enabled: true,
          displayName: input.displayName,
          ...input.settings,
        }),
        operation: 'create_realm',
      });
      this.invalidateAccessTokenCache();
      logKeycloakWriteSuccess('create_realm', {
        operation: 'create_realm',
        realm: this.realm,
      });
      return true;
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError) || error.statusCode !== 409) {
        logKeycloakWriteFailure(
          'create_realm_failed',
          {
            operation: 'create_realm',
            realm: this.realm,
          },
          error
        );
        throw error;
      }
      return false;
    }
  }

  async deleteRealm(): Promise<void> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'DELETE',
        path: `/admin/realms/${encodePathSegment(this.realm)}`,
        operation: 'delete_realm',
      });
      this.invalidateAccessTokenCache();
      logKeycloakWriteSuccess('delete_realm', {
        operation: 'delete_realm',
        realm: this.realm,
      });
    } catch (error) {
      if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) {
        return;
      }
      logKeycloakWriteFailure(
        'delete_realm_failed',
        { operation: 'delete_realm', realm: this.realm },
        error
      );
      throw error;
    }
  }

  async getRealm(): Promise<KeycloakRealmReadRepresentation | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and realm lookup is temporarily disabled.'
      );
    }

    try {
      const realm = await this.executeWithResilience<KeycloakRealmRepresentation>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}`,
        operation: 'get_realm',
      });
      const smtpServer = realm.smtpServer ?? {};
      const smtpPassword = smtpServer.password?.trim();
      return {
        realm: realm.realm,
        loginTheme: realm.loginTheme,
        emailTheme: realm.emailTheme,
        internationalizationEnabled: realm.internationalizationEnabled,
        supportedLocales: realm.supportedLocales,
        defaultLocale: realm.defaultLocale,
        eventsEnabled: realm.eventsEnabled,
        eventsListeners: realm.eventsListeners,
        eventsExpiration: realm.eventsExpiration,
        adminEventsEnabled: realm.adminEventsEnabled,
        adminEventsDetailsEnabled: realm.adminEventsDetailsEnabled,
        resetPasswordAllowed: realm.resetPasswordAllowed,
        verifyEmail: realm.verifyEmail,
        attributes: realm.attributes,
        smtpServer: Object.fromEntries(
          Object.entries(smtpServer).filter(([key]) => key !== 'password')
        ),
        smtpPasswordConfigured: Boolean(smtpPassword && !/^\*+$/.test(smtpPassword)),
      };
    } catch (error) {
      if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateRealmSettings(settings: KeycloakRealmSettings): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}`,
      body: JSON.stringify(settings),
      operation: 'update_realm_settings',
    });
  }

  async getRealmEmailTheme(): Promise<string | undefined> {
    return (await this.getRealm())?.emailTheme;
  }

  async updateRealmEmailTheme(emailTheme: string): Promise<void> {
    await this.updateRealmSettings({ emailTheme });
  }

  async getRealmLocalizationTexts(locale: string): Promise<Readonly<Record<string, string>>> {
    return this.executeWithResilience<Readonly<Record<string, string>>>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/localization/${encodePathSegment(locale)}?useRealmDefaultLocaleFallback=false`,
      operation: 'get_realm_localization_texts',
    });
  }

  async updateRealmLocalizationTexts(
    locale: string,
    texts: Readonly<Record<string, string>>
  ): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/localization/${encodePathSegment(locale)}`,
      body: JSON.stringify(texts),
      operation: 'update_realm_localization_texts',
    });
  }

  async deleteRealmLocalizationText(locale: string, key: string): Promise<void> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'DELETE',
        path: `/admin/realms/${encodePathSegment(this.realm)}/localization/${encodePathSegment(locale)}/${encodePathSegment(key)}`,
        operation: 'delete_realm_localization_text',
      });
    } catch (error) {
      if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) return;
      throw error;
    }
  }
}
