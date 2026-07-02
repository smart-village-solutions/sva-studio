import type {
  SurveyQuestionFormValues,
  SurveyResultVisibility,
} from './surveys.detail-content-model.js';

export type SurveyDetailFormValues = {
  title: string;
  basis: {
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    startAt: string;
    endAt: string;
    targetAreaIds: string[];
  };
  content: {
    shortDescription: string;
    description: string;
    isAnonymous: boolean;
    showResultsInApp: boolean;
    resultVisibility: SurveyResultVisibility;
    privacyNotice: string;
    transparencyNotice: string;
    questions: SurveyQuestionFormValues[];
  };
};

export const createDefaultSurveyDetailFormValues = (): SurveyDetailFormValues => ({
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
