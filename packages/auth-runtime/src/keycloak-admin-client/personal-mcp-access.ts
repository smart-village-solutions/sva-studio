import { KeycloakUserProfileOperations } from './user-profile.js';
import { encodePathSegment } from './helpers.js';

const clientId = 'sva-studio-mcp-personal';
const root = 'sva-studio-mcp-personal-browser';
const login = 'sva-studio-mcp-personal-login';
const forms = 'sva-studio-mcp-personal-forms';
const otp = 'sva-studio-mcp-personal-otp';
const guard = 'sva-studio-mcp-personal-guard';
const redirectUri = 'http://127.0.0.1:8765/callback';

type Flow = { id: string; alias: string; topLevel?: boolean };
type Execution = {
  id: string;
  displayName: string;
  providerId?: string;
  authenticationFlow?: boolean;
  flowId?: string;
  authenticationConfig?: string;
  requirement: string;
  priority: number;
  level: number;
};
type Config = { id: string; alias: string; config: Record<string, string> };
type BoundClient = {
  id: string;
  enabled?: boolean;
  authenticationFlowBindingOverrides?: Record<string, string>;
};

export class KeycloakPersonalMcpAccessOperations extends KeycloakUserProfileOperations {
  private path(suffix: string): string {
    return `/admin/realms/${encodePathSegment(this.realm)}${suffix}`;
  }

  private async executions(alias: string): Promise<Execution[]> {
    return this.executeWithResilience<Execution[]>({
      method: 'GET',
      path: this.path(`/authentication/flows/${encodePathSegment(alias)}/executions`),
      operation: 'read_personal_mcp_flow_executions',
    });
  }

  private async execution(parent: string, name: string): Promise<Execution | null> {
    const matches = (await this.executions(parent)).filter(
      (entry) => entry.level === 0 && entry.displayName === name
    );
    if (matches.length > 1) throw new Error('personal_mcp_flow_duplicate_execution');
    return matches[0] ?? null;
  }

