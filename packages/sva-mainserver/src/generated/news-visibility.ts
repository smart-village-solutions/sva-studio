export type SvaMainserverChangeNewsVisibilityMutation = {
  readonly changeVisibility?: {
    readonly id?: number | null;
    readonly status?: string | null;
    readonly statusCode?: number | null;
  } | null;
};

export const svaMainserverChangeNewsVisibilityDocument = /* GraphQL */ `
  mutation SvaMainserverChangeNewsVisibility($id: ID!, $recordType: String!, $visible: Boolean!) {
    changeVisibility(id: $id, recordType: $recordType, visible: $visible) {
      id
      status
      statusCode
    }
  }
`;
