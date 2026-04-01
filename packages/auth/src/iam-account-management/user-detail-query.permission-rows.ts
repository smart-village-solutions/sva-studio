const DIRECT_PERMISSION_KEYS_SQL = `
        UNION

        SELECT p.permission_key
        FROM iam.account_permissions ap
        JOIN iam.permissions p
          ON p.instance_id = ap.instance_id
         AND p.id = ap.permission_id
        WHERE ap.instance_id = $1
          AND ap.account_id = a.id
`;

export const buildPermissionRowsSql = (includeDirectPermissions: boolean): string => `
  COALESCE(
    (
      SELECT json_agg(
        DISTINCT jsonb_build_object(
          'permission_key', trace.permission_key
        )
      )
      FROM (
        SELECT p.permission_key
        FROM iam.account_roles ar
        JOIN iam.roles r
          ON r.instance_id = ar.instance_id
         AND r.id = ar.role_id
        JOIN iam.role_permissions rp
          ON rp.instance_id = r.instance_id
         AND rp.role_id = r.id
        JOIN iam.permissions p
          ON p.instance_id = rp.instance_id
         AND p.id = rp.permission_id
        WHERE ar.instance_id = $1
          AND ar.account_id = a.id
          AND ar.valid_from <= NOW()
          AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
${includeDirectPermissions ? DIRECT_PERMISSION_KEYS_SQL : ''}

        UNION

        SELECT p.permission_key
        FROM iam.account_groups ag
        JOIN iam.groups g
          ON g.instance_id = ag.instance_id
         AND g.id = ag.group_id
         AND g.is_active = true
        JOIN iam.group_roles gr
          ON gr.instance_id = ag.instance_id
         AND gr.group_id = ag.group_id
        JOIN iam.roles r
          ON r.instance_id = gr.instance_id
         AND r.id = gr.role_id
        JOIN iam.role_permissions rp
          ON rp.instance_id = r.instance_id
         AND rp.role_id = r.id
        JOIN iam.permissions p
          ON p.instance_id = rp.instance_id
         AND p.id = rp.permission_id
        WHERE ag.instance_id = $1
          AND ag.account_id = a.id
          AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
          AND (ag.valid_until IS NULL OR ag.valid_until > NOW())

      ) AS trace
    ),
    '[]'::json
  ) AS permission_rows,
`;

export const buildDirectPermissionRowsSql = (includeDirectPermissions: boolean): string => {
  if (!includeDirectPermissions) {
    return `
  '[]'::json AS direct_permission_rows,
`;
  }

  return `
  COALESCE(
    (
      SELECT json_agg(
        DISTINCT jsonb_build_object(
          'permission_id', direct.permission_id,
          'permission_key', direct.permission_key,
          'effect', direct.effect,
          'description', direct.description
        )
      )
      FROM (
        SELECT
          p.id AS permission_id,
          p.permission_key,
          ap.effect,
          p.description
        FROM iam.account_permissions ap
        JOIN iam.permissions p
          ON p.instance_id = ap.instance_id
         AND p.id = ap.permission_id
        WHERE ap.instance_id = $1
          AND ap.account_id = a.id
      ) AS direct
    ),
    '[]'::json
  ) AS direct_permission_rows,
`;
};
