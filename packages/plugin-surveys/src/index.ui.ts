import { SurveyCreatePage, SurveyEditPage } from './surveys.pages.js';

export { SurveyCreatePage, SurveyEditPage };
export const pluginViewBindings = [
  { bindingKey: 'surveysDetail', component: SurveyEditPage },
  { bindingKey: 'surveysEditor', component: SurveyCreatePage },
] as const;
