import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import {
  svaMainserverChangeNewsVisibilityDocument,
  type SvaMainserverChangeNewsVisibilityMutation,
} from '../../generated/news-visibility.js';

import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

export const createEventVisibilityOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  changeEventVisibilityWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly eventId: string; readonly visible: boolean },
    config: SvaMainserverInstanceConfig
  ): Promise<void> => {
    const response = await executeGraphqlWithConfig<SvaMainserverChangeNewsVisibilityMutation>(
      {
        ...input,
        document: svaMainserverChangeNewsVisibilityDocument,
        operationName: 'SvaMainserverChangeNewsVisibility',
        variables: { id: input.eventId, recordType: 'EventRecord', visible: input.visible },
      },
      config
    );

    if (!response.changeVisibility || (response.changeVisibility.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte die Sichtbarkeit des Events nicht aktualisieren.',
        statusCode: 502,
      });
    }
  },
});
