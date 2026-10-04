import { createContentOwnershipTransferOperation } from './content-ownership-transfer.js';
import { createEventOperations } from './event-operations.js';
import { createEventVisibilityOperations } from './event-visibility-operations.js';
import { createGenericItemOperations } from './generic-item-operations.js';
import { createGenericItemVisibilityOperations } from './generic-item-visibility-operations.js';
import { createNewsOperations } from './news-operations.js';
import { createNewsVisibilityOperations } from './news-visibility-operations.js';
import { createPoiOperations } from './poi-operations.js';
import { createProjectionListOperations } from './projection-list-operations.js';
import { createStaticContentOperations } from './static-content-operations.js';
import { createSurveyOperations } from './survey-operations.js';
import { createWasteOperations } from './waste-operations.js';

export const createServiceOperationContext = (
  executeGraphqlWithConfig: Parameters<typeof createNewsOperations>[0]
) => {
  const newsOperations = createNewsOperations(executeGraphqlWithConfig);
  const newsVisibilityOperations = createNewsVisibilityOperations(executeGraphqlWithConfig);
  const genericItemVisibilityOperations =
    createGenericItemVisibilityOperations(executeGraphqlWithConfig);
  const eventOperations = createEventOperations(executeGraphqlWithConfig);
  const eventVisibilityOperations = createEventVisibilityOperations(executeGraphqlWithConfig);
  const genericItemOperations = createGenericItemOperations(executeGraphqlWithConfig);
  const poiOperations = createPoiOperations(executeGraphqlWithConfig);
  const transferContentOwnershipWithConfig = createContentOwnershipTransferOperation({
    news: newsOperations,
    event: eventOperations,
    poi: poiOperations,
    genericItem: genericItemOperations,
  });
  const projectionListOperations = createProjectionListOperations(executeGraphqlWithConfig);
  const surveyOperations = createSurveyOperations(executeGraphqlWithConfig);
  const staticContentOperations = createStaticContentOperations(executeGraphqlWithConfig);
  const wasteOperations = createWasteOperations(executeGraphqlWithConfig);

  return {
    newsOperations,
    newsVisibilityOperations,
    genericItemVisibilityOperations,
    eventOperations,
    eventVisibilityOperations,
    genericItemOperations,
    poiOperations,
    transferContentOwnershipWithConfig,
    projectionListOperations,
    surveyOperations,
    staticContentOperations,
    wasteOperations,
  };
};
