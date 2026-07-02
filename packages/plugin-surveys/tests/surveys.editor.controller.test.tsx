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
});
