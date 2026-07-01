import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  validateCsrf: vi.fn(),
  listSvaMainserverSurveys: vi.fn(),
  getSvaMainserverSurvey: vi.fn(),
  deleteSvaMainserverSurvey: vi.fn(),
  createSvaMainserverSurvey: vi.fn(),
  updateSvaMainserverSurvey: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  createSdkLogger: vi.fn(() => ({ info: state.loggerInfo, warn: state.loggerWarn })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('./service.js', () => ({
  listSvaMainserverSurveys: state.listSvaMainserverSurveys,
  getSvaMainserverSurvey: state.getSvaMainserverSurvey,
  deleteSvaMainserverSurvey: state.deleteSvaMainserverSurvey,
  createSvaMainserverSurvey: state.createSvaMainserverSurvey,
  updateSvaMainserverSurvey: state.updateSvaMainserverSurvey,
}));

import { dispatchSvaMainserverSurveysRequest } from './surveys-route.js';

const ctx = {
  activeOrganizationId: '11111111-1111-1111-8111-111111111111',
  user: {
    id: 'subject-1',
    instanceId: 'de-musterhausen',
  },
};

const createRequest = (url: string, init?: RequestInit): Request =>
  new Request(url, {
    ...init,
    headers: {
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  });

const mockAuthorizedRequest = () => {
  state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
  state.validateCsrf.mockReturnValue(null);
  state.authorizeContentPrimitiveForUser.mockResolvedValue({
    ok: true,
    actor: {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      organizationId: '11111111-1111-1111-8111-111111111111',
    },
    permissions: [],
  });
};

describe('dispatchSvaMainserverSurveysRequest', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes', async () => {
    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/news')
    );

    expect(response).toBeNull();
  });

  it('lists surveys after read authorization', async () => {
    mockAuthorizedRequest();
    state.listSvaMainserverSurveys.mockResolvedValue({
      data: [{ id: 'survey-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'survey-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    expect(state.listSvaMainserverSurveys).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      page: 1,
      pageSize: 25,
    });
  });

  it('deletes surveys after delete authorization', async () => {
    mockAuthorizedRequest();
    state.deleteSvaMainserverSurvey.mockResolvedValue({ deletedSurveyId: 'survey-1' });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', {
        method: 'DELETE',
      })
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: { id: 'survey-1' },
    });
    expect(state.deleteSvaMainserverSurvey).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      surveyId: 'survey-1',
    });
  });
});
