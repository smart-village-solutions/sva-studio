import type { ProjectionRow } from './iam-content-list-projection.server.js';

type OptionalTestProjectionField =
  | 'projection_scope_key'
  | 'owner_user_id'
  | 'owner_organization_id'
  | 'author_display_mode'
  | 'source_data_provider_id'
  | 'source_data_provider_name'
  | 'credential_source'
  | 'credential_fingerprint'
  | 'authorization_mode';

export type TestProjectionRow = Omit<ProjectionRow, OptionalTestProjectionField | 'payload_json'> &
  Partial<Pick<ProjectionRow, OptionalTestProjectionField>> & {
    owner_subject_id: string | null;
    payload_json: Record<string, unknown>;
  };
