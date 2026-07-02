import { beforeEach, describe, expect, it, vi } from 'vitest';

type CrudClientOptions = {
  errorFactory?: (code: string, message?: string) => Error;
  createBody?: (input: unknown) => unknown;
  mapListResponse?: (input: unknown) => unknown;
  updateBody?: (input: unknown) => unknown;
};

let capturedOptions: CrudClientOptions | null = null;

vi.mock('@sva/plugin-sdk', () => ({
  createMainserverCrudClient: (options: CrudClientOptions) => {
    capturedOptions = options;

    return {
      create: async (input: unknown) => options.createBody?.(input),
      get: async (contentId: unknown) => contentId,
      list: async (query: unknown) => options.mapListResponse?.(query),
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
        },
      ],
    });
  });

  it('preserves loaded locale maps when updating existing survey content', async () => {
    const { updateSurvey } = await import('../src/surveys.api.js');

    const payload = await updateSurvey(
      'survey-1',
      {
        title: 'Aktualisierte Umfrage',
        shortDescription: 'Kurzfassung',
        description: 'Beschreibung',
        status: 'ACTIVE',
        isAnonymous: false,
        resultVisibility: 'AFTER_SUBMISSION',
        targetAreaIds: [],
        showResultsInApp: true,
        privacyNotice: 'Datenschutz',
        transparencyNotice: 'Transparenz',
        questions: [
          {
            id: 'question-1',
            title: 'Aktualisierte Frage',
            description: 'Neue Beschreibung',
            type: 'SINGLE_CHOICE',
            required: true,
            position: 0,
            options: [
              {
                id: 'option-1',
                title: 'Aktualisierte Option',
                position: 0,
                enablesFreeText: false,
              },
            ],
          },
        ],
      },
      {
        id: 'survey-1',
        contentType: 'surveys.survey',
        title: { de: 'Bestehende Umfrage', en: 'Existing survey' },
        shortDescription: { de: 'Bestehende Kurzfassung', en: 'Existing summary' },
        description: { de: 'Bestehende Beschreibung', en: 'Existing description' },
        status: 'ACTIVE',
        isAnonymous: false,
        resultVisibility: 'AFTER_SUBMISSION',
        targetAreaIds: [],
        showResultsInApp: true,
        privacyNotice: { de: 'Bestehender Datenschutz', en: 'Existing privacy notice' },
        transparencyNotice: { de: 'Bestehende Transparenz', en: 'Existing transparency notice' },
        questions: [
          {
            id: 'question-1',
            surveyId: 'survey-1',
            title: { de: 'Bestehende Frage', en: 'Existing question' },
            description: { de: 'Bestehende Fragebeschreibung', en: 'Existing question description' },
            type: 'SINGLE_CHOICE',
            required: true,
            position: 0,
            options: [
              {
                id: 'option-1',
                questionId: 'question-1',
                title: { de: 'Bestehende Option', en: 'Existing option' },
                position: 0,
                enablesFreeText: false,
              },
            ],
          },
        ],
        questionCount: 1,
        participationCount: 0,
        submissionCount: 0,
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-02T08:00:00.000Z',
      }
    );

    expect(payload).toMatchObject({
      title: { de: 'Aktualisierte Umfrage', en: 'Existing survey' },
      shortDescription: { de: 'Kurzfassung', en: 'Existing summary' },
      description: { de: 'Beschreibung', en: 'Existing description' },
      privacyNotice: { de: 'Datenschutz', en: 'Existing privacy notice' },
      transparencyNotice: { de: 'Transparenz', en: 'Existing transparency notice' },
      questions: [
        {
          id: 'question-1',
          title: { de: 'Aktualisierte Frage', en: 'Existing question' },
          description: { de: 'Neue Beschreibung', en: 'Existing question description' },
          options: [
            {
              id: 'option-1',
              title: { de: 'Aktualisierte Option', en: 'Existing option' },
            },
          ],
        },
      ],
    });
  });

  it('keeps the list/get/delete wrappers and the custom surveys error contract wired through the CRUD client', async () => {
    const { deleteSurvey, getSurvey, listSurveys } = await import('../src/surveys.api.js');

    await expect(listSurveys({ page: 2, pageSize: 50 })).resolves.toEqual({ page: 2, pageSize: 50 });
    await expect(getSurvey('survey-42')).resolves.toBe('survey-42');
    await expect(deleteSurvey('survey-42')).resolves.toBeUndefined();

    const error = capturedOptions?.errorFactory?.('validation_error', 'Titel fehlt.');
    expect(error).toMatchObject({
      code: 'validation_error',
      message: 'Titel fehlt.',
      name: 'SurveysApiError',
    });
  });
});
