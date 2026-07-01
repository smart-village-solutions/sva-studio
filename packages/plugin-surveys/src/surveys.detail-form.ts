export type SurveyDetailFormValues = Readonly<{
  title: string;
  basis: Readonly<{
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    startAt: string;
    endAt: string;
    targetAreaIds: readonly string[];
  }>;
}>;

export const createDefaultSurveyDetailFormValues = (): SurveyDetailFormValues => ({
  title: '',
  basis: {
    status: 'DRAFT',
    startAt: '',
    endAt: '',
    targetAreaIds: [],
  },
});
