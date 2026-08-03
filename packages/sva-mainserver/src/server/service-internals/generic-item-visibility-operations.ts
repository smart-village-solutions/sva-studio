import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import {
  svaMainserverChangeNewsVisibilityDocument,
  type SvaMainserverChangeNewsVisibilityMutation,
} from '../../generated/news-visibility.js';

import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

export const createGenericItemVisibilityOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  changeGenericItemVisibilityWithConfig: async (
    input: SvaMainserverConnectionInput & {
      readonly genericItemId: string;
      readonly visible: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<void> => {
    const response = await executeGraphqlWithConfig<SvaMainserverChangeNewsVisibilityMutation>(
      {
        ...input,
        document: svaMainserverChangeNewsVisibilityDocument,
        operationName: 'SvaMainserverChangeGenericItemVisibility',
        variables: {
          id: input.genericItemId,
          recordType: 'GenericItem',
          visible: input.visible,
        },
      },
      config
    );

    if (!response.changeVisibility || (response.changeVisibility.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte die Sichtbarkeit des Generic Item nicht aktualisieren.',
        statusCode: 502,
      });
    }
  },
});