  private async ensureSubflow(parent: string, alias: string): Promise<void> {
    if (!(await this.execution(parent, alias))) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: this.path(`/authentication/flows/${encodePathSegment(parent)}/executions/flow`),
        body: JSON.stringify({ alias, type: 'basic-flow', provider: 'registration-page-form' }),
        operation: 'create_personal_mcp_subflow',
      });
    }
    if (!(await this.execution(parent, alias))?.authenticationFlow) {
      throw new Error('personal_mcp_subflow_readback_mismatch');
    }
  }

  private async ensureAuthenticator(parent: string, name: string, provider: string): Promise<void> {
    if (!(await this.execution(parent, name))) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: this.path(`/authentication/flows/${encodePathSegment(parent)}/executions/execution`),
        body: JSON.stringify({ provider }),
        operation: 'create_personal_mcp_execution',
      });
    }
    if ((await this.execution(parent, name))?.providerId !== provider) {
      throw new Error('personal_mcp_execution_provider_mismatch');
    }
  }

  private async setExecution(
    parent: string,
    name: string,
    requirement: 'REQUIRED' | 'ALTERNATIVE' | 'CONDITIONAL',
    priority: number
  ): Promise<void> {
    const entry = await this.execution(parent, name);
    if (!entry) throw new Error('personal_mcp_execution_missing');
    if (entry.requirement !== requirement || entry.priority !== priority) {
      await this.executeWithResilience<void>({
        method: 'PUT',
        path: this.path(`/authentication/flows/${encodePathSegment(parent)}/executions`),
        body: JSON.stringify({ id: entry.id, requirement, priority }),
        operation: 'update_personal_mcp_execution',
      });
    }
    const readBack = await this.execution(parent, name);
    if (readBack?.requirement !== requirement || readBack.priority !== priority) {
      throw new Error('personal_mcp_execution_readback_mismatch');
    }
  }

  private async ensureGuardConfig(): Promise<void> {
    const entry = await this.execution(guard, 'Condition - user attribute');
    if (!entry) throw new Error('personal_mcp_guard_missing');
    const desired = {
      attribute_name: 'svaStudioMcpAccess',
      attribute_expected_value: 'true',
      not: 'true',
      include_group_attributes: 'false',
      regex: 'false',
    };
    const path = entry.authenticationConfig
      ? this.path(`/authentication/config/${encodePathSegment(entry.authenticationConfig)}`)
      : this.path(`/authentication/executions/${encodePathSegment(entry.id)}/config`);
    const previous = entry.authenticationConfig
      ? await this.executeWithResilience<Config>({ method: 'GET', path, operation: 'read_personal_mcp_guard' })
      : null;
    if (!previous || Object.entries(desired).some(([key, value]) => previous.config[key] !== value)) {
      await this.executeWithResilience<void>({
        method: previous ? 'PUT' : 'POST',
        path,
        body: JSON.stringify({
          ...(previous ? { id: previous.id } : {}),
          alias: 'sva-studio-mcp-personal-attribute-guard',
          config: desired,
        }),
        operation: 'configure_personal_mcp_guard',
      });
    }
    const configured = await this.execution(guard, 'Condition - user attribute');
    if (!configured?.authenticationConfig) throw new Error('personal_mcp_guard_config_missing');
    const readBack = await this.executeWithResilience<Config>({
      method: 'GET',
      path: this.path(`/authentication/config/${encodePathSegment(configured.authenticationConfig)}`),
      operation: 'verify_personal_mcp_guard',
    });
    if (Object.entries(desired).some(([key, value]) => readBack.config[key] !== value)) {
      throw new Error('personal_mcp_guard_readback_mismatch');
    }
  }

  private async ensureFlow(): Promise<string> {
    const flowPath = this.path('/authentication/flows');
    const flows = await this.executeWithResilience<Flow[]>({ method: 'GET', path: flowPath, operation: 'read_personal_mcp_flows' });
    if (!flows.some((flow) => flow.alias === root)) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: flowPath,
        body: JSON.stringify({
          alias: root,
          description: 'Personal Studio MCP login; provider attribute is checked after identity authentication.',
          providerId: 'basic-flow',
          topLevel: true,
          builtIn: false,
        }),
        operation: 'create_personal_mcp_flow',
      });
    }
    await this.ensureSubflow(root, login);
    await this.ensureAuthenticator(login, 'Cookie', 'auth-cookie');
    await this.ensureSubflow(login, forms);
    await this.ensureAuthenticator(forms, 'Username Password Form', 'auth-username-password-form');
    await this.ensureSubflow(forms, otp);
    await this.ensureAuthenticator(otp, 'Condition - user configured', 'conditional-user-configured');
    await this.ensureAuthenticator(otp, 'OTP Form', 'auth-otp-form');
    await this.ensureSubflow(root, guard);
    await this.ensureAuthenticator(guard, 'Condition - user attribute', 'conditional-user-attribute');
    await this.ensureAuthenticator(guard, 'Deny access', 'deny-access-authenticator');
    for (const [parent, name, requirement, priority] of [
      [root, login, 'REQUIRED', 0], [root, guard, 'CONDITIONAL', 10],
      [login, 'Cookie', 'ALTERNATIVE', 0], [login, forms, 'ALTERNATIVE', 10],
      [forms, 'Username Password Form', 'REQUIRED', 0], [forms, otp, 'CONDITIONAL', 10],
      [otp, 'Condition - user configured', 'REQUIRED', 0], [otp, 'OTP Form', 'REQUIRED', 10],
      [guard, 'Condition - user attribute', 'REQUIRED', 0], [guard, 'Deny access', 'REQUIRED', 10],
    ] as const) await this.setExecution(parent, name, requirement, priority);
    await this.ensureGuardConfig();
    const readBack = await this.executeWithResilience<Flow[]>({ method: 'GET', path: flowPath, operation: 'verify_personal_mcp_flow' });
    const matches = readBack.filter((flow) => flow.alias === root && flow.topLevel);
    if (matches.length !== 1) throw new Error('personal_mcp_flow_readback_mismatch');
    return matches[0].id;
  }

  async ensurePersonalMcpAccess(audienceClientId: string): Promise<void> {
    await this.assertWriteAvailability();
    if (!(await this.getOidcClientByClientId(audienceClientId))) {
      throw new Error('personal_mcp_audience_client_missing');
    }
    await this.ensureAdminOnlyUserProfileAttributes([{ name: 'svaStudioMcpAccess', multivalued: false }]);
    const flowId = await this.ensureFlow();
    const existing = await this.getOidcClientByClientId(clientId);
    await this.ensureOidcClient({
      clientId,
      redirectUris: [redirectUri],
      postLogoutRedirectUris: [],
      webOrigins: [],
      rootUrl: '',
      enabled: existing?.enabled === true,
      standardFlowEnabled: true,
      publicClient: true,
      pkceCodeChallengeMethod: 'S256',
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      uriPolicy: 'replace',
    });
    await this.ensureAudienceProtocolMapper({
      clientId,
      name: 'sva-studio-api-audience',
      audience: audienceClientId,
    });
    const bound = await this.getOidcClientByClientId(clientId) as BoundClient | null;
    if (!bound) throw new Error('personal_mcp_client_missing');
    if (bound.authenticationFlowBindingOverrides?.browser !== flowId) {
      await this.executeWithResilience<void>({
        method: 'PUT',
        path: this.path(`/clients/${encodePathSegment(bound.id)}`),
        body: JSON.stringify({
          ...bound,
          authenticationFlowBindingOverrides: {
            ...bound.authenticationFlowBindingOverrides,
            browser: flowId,
          },
        }),
        operation: 'bind_personal_mcp_flow',
      });
    }
    const readBack = await this.getOidcClientByClientId(clientId) as BoundClient | null;
    if (readBack?.authenticationFlowBindingOverrides?.browser !== flowId) {
      throw new Error('personal_mcp_client_binding_readback_mismatch');
    }
  }
}
