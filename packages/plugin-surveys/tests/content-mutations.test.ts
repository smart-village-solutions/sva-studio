import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/surveys.pages.js', () => ({
  SurveyCreatePage: () => null,
  SurveyEditPage: () => null,
  SurveyListPage: () => null,
}));
const api = vi.hoisted(() => ({ remove: vi.fn(), read: vi.fn(), update: vi.fn() }));
vi.mock('../src/surveys.api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteSurvey: api.remove,
  getSurvey: api.read,
  updateSurvey: api.update,
}));
import { pluginSurveys as browser } from '../src/index.js';
import { pluginSurveys as descriptor } from '../src/plugin.js';
const mutations = browser.contentTypes?.[0]?.mutations;
beforeEach(() => vi.resetAllMocks());
describe('surveys content mutations', () => {
  it('keeps executable capabilities outside the Node descriptor', () => {
    expect(descriptor.contentTypes?.every((definition) => definition.mutations === undefined)).toBe(
      true
    );
    expect(mutations?.delete?.requiredAction).toBe('surveys.delete');
  });
  it('deletes through the existing client with the resource principal', async () => {
    await mutations?.delete?.execute('item-1', 'organization');
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('item-1', 'organization');
  });
  it.each([
    ['draft', 'DRAFT'],
    ['published', 'ACTIVE'],
    ['archived', 'ARCHIVED'],
  ] as const)('preserves locale and update contracts for %s', async (status, expected) => {
    const current = {
      id: 'item-1',
      title: { de: 'Titel', en: 'Title' },
      shortDescription: { en: 'Short' },
      description: { de: 'Description', en: 'Other' },
      status: 'DRAFT',
      startAt: 'start',
      endAt: 'end',
      resultVisibility: 'NONE',
      targetAreaIds: ['area-1'],
      showResultsInApp: false,
      isAnonymous: true,
      privacyNotice: { en: 'Privacy' },
      transparencyNotice: { de: 'Transparency' },
    };
    api.read.mockResolvedValue(current);
    await mutations?.status?.execute('item-1', status, 'organization');
    expect(api.update).toHaveBeenCalledExactlyOnceWith(
      'item-1',
      {
        title: 'Titel',
        shortDescription: 'Short',
        description: 'Description',
        status: expected,
        startAt: current.startAt,
        endAt: current.endAt,
        resultVisibility: current.resultVisibility,
        targetAreaIds: current.targetAreaIds,
        showResultsInApp: current.showResultsInApp,
        isAnonymous: current.isAnonymous,
        privacyNotice: 'Privacy',
        transparencyNotice: 'Transparency',
      },
      current,
      'organization'
    );
    expect(mutations?.delete?.requiresMainserverMutationAction).toBe(true);
    expect(mutations?.status?.requiresMainserverMutationAction).toBe(true);
  });
});
