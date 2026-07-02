import { beforeEach, describe, expect, it, vi } from 'vitest';

type CrudClientOptions = {
  createBody?: (input: unknown) => unknown;
  updateBody?: (input: unknown) => unknown;
};

let capturedOptions: CrudClientOptions | null = null;

vi.mock('@sva/plugin-sdk', () => ({
  createMainserverCrudClient: (options: CrudClientOptions) => {
    capturedOptions = options;

    return {
      create: async (input: unknown) => options.createBody?.(input),
      get: async () => {
        throw new Error('not_implemented');
      },
      list: async () => {
        throw new Error('not_implemented');
      },
      remove: async () => undefined,
      update: async (_contentId: string, input: unknown) => options.updateBody?.(input),
    };
  },
}));

describe('surveys api payload mapping', () => {
  beforeEach(() => {
    capturedOptions = null;
    vi.resetModules();
  });

  it('sends explicit clear values for optional survey fields during updates', async () => {
    const { updateSurvey } = await import('../src/surveys.api.js');

    const payload = await updateSurvey('survey-1', {
      title: 'Bestandsumfrage',
      status: 'DRAFT',
      isAnonymous: false,
      resultVisibility: 'NONE',
      targetAreaIds: [],
      showResultsInApp: false,
      questions: [],
    });

    expect(capturedOptions?.updateBody).toBeTypeOf('function');
    expect(payload).toEqual({
      title: { de: 'Bestandsumfrage' },
      shortDescription: null,
      description: null,
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      resultVisibility: 'NONE',
      targetAreaIds: [],
      showResultsInApp: false,
      isAnonymous: false,
      privacyNotice: null,
      transparencyNotice: null,
      questions: [],
    });
  });

  it('keeps required titles explicit and trimmed in create and update payloads', async () => {
    const { createSurvey, updateSurvey } = await import('../src/surveys.api.js');

    const createPayload = await createSurvey({
      title: '  Neue Umfrage  ',
      status: 'DRAFT',
      isAnonymous: false,
      questions: [
        {
          title: '  Frage 1  ',
          type: 'SINGLE_CHOICE',
          required: true,
          position: 0,
          options: [
            {
              title: '  Option A  ',
              position: 0,
              enablesFreeText: false,
            },
          ],
        },
      ],
    });

    const updatePayload = await updateSurvey('survey-1', {
      title: '   ',
      status: 'DRAFT',
      isAnonymous: false,
      questions: [],
    });

    expect(createPayload).toMatchObject({
      title: { de: 'Neue Umfrage' },
      questions: [
        {
          title: { de: 'Frage 1' },
          options: [{ title: { de: 'Option A' } }],
        },
      ],
    });
    expect(updatePayload).toMatchObject({
      title: { de: '' },
    });
  });

  it('forwards nested ids, delete markers, and null description clears during updates', async () => {
    const { updateSurvey } = await import('../src/surveys.api.js');

    const payload = await updateSurvey('survey-1', {
      title: 'Bestandsumfrage',
      status: 'ACTIVE',
      startAt: '2026-07-02T08:00:00.000Z',
      isAnonymous: true,
      resultVisibility: 'AFTER_SUBMISSION',
      targetAreaIds: ['area-1'],
      showResultsInApp: true,
      questions: [
        {
          id: 'question-1',
          title: 'Frage',
          type: 'SINGLE_CHOICE',
          required: true,
          position: 0,
          options: [
            {
              id: 'option-1',
              title: 'Option A',
              position: 0,
              enablesFreeText: false,
            },
            {
              id: 'option-2',
              delete: true,
            },
          ],
        },
        {
          id: 'question-2',
          delete: true,
        },
      ],
    });

    expect(payload).toEqual({
      title: { de: 'Bestandsumfrage' },
      shortDescription: null,
      description: null,
      status: 'ACTIVE',
      startAt: '2026-07-02T08:00:00.000Z',
      endAt: null,
      resultVisibility: 'AFTER_SUBMISSION',
      targetAreaIds: ['area-1'],
      showResultsInApp: true,
      isAnonymous: true,
      privacyNotice: null,
      transparencyNotice: null,
      questions: [
        {
          id: 'question-1',
          title: { de: 'Frage' },
          description: null,
          type: 'SINGLE_CHOICE',
          required: true,
          position: 0,
          options: [
            {
              id: 'option-1',
              title: { de: 'Option A' },
              position: 0,
              enablesFreeText: false,
            },
            {
              id: 'option-2',
              delete: true,
            },
          ],
        },
        {
          id: 'question-2',
          delete: true,
          description: null,
          options: [],
        },
      ],
    });
  });
});
