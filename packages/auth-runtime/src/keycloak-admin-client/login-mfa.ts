import { KeycloakPersonalMcpAccessOperations } from './personal-mcp-access.js';
import { encodePathSegment as enc } from './helpers.js';

import {
  owner,
  rootFor,
  specsFor,
  type Mode,
  type Policy,
  type Flow,
  type Entry,
  type Config,
  type Realm,
  type Client,
  type Spec,
} from './login-mfa-policy.js';

/** Provisioner-only operations. Tenant IAM never invokes provider flow writes. */
export class KeycloakLoginMfaOperations extends KeycloakPersonalMcpAccessOperations {
  private mfaRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    suffix: string,
    body?: unknown
  ): Promise<T> {
    return this.executeWithResilience<T>({
      method,
      path: `/admin/realms/${enc(this.realm)}${suffix}`,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      operation: 'tenant_login_mfa_policy',
    });
  }
  private mfaEntries(parent: string): Promise<Entry[]> {
    return this.mfaRequest('GET', `/authentication/flows/${enc(parent)}/executions`);
  }
  private async mfaConfig(entry: Entry): Promise<Config | null> {
    return entry.authenticationConfig
      ? this.mfaRequest('GET', `/authentication/config/${enc(entry.authenticationConfig)}`)
      : null;
  }
  private async inspectMfaBindings(input: Policy, allowMissingClients = false) {
    const realm = await this.mfaRequest<Realm>('GET', '');
    if (
      realm.browserFlow &&
      !['browser', rootFor('optional'), rootFor('required')].includes(realm.browserFlow)
    )
      throw new Error('login_mfa_binding_conflict:realm');
    const flows = await this.mfaRequest<Flow[]>('GET', '/authentication/flows');
    for (const flow of flows.filter((entry) => entry.alias.startsWith('studio-login-mfa-v1-'))) {
      if (flow.topLevel && flow.description !== owner)
        throw new Error('login_mfa_binding_conflict:flow_ownership');
    }
    const ownedIds = flows.filter((flow) => flow.description === owner).map((flow) => flow.id);
    const clients: Client[] = [];
    for (const clientId of [...new Set(input.clientIds)]) {
      const client = (await this.getOidcClientByClientId(clientId)) as Client | null;
      if (!client) {
        if (allowMissingClients) continue;
        throw new Error('login_mfa_client_missing');
      }
      const binding = client.authenticationFlowBindingOverrides?.browser;
      if (binding && !ownedIds.includes(binding))
        throw new Error('login_mfa_binding_conflict:client');
      clients.push(client);
    }
    return { realm, flows, clients };
  }

  async ensureLoginMfaPolicy(input: Policy): Promise<void> {
    await this.assertWriteAvailability();
    const { realm, flows, clients } = await this.inspectMfaBindings(input);
    const root = rootFor(input.mode);
    if (!flows.some((flow) => flow.alias === root))
      await this.mfaRequest('POST', '/authentication/flows', {
        alias: root,
        description: owner,
        providerId: 'basic-flow',
        topLevel: true,
        builtIn: false,
      });
    for (const spec of specsFor(input.mode)) await this.ensureMfaExecution(spec);
    const actions = await this.mfaRequest<
      { alias: string; enabled: boolean; defaultAction: boolean }[]
    >('GET', '/authentication/required-actions');
    const otp = actions.find((action) => action.alias === 'CONFIGURE_TOTP');
    if (!otp) throw new Error('login_mfa_otp_action_missing');
    if (!otp.enabled || otp.defaultAction)
      await this.mfaRequest('PUT', '/authentication/required-actions/CONFIGURE_TOTP', {
        ...otp,
        enabled: true,
        defaultAction: false,
      });
    const mapping = {
      ...(JSON.parse(realm.attributes?.['acr.loa.map'] ?? '{}') as Record<string, number>),
      pwd: 1,
      mfa: 2,
    };
    if (realm.browserFlow !== root || realm.attributes?.['acr.loa.map'] !== JSON.stringify(mapping))
      await this.mfaRequest('PUT', '', {
        ...realm,
        browserFlow: root,
        attributes: { ...realm.attributes, 'acr.loa.map': JSON.stringify(mapping) },
      });
    const flow = (await this.mfaRequest<Flow[]>('GET', '/authentication/flows')).find(
      (entry) => entry.alias === root
    );
    if (!flow) throw new Error('login_mfa_flow_missing');
    for (const client of clients) {
      const defaultAcr = input.mode === 'required' ? 'mfa' : 'pwd';
      if (client.attributes?.['default.acr.values'] !== defaultAcr) {
        client.attributes = { ...client.attributes, 'default.acr.values': defaultAcr };
        await this.mfaRequest('PUT', `/clients/${enc(client.id)}`, client);
      }
      // Existing managed overrides follow the tenant policy; unrelated bindings are rejected above.
      if (
        client.authenticationFlowBindingOverrides?.browser &&
        client.authenticationFlowBindingOverrides.browser !== flow.id
      )
        await this.mfaRequest('PUT', `/clients/${enc(client.id)}`, {
          ...client,
          authenticationFlowBindingOverrides: {
            ...client.authenticationFlowBindingOverrides,
            browser: flow.id,
          },
        });
      await this.ensureProtocolMapperForLoginMfa(client.id);
    }
    if (!(await this.readLoginMfaPolicy(input)).aligned)
      throw new Error('login_mfa_readback_mismatch');
  }

  private async ensureMfaExecution(spec: Spec): Promise<void> {
    let entries = (await this.mfaEntries(spec.parent)).filter((entry) => entry.level === 0);
    if (!entries.some((entry) => entry.displayName === spec.name)) {
      await this.mfaRequest(
        'POST',
        `/authentication/flows/${enc(spec.parent)}/executions/${spec.provider ? 'execution' : 'flow'}`,
        spec.provider
          ? { provider: spec.provider }
          : { alias: spec.name, type: 'basic-flow', provider: 'registration-page-form' }
      );
      entries = (await this.mfaEntries(spec.parent)).filter((entry) => entry.level === 0);
    }
    const matches = entries.filter((entry) => entry.displayName === spec.name);
    if (
      matches.length !== 1 ||
      (spec.provider ? matches[0].providerId !== spec.provider : !matches[0].authenticationFlow)
    )
      throw new Error('login_mfa_execution_conflict');
    const entry = matches[0];
    if (entry.requirement !== spec.requirement || entry.priority !== spec.priority)
      await this.mfaRequest('PUT', `/authentication/flows/${enc(spec.parent)}/executions`, {
        id: entry.id,
        requirement: spec.requirement,
        priority: spec.priority,
      });
    if (spec.config) {
      const previous = await this.mfaConfig(entry);
      if (
        !previous ||
        Object.entries(spec.config).some(([key, value]) => previous.config[key] !== value)
      )
        await this.mfaRequest(
          previous ? 'PUT' : 'POST',
          previous
            ? `/authentication/config/${enc(previous.id)}`
            : `/authentication/executions/${enc(entry.id)}/config`,
          {
            ...(previous ? { id: previous.id } : {}),
            alias: `${spec.parent}-${spec.provider}`,
            config: spec.config,
          }
        );
    }
  }

  private async ensureProtocolMapperForLoginMfa(clientId: string): Promise<void> {
    const path = `/clients/${enc(clientId)}/protocol-mappers/models`;
    const mappers = await this.mfaRequest<
      { id: string; name: string; protocolMapper: string; config: Record<string, string> }[]
    >('GET', path);
    const name = 'studio-login-mfa-acr';
    const mapper = mappers.find((item) => item.name === name);
    const desired = {
      name,
      protocol: 'openid-connect',
      protocolMapper: 'oidc-acr-mapper',
      config: {
        'id.token.claim': 'true',
        'access.token.claim': 'true',
        'introspection.token.claim': 'true',
      },
    };
    if (
      !mapper ||
      mapper.protocolMapper !== desired.protocolMapper ||
      Object.entries(desired.config).some(([key, value]) => mapper.config[key] !== value)
    )
      await this.mfaRequest(mapper ? 'PUT' : 'POST', mapper ? `${path}/${enc(mapper.id)}` : path, {
        ...desired,
        ...(mapper ? { id: mapper.id } : {}),
      });
  }

  private async isMfaExecutionTreeAligned(mode: Mode): Promise<boolean> {
    const specs = specsFor(mode);
    for (const parent of new Set(specs.map((spec) => spec.parent))) {
      const entries = (await this.mfaEntries(parent)).filter((entry) => entry.level === 0);
      const expected = specs.filter((spec) => spec.parent === parent);
      if (entries.length !== expected.length) return false;
      for (const spec of expected) {
        const entry = entries.find((item) => item.displayName === spec.name);
        if (
          !entry ||
          entry.requirement !== spec.requirement ||
          entry.priority !== spec.priority ||
          (spec.provider ? entry.providerId !== spec.provider : !entry.authenticationFlow)
        )
          return false;
        if (spec.config) {
          const config = await this.mfaConfig(entry);
          if (
            !config ||
            Object.entries(spec.config).some(([key, value]) => config.config[key] !== value)
          )
            return false;
        }
      }
    }
    return true;
  }

  private async isMfaClientAligned(client: Client, mode: Mode, flowId: string): Promise<boolean> {
    if (client.attributes?.['default.acr.values'] !== (mode === 'required' ? 'mfa' : 'pwd'))
      return false;
    if (
      client.authenticationFlowBindingOverrides?.browser &&
      client.authenticationFlowBindingOverrides.browser !== flowId
    )
      return false;
    const mappers = await this.mfaRequest<
      { name: string; protocolMapper: string; config: Record<string, string> }[]
    >('GET', `/clients/${enc(client.id)}/protocol-mappers/models`);
    if (
      !mappers.some(
        (mapper) =>
          mapper.name === 'studio-login-mfa-acr' &&
          mapper.protocolMapper === 'oidc-acr-mapper' &&
          mapper.config['access.token.claim'] === 'true' &&
          mapper.config['id.token.claim'] === 'true'
      )
    )
      return false;
    return true;
  }

  async readLoginMfaPolicy(input: Policy): Promise<{ aligned: boolean; mode: Mode }> {
    const { realm, flows, clients } = await this.inspectMfaBindings(input, true);
    const root = rootFor(input.mode),
      flow = flows.find((entry) => entry.alias === root);
    const unaligned = { aligned: false, mode: input.mode };
    if (!flow || realm.browserFlow !== root || clients.length !== new Set(input.clientIds).size)
      return unaligned;
    const mapping = JSON.parse(realm.attributes?.['acr.loa.map'] ?? '{}') as Record<string, number>;
    if (mapping.pwd !== 1 || mapping.mfa !== 2) return unaligned;
    if (!(await this.isMfaExecutionTreeAligned(input.mode))) return unaligned;
    const actions = await this.mfaRequest<
      { alias: string; enabled: boolean; defaultAction: boolean }[]
    >('GET', '/authentication/required-actions');
    if (
      !actions.some(
        (action) => action.alias === 'CONFIGURE_TOTP' && action.enabled && !action.defaultAction
      )
    )
      return unaligned;
    for (const client of clients) {
      if (!(await this.isMfaClientAligned(client, input.mode, flow.id))) return unaligned;
    }
    return { aligned: true, mode: input.mode };
  }
}
