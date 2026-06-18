import { beforeEach, describe, expect, it, vi } from 'vitest';

const dnsLookupMock = vi.hoisted(() => vi.fn());

const state = vi.hoisted(() => ({
  loadDefaultExternalInterfaceRecord: vi.fn(),
  readEffectiveSvaMainserverCredentialsWithStatus: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('node:dns/promises', () => ({
  lookup: dnsLookupMock,
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: state.loadDefaultExternalInterfaceRecord,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../mainserver-effective-credentials.js', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: state.readEffectiveSvaMainserverCredentialsWithStatus,
}));

const createActor = () => ({
  instanceId: 'bb-demo',
  actorAccountId: 'actor-1',
  requestId: 'req-1',
  traceId: 'trace-1',
});

const createPayload = () => ({
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Example',
  roleIds: [],
  sendPasswordSetupEmail: false,
});

describe('provisionMainserverUserCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dnsLookupMock.mockReset();
    dnsLookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://bb-demo.server.smart-village.app/graphql',
        oauthTokenUrl: 'https://bb-demo.server.smart-village.app/oauth/token',
      },
    });
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: {
        apiKey: 'admin-app',
        apiSecret: 'admin-secret',
      },
    });
  });

  it('rejects invalid upstream urls from the stored integration config', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://localhost/graphql',
        oauthTokenUrl: 'https://bb-demo.server.smart-village.app/oauth/token',
      },
    });

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn(),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'invalid_config',
      statusCode: 409,
    });
  });

  it('returns null and logs an info event when the integration record is missing or disabled', async () => {
    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');

    state.loadDefaultExternalInterfaceRecord.mockResolvedValueOnce(null);
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn(),
      })
    ).resolves.toBeNull();

    state.loadDefaultExternalInterfaceRecord.mockResolvedValueOnce({
      enabled: false,
      publicConfig: {},
    });
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn(),
      })
    ).resolves.toBeNull();

    expect(state.logger.info).toHaveBeenNthCalledWith(
      1,
      'SVA Mainserver user provisioning skipped because integration is not configured',
      expect.objectContaining({
        context: expect.objectContaining({ reason_code: 'config_not_found' }),
      })
    );
    expect(state.logger.info).toHaveBeenNthCalledWith(
      2,
      'SVA Mainserver user provisioning skipped because integration is not configured',
      expect.objectContaining({
        context: expect.objectContaining({ reason_code: 'integration_disabled' }),
      })
    );
  });

  it('rejects incomplete provisioning configs before fetching', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://bb-demo.server.smart-village.app/graphql',
      },
    });

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn(),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'mainserver_user_provisioning_config_incomplete',
      statusCode: 409,
    });
  });

  it('loads an admin bearer token, provisions the user, and returns Keycloak Mainserver attributes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'admin-token', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            keycloak: {
              attributes: {
                mainserverUserApplicationId: 'user-app',
                mainserverUserApplicationSecret: 'user-secret',
              },
            },
          }),
          { status: 200 }
        )
      );

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    const result = await provisionMainserverUserCredentials({
      actor: createActor(),
      actorSubject: 'kc-admin-1',
      keycloakSubject: 'kc-user-1',
      payload: createPayload(),
      fetchImpl,
    });

    expect(result).toEqual({
      mainserverUserApplicationId: 'user-app',
      mainserverUserApplicationSecret: 'user-secret',
    });
    expect(state.readEffectiveSvaMainserverCredentialsWithStatus).toHaveBeenCalledWith({
      instanceId: 'bb-demo',
      keycloakSubject: 'kc-admin-1',
      activeOrganizationId: undefined,
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://bb-demo.server.smart-village.app/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      })
    );
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toBe(
      'grant_type=client_credentials&client_id=admin-app&client_secret=admin-secret'
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://bb-demo.server.smart-village.app/api/v2/user_provisionings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          email: 'alice@example.com',
          keycloak_id: 'kc-user-1',
          first_name: 'Alice',
          last_name: 'Example',
        }),
      })
    );
  });

  it('passes the active organization id to the Mainserver credential lookup', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-token' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            keycloak: {
              attributes: {
                mainserverUserApplicationId: 'user-app',
                mainserverUserApplicationSecret: 'user-secret',
              },
            },
          }),
          { status: 200 }
        )
      );

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await provisionMainserverUserCredentials({
      actor: {
        ...createActor(),
        activeOrganizationId: '11111111-1111-4111-8111-111111111111',
      },
      actorSubject: 'kc-admin-1',
      keycloakSubject: 'kc-user-1',
      payload: createPayload(),
      fetchImpl,
    });

    expect(state.readEffectiveSvaMainserverCredentialsWithStatus).toHaveBeenCalledWith({
      instanceId: 'bb-demo',
      keycloakSubject: 'kc-admin-1',
      activeOrganizationId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('maps missing actor credentials to a typed provisioning error', async () => {
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'missing_credentials',
    });

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn(),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'missing_credentials',
      statusCode: 409,
    });
  });

  it('maps non-200 token responses to unauthorized and retryable token failures', async () => {
    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');

    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn().mockResolvedValueOnce(new Response('unauthorized', { status: 401 })),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'unauthorized',
      retryable: false,
      statusCode: 401,
    });

    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn().mockResolvedValueOnce(new Response('server error', { status: 503 })),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'token_request_failed',
      retryable: true,
      statusCode: 503,
    });
  });

  it('rejects invalid token and provisioning response bodies', async () => {
    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');

    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'missing-access-token' }), { status: 200 })),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'invalid_response',
      statusCode: 502,
    });

    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl: vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-token' }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ keycloak: { attributes: {} } }), { status: 200 })),
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'invalid_response',
      statusCode: 502,
    });
  });

  it('uses one abort signal for token and provisioning requests so the full provisioning flow is bounded', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'admin-token', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            keycloak: {
              attributes: {
                mainserverUserApplicationId: 'user-app',
                mainserverUserApplicationSecret: 'user-secret',
              },
            },
          }),
          { status: 200 }
        )
      );

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await provisionMainserverUserCredentials({
      actor: createActor(),
      actorSubject: 'kc-admin-1',
      keycloakSubject: 'kc-user-1',
      payload: createPayload(),
      fetchImpl,
    });

    const tokenSignal = fetchImpl.mock.calls[0]?.[1]?.signal;
    const provisioningSignal = fetchImpl.mock.calls[1]?.[1]?.signal;
    expect(tokenSignal).toBeInstanceOf(AbortSignal);
    expect(provisioningSignal).toBe(tokenSignal);
  });

  it('disables automatic redirects for token and provisioning requests', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-token' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            keycloak: {
              attributes: {
                mainserverUserApplicationId: 'user-app',
                mainserverUserApplicationSecret: 'user-secret',
              },
            },
          }),
          { status: 200 }
        )
      );

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await provisionMainserverUserCredentials({
      actor: createActor(),
      actorSubject: 'kc-admin-1',
      keycloakSubject: 'kc-user-1',
      payload: createPayload(),
      fetchImpl,
    });

    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe('manual');
    expect(fetchImpl.mock.calls[1]?.[1]?.redirect).toBe('manual');
  });

  it.each(['https://100.64.0.1/oauth/token', 'https://198.18.0.1/oauth/token'])(
    'rejects non-public IPv4 literal upstream url %s before fetching',
    async (oauthTokenUrl) => {
      state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
        enabled: true,
        publicConfig: {
          graphqlBaseUrl: 'https://bb-demo.server.smart-village.app/graphql',
          oauthTokenUrl,
        },
      });
      const fetchImpl = vi.fn();

      const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
      await expect(
        provisionMainserverUserCredentials({
          actor: createActor(),
          actorSubject: 'kc-admin-1',
          keycloakSubject: 'kc-user-1',
          payload: createPayload(),
          fetchImpl,
        })
      ).rejects.toMatchObject({
        name: 'MainserverUserProvisioningError',
        code: 'invalid_config',
        statusCode: 409,
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it('rejects IPv6 link-local literal upstream urls before fetching', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://bb-demo.server.smart-village.app/graphql',
        oauthTokenUrl: 'https://[fe90::1]/oauth/token',
      },
    });
    const fetchImpl = vi.fn();

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl,
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'invalid_config',
      statusCode: 409,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('provisions against the Mainserver endpoint even when the municipality id is not configured explicitly', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      enabled: true,
      publicConfig: {
        graphqlBaseUrl: 'https://bb-demo.server.smart-village.app/graphql',
        oauthTokenUrl: 'https://bb-demo.server.smart-village.app/oauth/token',
      },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'admin-token', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            keycloak: {
              attributes: {
                mainserverUserApplicationId: 'user-app',
                mainserverUserApplicationSecret: 'user-secret',
              },
            },
          }),
          { status: 200 }
        )
      );

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    const result = await provisionMainserverUserCredentials({
      actor: createActor(),
      actorSubject: 'kc-admin-1',
      keycloakSubject: 'kc-user-1',
      payload: createPayload(),
      fetchImpl,
    });

    expect(result).toEqual({
      mainserverUserApplicationId: 'user-app',
      mainserverUserApplicationSecret: 'user-secret',
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://bb-demo.server.smart-village.app/api/v2/user_provisionings',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'alice@example.com',
          keycloak_id: 'kc-user-1',
          first_name: 'Alice',
          last_name: 'Example',
        }),
      })
    );
  });

  it('maps Mainserver provisioning error payloads without exposing secrets', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-token' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'local_user_conflict',
            message: 'conflict',
            retryable: false,
          }),
          { status: 409 }
        )
      );

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl,
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'local_user_conflict',
      message: 'conflict',
      retryable: false,
      statusCode: 409,
    });
  });

  it('fails with a retryable timeout when the token request hangs', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    const fetchImpl = vi.fn().mockRejectedValueOnce(timeoutError);

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl,
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'upstream_timeout',
      retryable: true,
      statusCode: 504,
    });
  });

  it('fails with a retryable timeout when the provisioning request hangs', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'AbortError';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'admin-token' }), { status: 200 }))
      .mockRejectedValueOnce(timeoutError);

    const { provisionMainserverUserCredentials } = await import('./mainserver-user-provisioning.js');
    await expect(
      provisionMainserverUserCredentials({
        actor: createActor(),
        actorSubject: 'kc-admin-1',
        keycloakSubject: 'kc-user-1',
        payload: createPayload(),
        fetchImpl,
      })
    ).rejects.toMatchObject({
      name: 'MainserverUserProvisioningError',
      code: 'upstream_timeout',
      retryable: true,
      statusCode: 504,
    });
  });
});
