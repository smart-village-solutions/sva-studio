export type SvaMainserverChangeNewsVisibilityMutation = {
  readonly changeVisibility?: {
    readonly statusCode?: number | null;
    readonly success?: boolean | null;
    readonly message?: string | null;
  } | null;
};

export const svaMainserverChangeNewsVisibilityDocument = /* GraphQL */ `
  mutation SvaMainserverChangeNewsVisibility($id: ID!, $recordType: String!, $visible: Boolean!) {
    changeVisibility(id: $id, recordType: $recordType, visible: $visible) {
      statusCode
      success
      message
    }
  }
`;
