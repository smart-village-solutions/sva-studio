import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import {
  svaMainserverChangeNewsVisibilityDocument,
  type SvaMainserverChangeNewsVisibilityMutation,
} from '../../generated/news-visibility.js';

import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

export const createNewsVisibilityOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  changeNewsVisibilityWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean },
    config: SvaMainserverInstanceConfig
  ): Promise<void> => {
    const response = await executeGraphqlWithConfig<SvaMainserverChangeNewsVisibilityMutation>(
      {
        ...input,
        document: svaMainserverChangeNewsVisibilityDocument,
        operationName: 'SvaMainserverChangeNewsVisibility',
        variables: { id: input.newsId, recordType: 'NewsItem', visible: input.visible },
      },
      config
    );

    if (!response.changeVisibility || response.changeVisibility.success === false) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte die Sichtbarkeit der News nicht aktualisieren.',
        statusCode: 502,
      });
    }

    if ((response.changeVisibility.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte die Sichtbarkeit der News nicht aktualisieren.',
        statusCode: 502,
      });
    }
  },
});
