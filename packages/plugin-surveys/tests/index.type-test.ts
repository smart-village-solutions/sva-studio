import { expectTypeOf, test } from 'vitest';

import type { SurveyFormInput, SurveyStatus } from '../src/index.js';

test('exports minimal survey types', () => {
  expectTypeOf<SurveyStatus>().toEqualTypeOf<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>();
  expectTypeOf<SurveyFormInput>().toMatchTypeOf<{
    title: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    isAnonymous: boolean;
  }>();
});
