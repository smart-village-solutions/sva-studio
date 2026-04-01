const buildPermissionProjection = (includeStructuredPermissions: boolean) =>
  includeStructuredPermissions
    ? {
        action: `COALESCE(p.action, p.permission_key)`,
        resourceType: `COALESCE(p.resource_type, split_part(p.permission_key, '.', 1))`,
        resourceId: `p.resource_id::text`,
        effect: `COALESCE(p.effect, 'allow')`,
        scope: `p.scope`,
      }
    : {
        action: `p.permission_key`,
        resourceType: `split_part(p.permission_key, '.', 1)`,
        resourceId: `NULL::text`,
        effect: `'allow'::text`,
        scope: `NULL::jsonb`,
      };

const buildDirectPermissionTraceSql = (includeStructuredPermissions: boolean): string => {
  const projection = buildPermissionProjection(includeStructuredPermissions);

  return `

        UNION ALL

        SELECT
          p.permission_key,
          ${projection.action} AS action,
          ${projection.resourceType} AS resource_type,
          ${projection.resourceId} AS resource_id,
          NULL::text AS organization_id,
          ap.effect,
          ${projection.scope} AS scope,
          TRUE AS is_effective,
          'effective'::text AS status,
          'direct_permission'::text AS source_kind,
          NULL::text AS role_id,
          NULL::text AS role_key,
          NULL::text AS role_name,
          NULL::text AS group_id,
          NULL::text AS group_key,
          NULL::text AS group_display_name,
          NULL::boolean AS group_active,
          NULL::text AS assignment_origin,
          NULL::text AS valid_from,
          NULL::text AS valid_to
        FROM iam.account_permissions ap
        JOIN iam.permissions p
          ON p.instance_id = ap.instance_id
         AND p.id = ap.permission_id
        WHERE ap.instance_id = $1
          AND ap.account_id = a.id
`;
};

const buildDirectRolePermissionTraceSql = (projection: ReturnType<typeof buildPermissionProjection>): string => `
        SELECT
          p.permission_key,
          ${projection.action} AS action,
          ${projection.resourceType} AS resource_type,
          ${projection.resourceId} AS resource_id,
          ao.organization_id::text AS organization_id,
          ${projection.effect} AS effect,
          ${projection.scope} AS scope,
          (ar.valid_from <= NOW() AND (ar.valid_to IS NULL OR ar.valid_to > NOW())) AS is_effective,
          CASE
            WHEN ar.valid_from > NOW() THEN 'inactive'
            WHEN ar.valid_to IS NOT NULL AND ar.valid_to <= NOW() THEN 'expired'
            ELSE 'effective'
          END::text AS status,
          'direct_role'::text AS source_kind,
          r.id::text AS role_id,
          r.role_key,
          r.role_name,
          NULL::text AS group_id,
          NULL::text AS group_key,
          NULL::text AS group_display_name,
          NULL::boolean AS group_active,
          NULL::text AS assignment_origin,
          ar.valid_from::text,
          ar.valid_to::text
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
        LEFT JOIN iam.account_organizations ao
          ON ao.instance_id = ar.instance_id
         AND ao.account_id = ar.account_id
        WHERE ar.instance_id = $1
          AND ar.account_id = a.id
`;

const buildGroupRolePermissionTraceSql = (projection: ReturnType<typeof buildPermissionProjection>): string => `
        SELECT
          p.permission_key,
          ${projection.action} AS action,
          ${projection.resourceType} AS resource_type,
          ${projection.resourceId} AS resource_id,
          ao.organization_id::text AS organization_id,
          ${projection.effect} AS effect,
          ${projection.scope} AS scope,
          (
            g.is_active = true
            AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
            AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
          ) AS is_effective,
          CASE
            WHEN g.is_active IS NOT TRUE THEN 'disabled'
            WHEN ag.valid_from IS NOT NULL AND ag.valid_from > NOW() THEN 'inactive'
            WHEN ag.valid_until IS NOT NULL AND ag.valid_until <= NOW() THEN 'expired'
            ELSE 'effective'
          END::text AS status,
          'group_role'::text AS source_kind,
          r.id::text AS role_id,
          r.role_key,
          r.role_name,
          g.id::text AS group_id,
          g.group_key,
          g.display_name AS group_display_name,
          g.is_active AS group_active,
          ag.origin::text AS assignment_origin,
          ag.valid_from::text,
          ag.valid_until::text AS valid_to
        FROM iam.account_groups ag
        JOIN iam.groups g
          ON g.instance_id = ag.instance_id
         AND g.id = ag.group_id
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
        LEFT JOIN iam.account_organizations ao
          ON ao.instance_id = ag.instance_id
         AND ao.account_id = ag.account_id
        WHERE ag.instance_id = $1
          AND ag.account_id = a.id
`;

export const buildPermissionTraceRowsSql = (
  includeDirectPermissions: boolean,
  includeStructuredPermissions: boolean
): string => {
  const projection = buildPermissionProjection(includeStructuredPermissions);
  const directPermissionTraceSql = includeDirectPermissions
    ? buildDirectPermissionTraceSql(includeStructuredPermissions)
    : '';

  return `
  COALESCE(
    (
      SELECT json_agg(
        DISTINCT jsonb_build_object(
          'permission_key', trace.permission_key,
          'action', trace.action,
          'resource_type', trace.resource_type,
          'resource_id', trace.resource_id,
          'organization_id', trace.organization_id,
          'effect', trace.effect,
          'scope', trace.scope,
          'is_effective', trace.is_effective,
          'status', trace.status,
          'source_kind', trace.source_kind,
          'role_id', trace.role_id,
          'role_key', trace.role_key,
          'role_name', trace.role_name,
          'group_id', trace.group_id,
          'group_key', trace.group_key,
          'group_display_name', trace.group_display_name,
          'group_active', trace.group_active,
          'assignment_origin', trace.assignment_origin,
          'valid_from', trace.valid_from,
          'valid_to', trace.valid_to
        )
      )
      FROM (
${buildDirectRolePermissionTraceSql(projection)}

        UNION ALL

${buildGroupRolePermissionTraceSql(projection)}
${directPermissionTraceSql}
      ) AS trace
    ),
    '[]'::json
  ) AS permission_trace_rows
`;
};
