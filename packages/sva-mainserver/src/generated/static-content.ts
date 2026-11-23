// Generated from the checked-in SVA Mainserver schema snapshot.
// The waste sync only needs the mutation id response for static content writes.

export type SvaMainserverPublicJsonFileQuery = {
  readonly publicJsonFile?: {
    readonly id?: string | number | null;
  } | null;
};

export type SvaMainserverCreateOrUpdateStaticContentMutation = {
  readonly createOrUpdateStaticContent?: {
    readonly id?: string | number | null;
  } | null;
};

export const svaMainserverPublicJsonFileDocument = `
query SvaMainserverPublicJsonFile(
  $name: String!
) {
  publicJsonFile(
    name: $name
  ) {
    id
  }
}
`;

export const svaMainserverCreateOrUpdateStaticContentDocument = `
mutation SvaMainserverCreateOrUpdateStaticContent(
  $name: String!
  $content: String!
  $dataType: String!
  $version: String!
) {
  createOrUpdateStaticContent(
    name: $name
    content: $content
    dataType: $dataType
    version: $version
  ) {
    id
  }
}
`;

export const svaMainserverCreateOrUpdateStaticContentWithIdDocument = `
mutation SvaMainserverCreateOrUpdateStaticContentWithId(
  $name: String!
  $id: ID!
  $content: String!
  $dataType: String!
  $version: String!
) {
  createOrUpdateStaticContent(
    name: $name
    id: $id
    content: $content
    dataType: $dataType
    version: $version
  ) {
    id
  }
}
`;

// JSON editor operations from the deployed Mainserver contract (SVA-1787 to SVA-1792).
export const svaMainserverStaticJsonOverviewDocument = `
query SvaMainserverStaticJsonOverview {
  staticContents { id name version updatedAt }
}
`;

export const svaMainserverStaticJsonByIdDocument = `
query SvaMainserverStaticJsonById($id: ID!) {
  staticContent(id: $id) { id name version updatedAt revision content }
}
`;

export const svaMainserverUpdateStaticJsonDocument = `
mutation SvaMainserverUpdateStaticJson($id: ID!, $content: String!, $revision: String!) {
  createOrUpdateStaticContent(id: $id, content: $content, dataType: "json", expectedRevision: $revision) { id }
}
`;

export const svaMainserverCopyStaticJsonDocument = `
mutation SvaMainserverCopyStaticJson($name: String!, $content: String!, $version: String) {
  createOrUpdateStaticContent(name: $name, content: $content, dataType: "json", version: $version) { id }
}
`;

export const svaMainserverDeleteStaticJsonDocument = `
mutation SvaMainserverDeleteStaticJson($id: ID!) {
  destroyRecord(id: $id, recordType: "StaticContent") { id statusCode }
}
`;
