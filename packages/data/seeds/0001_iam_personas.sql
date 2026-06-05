BEGIN;

INSERT INTO iam.instances (
  id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  auth_realm,
  auth_client_id,
  tenant_admin_client_id,
  feature_flags
)
VALUES (
  'de-musterhausen',
  'Seed Instance Default',
  'active',
  'studio.localhost',
  'de-musterhausen.studio.localhost',
  'de-musterhausen',
  'sva-studio',
  'sva-studio-realm-admin',
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  parent_domain = COALESCE(NULLIF(iam.instances.parent_domain, ''), EXCLUDED.parent_domain),
  primary_hostname = COALESCE(NULLIF(iam.instances.primary_hostname, ''), EXCLUDED.primary_hostname),
  auth_realm = COALESCE(NULLIF(iam.instances.auth_realm, ''), EXCLUDED.auth_realm),
  auth_client_id = COALESCE(NULLIF(iam.instances.auth_client_id, ''), EXCLUDED.auth_client_id),
  tenant_admin_client_id = COALESCE(NULLIF(iam.instances.tenant_admin_client_id, ''), EXCLUDED.tenant_admin_client_id),
  feature_flags = EXCLUDED.feature_flags,
  updated_at = NOW();

INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
SELECT
  'de-musterhausen.studio.localhost',
  'de-musterhausen',
  instances.primary_hostname = 'de-musterhausen.studio.localhost',
  'seed:0001_iam_personas'
FROM iam.instances AS instances
WHERE instances.id = 'de-musterhausen'
ON CONFLICT (hostname) DO UPDATE
SET
  instance_id = EXCLUDED.instance_id,
  is_primary = CASE
    WHEN EXISTS (
      SELECT 1
      FROM iam.instances AS instances
      WHERE instances.id = EXCLUDED.instance_id
        AND instances.primary_hostname = EXCLUDED.hostname
    ) THEN EXCLUDED.is_primary
    ELSE false
  END,
  created_by = EXCLUDED.created_by;

INSERT INTO iam.instance_modules (instance_id, module_id)
VALUES
  ('de-musterhausen', 'news'),
  ('de-musterhausen', 'events')
ON CONFLICT (instance_id, module_id) DO NOTHING;

INSERT INTO iam.organizations (
  id,
  instance_id,
  organization_key,
  display_name,
  metadata,
  organization_type,
  content_author_policy,
  parent_organization_id,
  hierarchy_path,
  depth,
  is_active
)
VALUES
(
  '22222222-2222-2222-2222-222222222222',
  'de-musterhausen',
  'seed-org-default',
  'Seed County Default',
  '{"seed":true,"version":"v2","level":"county"}'::jsonb,
  'county',
  'org_only',
  NULL,
  ARRAY[]::uuid[],
  0,
  true
),
(
  '22333333-3333-3333-3333-333333333333',
  'de-musterhausen',
  'seed-org-municipality',
  'Seed Municipality',
  '{"seed":true,"version":"v2","level":"municipality"}'::jsonb,
  'municipality',
  'org_or_personal',
  '22222222-2222-2222-2222-222222222222',
  ARRAY['22222222-2222-2222-2222-222222222222']::uuid[],
  1,
  true
),
(
  '22444444-4444-4444-4444-444444444444',
  'de-musterhausen',
  'seed-org-district',
  'Seed District',
  '{"seed":true,"version":"v2","level":"district"}'::jsonb,
  'district',
  'org_only',
  '22333333-3333-3333-3333-333333333333',
  ARRAY[
    '22222222-2222-2222-2222-222222222222',
    '22333333-3333-3333-3333-333333333333'
  ]::uuid[],
  2,
  true
)
ON CONFLICT (instance_id, organization_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  metadata = EXCLUDED.metadata,
  organization_type = EXCLUDED.organization_type,
  content_author_policy = EXCLUDED.content_author_policy,
  parent_organization_id = EXCLUDED.parent_organization_id,
  hierarchy_path = EXCLUDED.hierarchy_path,
  depth = EXCLUDED.depth,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO iam.roles (
  id,
  instance_id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  managed_by,
  sync_state,
  role_level
)
VALUES
  ('30111111-1111-1111-1111-111111111111', 'de-musterhausen', 'system_admin', 'system_admin', 'system_admin', 'system_admin', 'System administration persona', true, 'studio', 'pending', 100),
  ('30888888-8888-8888-8888-888888888888', 'de-musterhausen', 'mainserver_admin', 'mainserver_admin', 'Admin', 'Admin', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 90),
  ('30999999-9999-9999-9999-999999999999', 'de-musterhausen', 'mainserver_app', 'mainserver_app', 'App', 'App', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 80),
  ('30aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'de-musterhausen', 'mainserver_user', 'mainserver_user', 'User', 'User', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 20),
  ('30bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'de-musterhausen', 'mainserver_extended_user', 'mainserver_extended_user', 'Extended User', 'Extended User', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 30),
  ('30cccccc-cccc-cccc-cccc-cccccccccccc', 'de-musterhausen', 'mainserver_restricted', 'mainserver_restricted', 'Restricted', 'Restricted', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 10),
  ('30dddddd-dddd-dddd-dddd-dddddddddddd', 'de-musterhausen', 'mainserver_editor', 'mainserver_editor', 'Editor', 'Editor', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 40),
  ('30eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'de-musterhausen', 'mainserver_read_only', 'mainserver_read_only', 'Read only', 'Read only', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 5),
  ('30ffffff-ffff-ffff-ffff-ffffffffffff', 'de-musterhausen', 'mainserver_account_manager', 'mainserver_account_manager', 'Account Manager', 'Account Manager', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 70)
ON CONFLICT (instance_id, role_key) DO UPDATE
SET
  role_name = EXCLUDED.role_name,
  display_name = EXCLUDED.display_name,
  external_role_name = EXCLUDED.external_role_name,
  description = EXCLUDED.description,
  is_system_role = EXCLUDED.is_system_role,
  managed_by = EXCLUDED.managed_by,
  sync_state = EXCLUDED.sync_state,
  role_level = EXCLUDED.role_level,
  updated_at = NOW();

INSERT INTO iam.permissions (
  id,
  instance_id,
  permission_key,
  action,
  resource_type,
  resource_id,
  effect,
  scope,
  description
)
VALUES
  ('40111111-1111-1111-1111-111111111111', 'de-musterhausen', 'iam.user.read', 'iam.user.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read account data'),
  ('40111111-1111-1111-1111-111111111112', 'de-musterhausen', 'iam.user.write', 'iam.user.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify account data'),
  ('40111111-1111-1111-1111-111111111113', 'de-musterhausen', 'iam.role.read', 'iam.role.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read role assignments'),
  ('40111111-1111-1111-1111-111111111114', 'de-musterhausen', 'iam.role.write', 'iam.role.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify role assignments'),
  ('40111111-1111-1111-1111-111111111115', 'de-musterhausen', 'iam.org.read', 'iam.org.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read organization data'),
  ('40111111-1111-1111-1111-111111111116', 'de-musterhausen', 'iam.org.write', 'iam.org.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify organization data'),
  ('40111111-1111-1111-1111-111111111117', 'de-musterhausen', 'content.read', 'content.read', 'content', NULL, 'allow', '{}'::jsonb, 'Read content'),
  ('40111111-1111-1111-1111-111111111118', 'de-musterhausen', 'content.create', 'content.create', 'content', NULL, 'allow', '{}'::jsonb, 'Create content'),
  ('40111111-1111-1111-1111-111111111119', 'de-musterhausen', 'content.updateMetadata', 'content.updateMetadata', 'content', NULL, 'allow', '{}'::jsonb, 'Update content metadata'),
  ('40111111-1111-1111-1111-111111111120', 'de-musterhausen', 'content.publish', 'content.publish', 'content', NULL, 'allow', '{}'::jsonb, 'Publish content'),
  ('40111111-1111-1111-1111-111111111121', 'de-musterhausen', 'content.manageRevisions', 'content.manageRevisions', 'content', NULL, 'allow', '{}'::jsonb, 'Manage content revisions'),
  ('40111111-1111-1111-1111-111111111122', 'de-musterhausen', 'integration.manage', 'integration.manage', 'integration', NULL, 'allow', '{}'::jsonb, 'Manage integrations'),
  ('40111111-1111-1111-1111-111111111123', 'de-musterhausen', 'feature.toggle', 'feature.toggle', 'feature', NULL, 'allow', '{}'::jsonb, 'Toggle feature flags'),
  ('40111111-1111-1111-1111-111111111149', 'de-musterhausen', 'app.read', 'app.read', 'app', NULL, 'allow', '{}'::jsonb, 'Show the app link in the sidebar'),
  ('40111111-1111-1111-1111-111111111150', 'de-musterhausen', 'cockpit.read', 'cockpit.read', 'cockpit', NULL, 'allow', '{}'::jsonb, 'Show the cockpit link in the sidebar'),
  ('40111111-1111-1111-1111-111111111124', 'de-musterhausen', 'instance.registry.manage', 'instance.registry.manage', 'instance', NULL, 'allow', '{}'::jsonb, 'Manage instance registry and provisioning'),
  ('40111111-1111-1111-1111-111111111125', 'de-musterhausen', 'content.updatePayload', 'content.updatePayload', 'content', NULL, 'allow', '{}'::jsonb, 'Update content payload'),
  ('40111111-1111-1111-1111-111111111126', 'de-musterhausen', 'content.changeStatus', 'content.changeStatus', 'content', NULL, 'allow', '{}'::jsonb, 'Change content status'),
  ('40111111-1111-1111-1111-111111111127', 'de-musterhausen', 'content.archive', 'content.archive', 'content', NULL, 'allow', '{}'::jsonb, 'Archive content'),
  ('40111111-1111-1111-1111-111111111128', 'de-musterhausen', 'content.restore', 'content.restore', 'content', NULL, 'allow', '{}'::jsonb, 'Restore content'),
  ('40111111-1111-1111-1111-111111111129', 'de-musterhausen', 'content.readHistory', 'content.readHistory', 'content', NULL, 'allow', '{}'::jsonb, 'Read content history'),
  ('40111111-1111-1111-1111-111111111130', 'de-musterhausen', 'content.delete', 'content.delete', 'content', NULL, 'allow', '{}'::jsonb, 'Delete content'),
  ('40111111-1111-1111-1111-111111111143', 'de-musterhausen', 'media.read', 'media.read', 'media', NULL, 'allow', '{}'::jsonb, 'Read media'),
  ('40111111-1111-1111-1111-111111111144', 'de-musterhausen', 'media.create', 'media.create', 'media', NULL, 'allow', '{}'::jsonb, 'Create media'),
  ('40111111-1111-1111-1111-111111111145', 'de-musterhausen', 'media.update', 'media.update', 'media', NULL, 'allow', '{}'::jsonb, 'Update media'),
  ('40111111-1111-1111-1111-111111111146', 'de-musterhausen', 'media.reference.manage', 'media.reference.manage', 'media', NULL, 'allow', '{}'::jsonb, 'Manage media references'),
  ('40111111-1111-1111-1111-111111111147', 'de-musterhausen', 'media.delete', 'media.delete', 'media', NULL, 'allow', '{}'::jsonb, 'Delete media'),
  ('40111111-1111-1111-1111-111111111148', 'de-musterhausen', 'media.deliver.protected', 'media.deliver.protected', 'media', NULL, 'allow', '{}'::jsonb, 'Deliver protected media'),
  ('40111111-1111-1111-1111-111111111151', 'de-musterhausen', 'iam.legalText.read', 'iam.legalText.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read legal text administration data'),
  ('40111111-1111-1111-1111-111111111152', 'de-musterhausen', 'iam.legalText.write', 'iam.legalText.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify legal text administration data'),
  ('40111111-1111-1111-1111-111111111153', 'de-musterhausen', 'iam.governance.read', 'iam.governance.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read governance workflows and audit trails'),
  ('40111111-1111-1111-1111-111111111154', 'de-musterhausen', 'iam.governance.write', 'iam.governance.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Execute governance workflows and decisions'),
  ('40111111-1111-1111-1111-111111111155', 'de-musterhausen', 'iam.governance.export', 'iam.governance.export', 'iam', NULL, 'allow', '{}'::jsonb, 'Export governance and legal consent evidence'),
  ('40111111-1111-1111-1111-111111111156', 'de-musterhausen', 'iam.dsr.read', 'iam.dsr.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read tenant data-subject-rights cases'),
  ('40111111-1111-1111-1111-111111111157', 'de-musterhausen', 'iam.dsr.write', 'iam.dsr.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Process tenant data-subject-rights cases'),
  ('40111111-1111-1111-1111-111111111158', 'de-musterhausen', 'iam.dsr.export', 'iam.dsr.export', 'iam', NULL, 'allow', '{}'::jsonb, 'Export tenant data-subject-rights payloads'),
  ('40111111-1111-1111-1111-111111111159', 'de-musterhausen', 'iam.deletionRules.read', 'iam.deletionRules.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read tenant deletion rules'),
  ('40111111-1111-1111-1111-111111111160', 'de-musterhausen', 'iam.deletionRules.write', 'iam.deletionRules.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify tenant deletion rules'),
  ('40111111-1111-1111-1111-111111111161', 'de-musterhausen', 'iam.monitoring.read', 'iam.monitoring.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read IAM monitoring and plugin operation status'),
  ('40111111-1111-1111-1111-111111111162', 'de-musterhausen', 'iam.monitoring.write', 'iam.monitoring.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Run IAM monitoring and plugin operations'),
  ('40111111-1111-1111-1111-111111111163', 'de-musterhausen', 'experimental.read', 'experimental.read', 'experimental', NULL, 'allow', '{}'::jsonb, 'Enable experimental shell features and placeholders'),
  ('40111111-1111-1111-1111-111111111131', 'de-musterhausen', 'news.read', 'news.read', 'news', NULL, 'allow', '{}'::jsonb, 'Read news plugin content'),
  ('40111111-1111-1111-1111-111111111132', 'de-musterhausen', 'news.create', 'news.create', 'news', NULL, 'allow', '{}'::jsonb, 'Create news plugin content'),
  ('40111111-1111-1111-1111-111111111133', 'de-musterhausen', 'news.update', 'news.update', 'news', NULL, 'allow', '{}'::jsonb, 'Update news plugin content'),
  ('40111111-1111-1111-1111-111111111134', 'de-musterhausen', 'news.delete', 'news.delete', 'news', NULL, 'allow', '{}'::jsonb, 'Delete news plugin content'),
  ('40111111-1111-1111-1111-111111111135', 'de-musterhausen', 'events.read', 'events.read', 'events', NULL, 'allow', '{}'::jsonb, 'Read events plugin content'),
  ('40111111-1111-1111-1111-111111111136', 'de-musterhausen', 'events.create', 'events.create', 'events', NULL, 'allow', '{}'::jsonb, 'Create events plugin content'),
  ('40111111-1111-1111-1111-111111111137', 'de-musterhausen', 'events.update', 'events.update', 'events', NULL, 'allow', '{}'::jsonb, 'Update events plugin content'),
  ('40111111-1111-1111-1111-111111111138', 'de-musterhausen', 'events.delete', 'events.delete', 'events', NULL, 'allow', '{}'::jsonb, 'Delete events plugin content'),
  ('40111111-1111-1111-1111-111111111139', 'de-musterhausen', 'poi.read', 'poi.read', 'poi', NULL, 'allow', '{}'::jsonb, 'Read POI plugin content'),
  ('40111111-1111-1111-1111-111111111140', 'de-musterhausen', 'poi.create', 'poi.create', 'poi', NULL, 'allow', '{}'::jsonb, 'Create POI plugin content'),
  ('40111111-1111-1111-1111-111111111141', 'de-musterhausen', 'poi.update', 'poi.update', 'poi', NULL, 'allow', '{}'::jsonb, 'Update POI plugin content'),
  ('40111111-1111-1111-1111-111111111142', 'de-musterhausen', 'poi.delete', 'poi.delete', 'poi', NULL, 'allow', '{}'::jsonb, 'Delete POI plugin content')
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO iam.accounts (id, instance_id, keycloak_subject, email_ciphertext, display_name_ciphertext)
VALUES
  ('50111111-1111-1111-1111-111111111111', 'de-musterhausen', 'seed:system_admin', 'enc:v1:seed:2Br4L9r7mA:89azg6De9W2xgh9ZWMDg7Q:6ZkQz-ljCq8', 'enc:v1:seed:r76A9cbcvQ:F6GQjC-KsZdU6kgb4fX6RQ:Wr8vP9mS7hY')
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE
SET
  email_ciphertext = EXCLUDED.email_ciphertext,
  display_name_ciphertext = EXCLUDED.display_name_ciphertext,
  updated_at = NOW();

INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', 'member')
ON CONFLICT (instance_id, account_id) DO UPDATE
SET
  membership_type = EXCLUDED.membership_type;

INSERT INTO iam.account_roles (instance_id, account_id, role_id)
VALUES
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', '30111111-1111-1111-1111-111111111111')
ON CONFLICT (instance_id, account_id, role_id) DO NOTHING;

INSERT INTO iam.account_organizations (
  instance_id,
  account_id,
  organization_id,
  is_default_context,
  membership_visibility
)
VALUES
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, 'internal'),
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', '22333333-3333-3333-3333-333333333333', false, 'internal')
ON CONFLICT (instance_id, account_id, organization_id) DO UPDATE
SET
  is_default_context = EXCLUDED.is_default_context,
  membership_visibility = EXCLUDED.membership_visibility;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT 'de-musterhausen', roles.id, permissions.id
FROM (
  VALUES
    ('system_admin', 'iam.user.read'),
    ('system_admin', 'iam.user.write'),
    ('system_admin', 'iam.role.read'),
    ('system_admin', 'iam.role.write'),
    ('system_admin', 'iam.org.read'),
    ('system_admin', 'iam.org.write'),
    ('system_admin', 'content.read'),
    ('system_admin', 'content.create'),
    ('system_admin', 'content.updateMetadata'),
    ('system_admin', 'content.publish'),
    ('system_admin', 'content.manageRevisions'),
    ('system_admin', 'integration.manage'),
    ('system_admin', 'feature.toggle'),
    ('system_admin', 'experimental.read'),
    ('system_admin', 'app.read'),
    ('system_admin', 'cockpit.read'),
    ('system_admin', 'iam.legalText.read'),
    ('system_admin', 'iam.legalText.write'),
    ('system_admin', 'iam.governance.read'),
    ('system_admin', 'iam.governance.write'),
    ('system_admin', 'iam.governance.export'),
    ('system_admin', 'iam.dsr.read'),
    ('system_admin', 'iam.dsr.write'),
    ('system_admin', 'iam.dsr.export'),
    ('system_admin', 'iam.deletionRules.read'),
    ('system_admin', 'iam.deletionRules.write'),
    ('system_admin', 'iam.monitoring.read'),
    ('system_admin', 'iam.monitoring.write'),
    ('system_admin', 'content.updatePayload'),
    ('system_admin', 'content.changeStatus'),
    ('system_admin', 'content.archive'),
    ('system_admin', 'content.restore'),
    ('system_admin', 'content.readHistory'),
    ('system_admin', 'content.delete')
) AS assignments(role_key, permission_key)
JOIN iam.roles roles
  ON roles.instance_id = 'de-musterhausen'
 AND roles.role_key = assignments.role_key
JOIN iam.permissions permissions
  ON permissions.instance_id = 'de-musterhausen'
 AND permissions.permission_key = assignments.permission_key
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT 'de-musterhausen', roles.id, permissions.id
FROM (
  VALUES
    ('system_admin', 'media.read'), ('system_admin', 'media.create'), ('system_admin', 'media.update'), ('system_admin', 'media.reference.manage'), ('system_admin', 'media.delete'), ('system_admin', 'media.deliver.protected'),
    ('system_admin', 'news.read'), ('system_admin', 'news.create'), ('system_admin', 'news.update'), ('system_admin', 'news.delete'),
    ('system_admin', 'events.read'), ('system_admin', 'events.create'), ('system_admin', 'events.update'), ('system_admin', 'events.delete'),
    ('system_admin', 'poi.read'), ('system_admin', 'poi.create'), ('system_admin', 'poi.update'), ('system_admin', 'poi.delete')
) AS assignments(role_key, permission_key)
JOIN iam.roles roles
  ON roles.instance_id = 'de-musterhausen'
 AND roles.role_key = assignments.role_key
JOIN iam.permissions permissions
  ON permissions.instance_id = 'de-musterhausen'
 AND permissions.permission_key = assignments.permission_key
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

COMMIT;
