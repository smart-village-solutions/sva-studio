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
  'bb-guben',
  'BB Guben',
  'active',
  'studio.smart-village.app',
  'bb-guben.studio.smart-village.app',
  'bb-guben',
  'sva-studio',
  'sva-studio-admin',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES (
  'bb-guben.studio.smart-village.app',
  'bb-guben',
  true,
  'seed:0002_bb_guben_permissions'
)
ON CONFLICT (hostname) DO NOTHING;

INSERT INTO iam.instance_modules (instance_id, module_id)
VALUES
  ('bb-guben', 'categories'),
  ('bb-guben', 'poi')
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
  '62222222-2222-2222-2222-222222222222',
  'bb-guben',
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
  '62333333-3333-3333-3333-333333333333',
  'bb-guben',
  'seed-org-municipality',
  'Seed Municipality',
  '{"seed":true,"version":"v2","level":"municipality"}'::jsonb,
  'municipality',
  'org_or_personal',
  '62222222-2222-2222-2222-222222222222',
  ARRAY['62222222-2222-2222-2222-222222222222']::uuid[],
  1,
  true
),
(
  '62444444-4444-4444-4444-444444444444',
  'bb-guben',
  'seed-org-district',
  'Seed District',
  '{"seed":true,"version":"v2","level":"district"}'::jsonb,
  'district',
  'org_only',
  '62333333-3333-3333-3333-333333333333',
  ARRAY[
    '62222222-2222-2222-2222-222222222222',
    '62333333-3333-3333-3333-333333333333'
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
  ('63111111-1111-1111-1111-111111111111', 'bb-guben', 'system_admin', 'system_admin', 'system_admin', 'system_admin', 'System administration persona', true, 'studio', 'pending', 100),
  ('63888888-8888-8888-8888-888888888888', 'bb-guben', 'mainserver_admin', 'mainserver_admin', 'Admin', 'Admin', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 90),
  ('63999999-9999-9999-9999-999999999999', 'bb-guben', 'mainserver_app', 'mainserver_app', 'App', 'App', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 80),
  ('63aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bb-guben', 'mainserver_user', 'mainserver_user', 'User', 'User', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 20),
  ('63bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb-guben', 'mainserver_extended_user', 'mainserver_extended_user', 'Extended User', 'Extended User', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 30),
  ('63cccccc-cccc-cccc-cccc-cccccccccccc', 'bb-guben', 'mainserver_restricted', 'mainserver_restricted', 'Restricted', 'Restricted', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 10),
  ('63dddddd-dddd-dddd-dddd-dddddddddddd', 'bb-guben', 'mainserver_editor', 'mainserver_editor', 'Editor', 'Editor', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 40),
  ('63eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bb-guben', 'mainserver_read_only', 'mainserver_read_only', 'Read only', 'Read only', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 5),
  ('63ffffff-ffff-ffff-ffff-ffffffffffff', 'bb-guben', 'mainserver_account_manager', 'mainserver_account_manager', 'Account Manager', 'Account Manager', 'Studio-verwaltete Bootstrap-Rolle für den Abgleich mit dem externen SVA-Mainserver.', false, 'studio', 'pending', 70)
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
  ('64111111-1111-1111-1111-111111111111', 'bb-guben', 'iam.user.read', 'iam.user.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read account data'),
  ('64111111-1111-1111-1111-111111111112', 'bb-guben', 'iam.user.write', 'iam.user.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify account data'),
  ('64111111-1111-1111-1111-111111111113', 'bb-guben', 'iam.role.read', 'iam.role.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read role assignments'),
  ('64111111-1111-1111-1111-111111111114', 'bb-guben', 'iam.role.write', 'iam.role.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify role assignments'),
  ('64111111-1111-1111-1111-111111111115', 'bb-guben', 'iam.org.read', 'iam.org.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read organization data'),
  ('64111111-1111-1111-1111-111111111116', 'bb-guben', 'iam.org.write', 'iam.org.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify organization data'),
  ('64111111-1111-1111-1111-111111111117', 'bb-guben', 'content.read', 'content.read', 'content', NULL, 'allow', '{}'::jsonb, 'Read content'),
  ('64111111-1111-1111-1111-111111111118', 'bb-guben', 'content.create', 'content.create', 'content', NULL, 'allow', '{}'::jsonb, 'Create content'),
  ('64111111-1111-1111-1111-111111111119', 'bb-guben', 'content.updateMetadata', 'content.updateMetadata', 'content', NULL, 'allow', '{}'::jsonb, 'Update content metadata'),
  ('64111111-1111-1111-1111-111111111120', 'bb-guben', 'content.publish', 'content.publish', 'content', NULL, 'allow', '{}'::jsonb, 'Publish content'),
  ('64111111-1111-1111-1111-111111111121', 'bb-guben', 'content.manageRevisions', 'content.manageRevisions', 'content', NULL, 'allow', '{}'::jsonb, 'Manage content revisions'),
  ('64111111-1111-1111-1111-111111111122', 'bb-guben', 'integration.manage', 'integration.manage', 'integration', NULL, 'allow', '{}'::jsonb, 'Manage integrations'),
  ('64111111-1111-1111-1111-111111111123', 'bb-guben', 'feature.toggle', 'feature.toggle', 'feature', NULL, 'allow', '{}'::jsonb, 'Toggle feature flags'),
  ('64111111-1111-1111-1111-111111111149', 'bb-guben', 'app.read', 'app.read', 'app', NULL, 'allow', '{}'::jsonb, 'Show the app link in the sidebar'),
  ('64111111-1111-1111-1111-111111111150', 'bb-guben', 'cockpit.read', 'cockpit.read', 'cockpit', NULL, 'allow', '{}'::jsonb, 'Show the cockpit link in the sidebar'),
  ('64111111-1111-1111-1111-111111111124', 'bb-guben', 'instance.registry.manage', 'instance.registry.manage', 'instance', NULL, 'allow', '{}'::jsonb, 'Manage instance registry and provisioning'),
  ('64111111-1111-1111-1111-111111111125', 'bb-guben', 'content.updatePayload', 'content.updatePayload', 'content', NULL, 'allow', '{}'::jsonb, 'Update content payload'),
  ('64111111-1111-1111-1111-111111111126', 'bb-guben', 'content.changeStatus', 'content.changeStatus', 'content', NULL, 'allow', '{}'::jsonb, 'Change content status'),
  ('64111111-1111-1111-1111-111111111127', 'bb-guben', 'content.archive', 'content.archive', 'content', NULL, 'allow', '{}'::jsonb, 'Archive content'),
  ('64111111-1111-1111-1111-111111111128', 'bb-guben', 'content.restore', 'content.restore', 'content', NULL, 'allow', '{}'::jsonb, 'Restore content'),
  ('64111111-1111-1111-1111-111111111129', 'bb-guben', 'content.readHistory', 'content.readHistory', 'content', NULL, 'allow', '{}'::jsonb, 'Read content history'),
  ('64111111-1111-1111-1111-111111111130', 'bb-guben', 'content.delete', 'content.delete', 'content', NULL, 'allow', '{}'::jsonb, 'Delete content'),
  ('64111111-1111-1111-1111-111111111143', 'bb-guben', 'media.read', 'media.read', 'media', NULL, 'allow', '{}'::jsonb, 'Read media'),
  ('64111111-1111-1111-1111-111111111144', 'bb-guben', 'media.create', 'media.create', 'media', NULL, 'allow', '{}'::jsonb, 'Create media'),
  ('64111111-1111-1111-1111-111111111145', 'bb-guben', 'media.update', 'media.update', 'media', NULL, 'allow', '{}'::jsonb, 'Update media'),
  ('64111111-1111-1111-1111-111111111146', 'bb-guben', 'media.reference.manage', 'media.reference.manage', 'media', NULL, 'allow', '{}'::jsonb, 'Manage media references'),
  ('64111111-1111-1111-1111-111111111147', 'bb-guben', 'media.delete', 'media.delete', 'media', NULL, 'allow', '{}'::jsonb, 'Delete media'),
  ('64111111-1111-1111-1111-111111111148', 'bb-guben', 'media.deliver.protected', 'media.deliver.protected', 'media', NULL, 'allow', '{}'::jsonb, 'Deliver protected media'),
  ('64111111-1111-1111-1111-111111111151', 'bb-guben', 'iam.legalText.read', 'iam.legalText.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read legal text administration data'),
  ('64111111-1111-1111-1111-111111111152', 'bb-guben', 'iam.legalText.write', 'iam.legalText.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify legal text administration data'),
  ('64111111-1111-1111-1111-111111111153', 'bb-guben', 'iam.governance.read', 'iam.governance.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read governance workflows and audit trails'),
  ('64111111-1111-1111-1111-111111111154', 'bb-guben', 'iam.governance.write', 'iam.governance.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Execute governance workflows and decisions'),
  ('64111111-1111-1111-1111-111111111155', 'bb-guben', 'iam.governance.export', 'iam.governance.export', 'iam', NULL, 'allow', '{}'::jsonb, 'Export governance and legal consent evidence'),
  ('64111111-1111-1111-1111-111111111156', 'bb-guben', 'iam.dsr.read', 'iam.dsr.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read tenant data-subject-rights cases'),
  ('64111111-1111-1111-1111-111111111157', 'bb-guben', 'iam.dsr.write', 'iam.dsr.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Process tenant data-subject-rights cases'),
  ('64111111-1111-1111-1111-111111111158', 'bb-guben', 'iam.dsr.export', 'iam.dsr.export', 'iam', NULL, 'allow', '{}'::jsonb, 'Export tenant data-subject-rights payloads'),
  ('64111111-1111-1111-1111-111111111159', 'bb-guben', 'iam.deletionRules.read', 'iam.deletionRules.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read tenant deletion rules'),
  ('64111111-1111-1111-1111-111111111160', 'bb-guben', 'iam.deletionRules.write', 'iam.deletionRules.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Modify tenant deletion rules'),
  ('64111111-1111-1111-1111-111111111161', 'bb-guben', 'iam.monitoring.read', 'iam.monitoring.read', 'iam', NULL, 'allow', '{}'::jsonb, 'Read IAM monitoring and plugin operation status'),
  ('64111111-1111-1111-1111-111111111162', 'bb-guben', 'iam.monitoring.write', 'iam.monitoring.write', 'iam', NULL, 'allow', '{}'::jsonb, 'Run IAM monitoring and plugin operations'),
  ('64111111-1111-1111-1111-111111111163', 'bb-guben', 'experimental.read', 'experimental.read', 'experimental', NULL, 'allow', '{}'::jsonb, 'Enable experimental shell features and placeholders'),
  ('64111111-1111-1111-1111-111111111131', 'bb-guben', 'news.read', 'news.read', 'news', NULL, 'allow', '{}'::jsonb, 'Read news plugin content'),
  ('64111111-1111-1111-1111-111111111132', 'bb-guben', 'news.create', 'news.create', 'news', NULL, 'allow', '{}'::jsonb, 'Create news plugin content'),
  ('64111111-1111-1111-1111-111111111133', 'bb-guben', 'news.update', 'news.update', 'news', NULL, 'allow', '{}'::jsonb, 'Update news plugin content'),
  ('64111111-1111-1111-1111-111111111134', 'bb-guben', 'news.delete', 'news.delete', 'news', NULL, 'allow', '{}'::jsonb, 'Delete news plugin content'),
  ('64111111-1111-1111-1111-111111111135', 'bb-guben', 'events.read', 'events.read', 'events', NULL, 'allow', '{}'::jsonb, 'Read events plugin content'),
  ('64111111-1111-1111-1111-111111111136', 'bb-guben', 'events.create', 'events.create', 'events', NULL, 'allow', '{}'::jsonb, 'Create events plugin content'),
  ('64111111-1111-1111-1111-111111111137', 'bb-guben', 'events.update', 'events.update', 'events', NULL, 'allow', '{}'::jsonb, 'Update events plugin content'),
  ('64111111-1111-1111-1111-111111111138', 'bb-guben', 'events.delete', 'events.delete', 'events', NULL, 'allow', '{}'::jsonb, 'Delete events plugin content'),
  ('64111111-1111-1111-1111-111111111139', 'bb-guben', 'poi.read', 'poi.read', 'poi', NULL, 'allow', '{}'::jsonb, 'Read POI plugin content'),
  ('64111111-1111-1111-1111-111111111140', 'bb-guben', 'poi.create', 'poi.create', 'poi', NULL, 'allow', '{}'::jsonb, 'Create POI plugin content'),
  ('64111111-1111-1111-1111-111111111141', 'bb-guben', 'poi.update', 'poi.update', 'poi', NULL, 'allow', '{}'::jsonb, 'Update POI plugin content'),
  ('64111111-1111-1111-1111-111111111142', 'bb-guben', 'poi.delete', 'poi.delete', 'poi', NULL, 'allow', '{}'::jsonb, 'Delete POI plugin content'),
  ('64111111-1111-1111-1111-111111111164', 'bb-guben', 'categories.read', 'categories.read', 'categories', NULL, 'allow', '{}'::jsonb, 'Read categories plugin content'),
  ('64111111-1111-1111-1111-111111111165', 'bb-guben', 'categories.create', 'categories.create', 'categories', NULL, 'allow', '{}'::jsonb, 'Create categories plugin content'),
  ('64111111-1111-1111-1111-111111111166', 'bb-guben', 'categories.update', 'categories.update', 'categories', NULL, 'allow', '{}'::jsonb, 'Update categories plugin content'),
  ('64111111-1111-1111-1111-111111111167', 'bb-guben', 'categories.delete', 'categories.delete', 'categories', NULL, 'allow', '{}'::jsonb, 'Delete categories plugin content')
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT 'bb-guben', roles.id, permissions.id
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
  ON roles.instance_id = 'bb-guben'
 AND roles.role_key = assignments.role_key
JOIN iam.permissions permissions
  ON permissions.instance_id = 'bb-guben'
 AND permissions.permission_key = assignments.permission_key
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT 'bb-guben', roles.id, permissions.id
FROM (
  VALUES
    ('system_admin', 'media.read'), ('system_admin', 'media.create'), ('system_admin', 'media.update'), ('system_admin', 'media.reference.manage'), ('system_admin', 'media.delete'), ('system_admin', 'media.deliver.protected'),
    ('system_admin', 'news.read'), ('system_admin', 'news.create'), ('system_admin', 'news.update'), ('system_admin', 'news.delete'),
    ('system_admin', 'events.read'), ('system_admin', 'events.create'), ('system_admin', 'events.update'), ('system_admin', 'events.delete'),
    ('system_admin', 'poi.read'), ('system_admin', 'poi.create'), ('system_admin', 'poi.update'), ('system_admin', 'poi.delete'),
    ('system_admin', 'categories.read'), ('system_admin', 'categories.create'), ('system_admin', 'categories.update'), ('system_admin', 'categories.delete')
) AS assignments(role_key, permission_key)
JOIN iam.roles roles
  ON roles.instance_id = 'bb-guben'
 AND roles.role_key = assignments.role_key
JOIN iam.permissions permissions
  ON permissions.instance_id = 'bb-guben'
 AND permissions.permission_key = assignments.permission_key
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

COMMIT;
