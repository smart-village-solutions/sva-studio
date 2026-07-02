import { expectTypeOf, test } from 'vitest';

import type { SurveyFormInput, SurveyStatus } from '../src/index.js';
import {
  pluginSurveysActionDefinitions,
  pluginSurveysActionIds,
  pluginSurveysExportActionId,
  pluginSurveysModerationActionId,
  pluginSurveysModuleIam,
  pluginSurveysPermissionDefinitions,
} from '../src/index.js';

test('exports minimal survey types', () => {
  expectTypeOf<SurveyStatus>().toEqualTypeOf<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>();
  expectTypeOf<SurveyFormInput>().toMatchTypeOf<{
    title: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    isAnonymous: boolean;
  }>();
  expectTypeOf(pluginSurveysActionDefinitions).toMatchTypeOf<readonly { id: string }[]>();
  expectTypeOf(pluginSurveysPermissionDefinitions).toMatchTypeOf<readonly { id: string }[]>();
  expectTypeOf(pluginSurveysActionIds.moderate).toEqualTypeOf<string>();
  expectTypeOf(pluginSurveysModerationActionId).toEqualTypeOf<string>();
  expectTypeOf(pluginSurveysExportActionId).toEqualTypeOf<string>();
  expectTypeOf(pluginSurveysModuleIam.moduleId).toEqualTypeOf<string>();
});
