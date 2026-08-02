// Generated-style documents backed by the checked-in Mainserver schema snapshot.
const provider = `dataProvider { id name }`;

export const svaMainserverNewsProjectionListDocument = /* GraphQL */ `
  query SvaMainserverNewsProjectionList($limit: Int, $skip: Int, $order: NewsItemsOrder) {
    newsItems(limit: $limit, skip: $skip, order: $order) {
      id title contentBlocks { title } author createdAt updatedAt publicationDate publishedAt visible ${provider}
    }
  }
`;

export const svaMainserverEventProjectionListDocument = /* GraphQL */ `
  query SvaMainserverEventProjectionList($limit: Int, $skip: Int, $order: EventRecordsOrder) {
    eventRecords(limit: $limit, skip: $skip, order: $order) {
      id title createdAt updatedAt visible ${provider}
    }
  }
`;

export const svaMainserverPoiProjectionListDocument = /* GraphQL */ `
  query SvaMainserverPoiProjectionList($limit: Int, $skip: Int, $order: PointsOfInterestOrder) {
    pointsOfInterest(limit: $limit, skip: $skip, order: $order) {
      id name createdAt updatedAt active visible ${provider}
    }
  }
`;

export const svaMainserverGenericItemProjectionListDocument = /* GraphQL */ `
  query SvaMainserverGenericItemProjectionList($limit: Int, $skip: Int, $order: GenericItemOrder) {
    genericItems(limit: $limit, skip: $skip, order: $order) {
      id title genericType author createdAt updatedAt publicationDate publishedAt visible ${provider}
    }
  }
`;

export const svaMainserverSurveyProjectionListDocument = /* GraphQL */ `
  query SvaMainserverSurveyProjectionList($archived: Boolean, $order: SurveyPollsOrder) {
    surveys(archived: $archived, order: $order) {
      id title status createdAt updatedAt publishedAt archivedAt visible ${provider}
    }
  }
`;
