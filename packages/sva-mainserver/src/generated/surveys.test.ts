import { describe, expect, it } from 'vitest';

import { svaMainserverSurveyDetailDocument, svaMainserverSurveysListDocument } from './surveys.js';

describe('survey GraphQL documents', () => {
  it('does not request questionId on SurveyQuestionOption fragments', () => {
    expect(svaMainserverSurveyDetailDocument).not.toMatch(/options\s*\{[^}]*questionId/s);
    expect(svaMainserverSurveysListDocument).not.toMatch(/options\s*\{[^}]*questionId/s);
  });
});
