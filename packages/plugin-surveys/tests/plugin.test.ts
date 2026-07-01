import { describe, expect, it } from 'vitest';

import {
  SURVEYS_CONTENT_TYPE,
  pluginSurveys,
  pluginSurveysActionDefinitions,
  pluginSurveysModerationActionId,
  pluginSurveysPermissionDefinitions,
} from '../src/index.js';

describe('pluginSurveys contract', () => {
  it('keeps the standard content contract and adds survey-specific rights', () => {
    expect(SURVEYS_CONTENT_TYPE).toBe('surveys.survey');
    expect(pluginSurveys.navigation).toEqual([
      {
        id: 'surveys.navigation',
        to: '/admin/surveys',
        titleKey: 'surveys.navigation.title',
        section: 'dataManagement',
        requiredAction: 'surveys.read',
      },
    ]);
    expect(pluginSurveys.actions).toEqual(pluginSurveysActionDefinitions);
    expect(pluginSurveys.permissions).toEqual(pluginSurveysPermissionDefinitions);
    expect(pluginSurveys.actions?.map((action) => action.id)).toEqual([
      'surveys.create',
      'surveys.edit',
      'surveys.update',
      'surveys.delete',
      'surveys.moderate',
      'surveys.export',
    ]);
    expect(pluginSurveys.permissions?.map((permission) => permission.id)).toEqual([
      'surveys.read',
      'surveys.create',
      'surveys.update',
      'surveys.delete',
      'surveys.moderate',
      'surveys.export',
    ]);
    expect(pluginSurveysModerationActionId).toBe('surveys.moderate');
    expect(pluginSurveys.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'surveys.content',
        basePath: 'surveys',
        contentUi: {
          contentType: 'surveys.survey',
          bindings: {
            list: { bindingKey: 'surveysList' },
            detail: { bindingKey: 'surveysDetail' },
            editor: { bindingKey: 'surveysEditor' },
          },
        },
      }),
    ]);
    expect(pluginSurveys.moduleIam).toMatchObject({
      moduleId: 'surveys',
      permissionIds: [
        'surveys.read',
        'surveys.create',
        'surveys.update',
        'surveys.delete',
        'surveys.moderate',
        'surveys.export',
      ],
    });
  });
});
