import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  requestJson: vi.fn(),
  options: undefined as unknown,
}));

vi.mock('@sva/plugin-sdk', () => ({
  createMainserverCrudClient: (options: unknown) => {
    state.options = options;
    return state;
  },
  requestMainserverJson: state.requestJson,
}));

describe('cockpit cards api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('configures and delegates all CRUD operations', async () => {
    const api = await import('../src/cockpit-cards.api.js');
    const options = state.options as {
      basePath: string;
      errorFactory: (code: string, message?: string) => Error;
      mapListResponse: <T>(value: T) => T;
    };
    expect(options.basePath).toBe('/api/v1/mainserver/cockpit-cards');
    expect(options.mapListResponse({ data: [] })).toEqual({ data: [] });
    expect(options.errorFactory('forbidden', 'Nicht erlaubt')).toEqual(
      new api.CockpitCardsApiError('forbidden', 'Nicht erlaubt')
    );

    api.listCockpitCards({ page: 2, pageSize: 50 });
    api.getCockpitCard('card-1');
    api.createCockpitCard({} as never);
    api.updateCockpitCard('card-1', {} as never);
    api.deleteCockpitCard('card-1');
    expect(state.list).toHaveBeenCalledWith({ page: 2, pageSize: 50 });
    expect(state.get).toHaveBeenCalledWith('card-1');
    expect(state.create).toHaveBeenCalledWith({});
    expect(state.update).toHaveBeenCalledWith('card-1', {});
    expect(state.remove).toHaveBeenCalledWith('card-1');
  });

  it('loads category options through the host boundary', async () => {
    state.requestJson.mockResolvedValue({ data: [{ id: 'category-1', name: 'Startseite' }] });
    const api = await import('../src/cockpit-cards.api.js');

    await expect(api.listCockpitCardCategories()).resolves.toEqual([
      { id: 'category-1', name: 'Startseite' },
    ]);
    expect(state.requestJson).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/mainserver/categories' })
    );
  });
});
