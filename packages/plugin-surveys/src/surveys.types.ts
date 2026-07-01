export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SurveyFormInput = Readonly<{
  title: string;
  status: SurveyStatus;
  isAnonymous: boolean;
}>;
