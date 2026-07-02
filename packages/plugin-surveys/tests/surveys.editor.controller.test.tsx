import { act, renderHook, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSurveyEditorController } from '../src/surveys.editor.controller.js';
import type { SurveyDetailFormValues } from '../src/surveys.detail-form.js';

const createSurveyMock = vi.fn();
const getSurveyMock = vi.fn();
const updateSurveyMock = vi.fn();

vi.mock('../src/surveys.api.js', () => ({
  createSurvey: (...args: unknown[]) => createSurveyMock(...args),
  getSurvey: (...args: unknown[]) => getSurveyMock(...args),
  updateSurvey: (...args: unknown[]) => updateSurveyMock(...args),
}));

const pt = (key: string): string =>
  ({
    'messages.missingContentId': 'Keine Umfrage-ID vorhanden.',
    'messages.createSuccess': 'Umfrage wurde angelegt.',
    'messages.updateSuccess': 'Umfrage wurde gespeichert.',
    'messages.createError': 'Umfrage konnte nicht angelegt werden.',
    'messages.updateError': 'Umfrage konnte nicht gespeichert werden.',
    'messages.loadError': 'Umfrage konnte nicht geladen werden.',
  })[key] ?? key;

describe('useSurveyEditorController', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blocks edit submits without a content id before calling updateSurvey', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    const { result } = renderHook(() => {
      const methods = useForm<SurveyDetailFormValues>({
        defaultValues: {
          title: 'Bestandsumfrage',
          basis: {
            status: 'DRAFT',
            startAt: '',
            endAt: '',
            targetAreaIds: [],
          },
          content: {
            shortDescription: '',
            description: '',
            isAnonymous: false,
            showResultsInApp: false,
            resultVisibility: 'NONE',
            privacyNotice: '',
            transparencyNotice: '',
            questions: [],
          },
        },
      });

      return useSurveyEditorController({
        mode: 'edit',
        methods,
        pt,
        navigateToContentList,
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(updateSurveyMock).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'error', text: 'Keine Umfrage-ID vorhanden.' });
    expect(navigateToContentList).not.toHaveBeenCalled();
  });

  it('resets loaded form state when edit mode is missing a content id', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    let methodsRef: ReturnType<typeof useForm<SurveyDetailFormValues>> | undefined;

    const { result } = renderHook(() => {
      const methods = useForm<SurveyDetailFormValues>({
        defaultValues: {
          title: 'Vorherige Umfrage',
          basis: {
            status: 'ACTIVE',
            startAt: '2026-07-01T08:00:00.000Z',
            endAt: '',
            targetAreaIds: ['district-1'],
          },
          content: {
            shortDescription: 'Kurztext',
            description: 'Detailtext',
            isAnonymous: true,
            showResultsInApp: true,
            resultVisibility: 'AFTER_SUBMISSION',
            privacyNotice: 'Datenschutz',
            transparencyNotice: 'Transparenz',
            questions: [],
          },
        },
      });
      methodsRef = methods;

      return useSurveyEditorController({
        mode: 'edit',
        methods,
        pt,
        navigateToContentList,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadedItem).toBeNull();
      expect(result.current.status).toEqual({ kind: 'error', text: 'Keine Umfrage-ID vorhanden.' });
    });

    expect(methodsRef?.getValues()).toEqual({
      title: '',
      basis: {
        status: 'DRAFT',
        startAt: '',
        endAt: '',
        targetAreaIds: [],
      },
      content: {
        shortDescription: '',
        description: '',
        isAnonymous: false,
        showResultsInApp: false,
        resultVisibility: 'NONE',
        privacyNotice: '',
        transparencyNotice: '',
        questions: [],
      },
    });
    expect(getSurveyMock).not.toHaveBeenCalled();
  });

  it('clears stale status when switching from edit to create mode', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ mode, contentId }: { mode: 'edit' | 'create'; contentId?: string }) => {
        const methods = useForm<SurveyDetailFormValues>({
          defaultValues: createEmptyFormValues(),
        });

        return useSurveyEditorController({
          mode,
          contentId,
          methods,
          pt,
          navigateToContentList,
        });
      },
      {
        initialProps: { mode: 'edit' as const },
      }
    );

    await waitFor(() => {
      expect(result.current.status).toEqual({ kind: 'error', text: 'Keine Umfrage-ID vorhanden.' });
    });

    rerender({ mode: 'create' });

    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadedItem).toBeNull();
    });
  });

  it('preserves loaded survey results after edit saves that return no results payload', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    getSurveyMock.mockResolvedValue({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage' },
      status: 'ACTIVE',
      isAnonymous: false,
      resultVisibility: 'NONE',
      showResultsInApp: false,
      targetAreaIds: [],
      questions: [],
      questionCount: 0,
      participationCount: 0,
      submissionCount: 0,
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-02T08:00:00.000Z',
      results: {
        surveyId: 'survey-1',
        participationCount: 4,
        submissionCount: 3,
        questions: [],
      },
    });
    updateSurveyMock.mockResolvedValue({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage aktualisiert' },
      status: 'ACTIVE',
      isAnonymous: false,
      resultVisibility: 'NONE',
      showResultsInApp: false,
      targetAreaIds: [],
      questions: [],
      questionCount: 0,
      participationCount: 0,
      submissionCount: 0,
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-02T09:00:00.000Z',
    });

    const { result } = renderHook(() => {
      const methods = useForm<SurveyDetailFormValues>({
        defaultValues: {
          title: '',
          basis: {
            status: 'DRAFT',
            startAt: '',
            endAt: '',
            targetAreaIds: [],
          },
          content: {
            shortDescription: '',
            description: '',
            isAnonymous: false,
            showResultsInApp: false,
            resultVisibility: 'NONE',
            privacyNotice: '',
            transparencyNotice: '',
            questions: [],
          },
        },
      });

      return useSurveyEditorController({
        mode: 'edit',
        contentId: 'survey-1',
        methods,
        pt,
        navigateToContentList,
      });
    });

    await waitFor(() => {
      expect(result.current.loadedItem?.id).toBe('survey-1');
      expect(result.current.loadedItem?.results?.participationCount).toBe(4);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(updateSurveyMock).toHaveBeenCalledOnce();
    expect(result.current.loadedItem).toMatchObject({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage aktualisiert' },
      results: {
        surveyId: 'survey-1',
        participationCount: 4,
        submissionCount: 3,
        questions: [],
      },
    });
    expect(navigateToContentList).not.toHaveBeenCalled();
  });

  it('creates surveys, reports success, and navigates back to the content list', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    createSurveyMock.mockResolvedValue({
      id: 'survey-created',
      title: { de: 'Neue Umfrage' },
      status: 'DRAFT',
      isAnonymous: false,
      resultVisibility: 'NONE',
      showResultsInApp: false,
      targetAreaIds: [],
      questions: [],
      questionCount: 0,
      participationCount: 0,
      submissionCount: 0,
      createdAt: '2026-07-02T09:00:00.000Z',
      updatedAt: '2026-07-02T09:00:00.000Z',
    });

    const { result } = renderHook(() => {
      const methods = useForm<SurveyDetailFormValues>({
        defaultValues: {
          ...createEmptyFormValues(),
          title: 'Neue Umfrage',
        },
      });

      return useSurveyEditorController({
        mode: 'create',
        methods,
        pt,
        navigateToContentList,
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(createSurveyMock).toHaveBeenCalledOnce();
    expect(result.current.status).toEqual({ kind: 'success', text: 'Umfrage wurde angelegt.' });
    expect(result.current.loadedItem?.id).toBe('survey-created');
    expect(navigateToContentList).toHaveBeenCalledOnce();
  });

  it('surfaces the translated load fallback when loading an existing survey fails without a message', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    getSurveyMock.mockRejectedValue({});

    const { result } = renderHook(() => {
      const methods = useForm<SurveyDetailFormValues>({
        defaultValues: createEmptyFormValues(),
      });

      return useSurveyEditorController({
        mode: 'edit',
        contentId: 'survey-1',
        methods,
        pt,
        navigateToContentList,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toEqual({ kind: 'error', text: 'Umfrage konnte nicht geladen werden.' });
    });
  });

  it('clears stale loaded survey state when loading another survey fails', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    getSurveyMock
      .mockResolvedValueOnce({
        id: 'survey-1',
        contentType: 'surveys.survey',
        title: { de: 'Erste Umfrage' },
        status: 'ACTIVE',
        isAnonymous: false,
        resultVisibility: 'NONE',
        showResultsInApp: false,
        targetAreaIds: ['district-1'],
        questions: [],
        questionCount: 0,
        participationCount: 0,
        submissionCount: 0,
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T09:00:00.000Z',
      })
      .mockRejectedValueOnce({});

    let methodsRef: ReturnType<typeof useForm<SurveyDetailFormValues>> | undefined;
    const { result, rerender } = renderHook(
      ({ contentId }: { contentId: string }) => {
        const methods = useForm<SurveyDetailFormValues>({
          defaultValues: createEmptyFormValues(),
        });
        methodsRef = methods;

        return useSurveyEditorController({
          mode: 'edit',
          contentId,
          methods,
          pt,
          navigateToContentList,
        });
      },
      {
        initialProps: { contentId: 'survey-1' },
      }
    );

    await waitFor(() => {
      expect(result.current.loadedItem?.id).toBe('survey-1');
    });

    rerender({ contentId: 'survey-2' });

    await waitFor(() => {
      expect(result.current.loadedItem).toBeNull();
      expect(result.current.status).toEqual({ kind: 'error', text: 'Umfrage konnte nicht geladen werden.' });
    });

    expect(methodsRef?.getValues()).toEqual(createEmptyFormValues());
  });

  it('surfaces the translated create fallback when create fails without an error message', async () => {
    const navigateToContentList = vi.fn(async () => undefined);
    createSurveyMock.mockRejectedValue({});

    const { result } = renderHook(() => {
      const methods = useForm<SurveyDetailFormValues>({
        defaultValues: {
          ...createEmptyFormValues(),
          title: 'Neue Umfrage',
        },
      });

      return useSurveyEditorController({
        mode: 'create',
        methods,
        pt,
        navigateToContentList,
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toEqual({ kind: 'error', text: 'Umfrage konnte nicht angelegt werden.' });
    expect(navigateToContentList).not.toHaveBeenCalled();
  });
});

function createEmptyFormValues(): SurveyDetailFormValues {
  return {
    title: '',
    basis: {
      status: 'DRAFT',
      startAt: '',
      endAt: '',
      targetAreaIds: [],
    },
    content: {
      shortDescription: '',
      description: '',
      isAnonymous: false,
      showResultsInApp: false,
      resultVisibility: 'NONE',
      privacyNotice: '',
      transparencyNotice: '',
      questions: [],
    },
  };
}
