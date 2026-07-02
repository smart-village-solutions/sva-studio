import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

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
});
