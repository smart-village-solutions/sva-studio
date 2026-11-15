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
