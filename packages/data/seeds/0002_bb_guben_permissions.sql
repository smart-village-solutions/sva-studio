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
  ('63222222-2222-2222-2222-222222222222', 'bb-guben', 'app_manager', 'app_manager', 'app_manager', 'app_manager', 'Application management persona', true, 'studio', 'pending', 80),
  ('63333333-3333-3333-3333-333333333333', 'bb-guben', 'feature-manager', 'feature-manager', 'feature-manager', 'feature-manager', 'Feature management persona', true, 'studio', 'pending', 60),
  ('63444444-4444-4444-4444-444444444444', 'bb-guben', 'interface-manager', 'interface-manager', 'interface-manager', 'interface-manager', 'Interface management persona', true, 'studio', 'pending', 50),
  ('63555555-5555-5555-5555-555555555555', 'bb-guben', 'designer', 'designer', 'designer', 'designer', 'Design persona', true, 'studio', 'pending', 40),
  ('63666666-6666-6666-6666-666666666666', 'bb-guben', 'editor', 'editor', 'editor', 'editor', 'Editorial persona', true, 'studio', 'pending', 30),
  ('63777777-7777-7777-7777-777777777777', 'bb-guben', 'moderator', 'moderator', 'moderator', 'moderator', 'Moderation persona', true, 'studio', 'pending', 35),
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
  ('64111111-1111-1111-1111-111111111124', 'bb-guben', 'content.updatePayload', 'content.updatePayload', 'content', NULL, 'allow', '{}'::jsonb, 'Update content payload'),
  ('64111111-1111-1111-1111-111111111125', 'bb-guben', 'content.changeStatus', 'content.changeStatus', 'content', NULL, 'allow', '{}'::jsonb, 'Change content status'),
  ('64111111-1111-1111-1111-111111111126', 'bb-guben', 'content.archive', 'content.archive', 'content', NULL, 'allow', '{}'::jsonb, 'Archive content'),
  ('64111111-1111-1111-1111-111111111127', 'bb-guben', 'content.restore', 'content.restore', 'content', NULL, 'allow', '{}'::jsonb, 'Restore content'),
  ('64111111-1111-1111-1111-111111111128', 'bb-guben', 'content.readHistory', 'content.readHistory', 'content', NULL, 'allow', '{}'::jsonb, 'Read content history'),
  ('64111111-1111-1111-1111-111111111129', 'bb-guben', 'content.delete', 'content.delete', 'content', NULL, 'allow', '{}'::jsonb, 'Delete content'),
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
  ('64111111-1111-1111-1111-111111111142', 'bb-guben', 'poi.delete', 'poi.delete', 'poi', NULL, 'allow', '{}'::jsonb, 'Delete POI plugin content')
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
VALUES
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111111'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111112'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111113'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111114'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111115'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111116'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111118'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111119'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111120'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111121'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111122'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111123'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111124'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111125'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111126'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111127'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111128'),
  ('bb-guben', '63111111-1111-1111-1111-111111111111', '64111111-1111-1111-1111-111111111129'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111111'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111112'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111115'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111116'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111128'),
  ('bb-guben', '63222222-2222-2222-2222-222222222222', '64111111-1111-1111-1111-111111111123'),
  ('bb-guben', '63333333-3333-3333-3333-333333333333', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63333333-3333-3333-3333-333333333333', '64111111-1111-1111-1111-111111111119'),
  ('bb-guben', '63333333-3333-3333-3333-333333333333', '64111111-1111-1111-1111-111111111124'),
  ('bb-guben', '63333333-3333-3333-3333-333333333333', '64111111-1111-1111-1111-111111111125'),
  ('bb-guben', '63333333-3333-3333-3333-333333333333', '64111111-1111-1111-1111-111111111128'),
  ('bb-guben', '63333333-3333-3333-3333-333333333333', '64111111-1111-1111-1111-111111111123'),
  ('bb-guben', '63444444-4444-4444-4444-444444444444', '64111111-1111-1111-1111-111111111115'),
  ('bb-guben', '63444444-4444-4444-4444-444444444444', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63444444-4444-4444-4444-444444444444', '64111111-1111-1111-1111-111111111128'),
  ('bb-guben', '63444444-4444-4444-4444-444444444444', '64111111-1111-1111-1111-111111111122'),
  ('bb-guben', '63555555-5555-5555-5555-555555555555', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63555555-5555-5555-5555-555555555555', '64111111-1111-1111-1111-111111111119'),
  ('bb-guben', '63555555-5555-5555-5555-555555555555', '64111111-1111-1111-1111-111111111124'),
  ('bb-guben', '63555555-5555-5555-5555-555555555555', '64111111-1111-1111-1111-111111111128'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111118'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111119'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111124'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111125'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111128'),
  ('bb-guben', '63666666-6666-6666-6666-666666666666', '64111111-1111-1111-1111-111111111129'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111117'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111120'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111121'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111125'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111126'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111127'),
  ('bb-guben', '63777777-7777-7777-7777-777777777777', '64111111-1111-1111-1111-111111111128')
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT 'bb-guben', roles.id, permissions.id
FROM (
  VALUES
    ('system_admin', 'news.read'), ('system_admin', 'news.create'), ('system_admin', 'news.update'), ('system_admin', 'news.delete'),
    ('system_admin', 'events.read'), ('system_admin', 'events.create'), ('system_admin', 'events.update'), ('system_admin', 'events.delete'),
    ('system_admin', 'poi.read'), ('system_admin', 'poi.create'), ('system_admin', 'poi.update'), ('system_admin', 'poi.delete'),
    ('app_manager', 'news.read'), ('app_manager', 'events.read'), ('app_manager', 'poi.read'),
    ('feature-manager', 'news.read'), ('feature-manager', 'news.create'), ('feature-manager', 'news.update'), ('feature-manager', 'news.delete'),
    ('feature-manager', 'events.read'), ('feature-manager', 'events.create'), ('feature-manager', 'events.update'), ('feature-manager', 'events.delete'),
    ('feature-manager', 'poi.read'), ('feature-manager', 'poi.create'), ('feature-manager', 'poi.update'), ('feature-manager', 'poi.delete'),
    ('interface-manager', 'news.read'), ('interface-manager', 'events.read'), ('interface-manager', 'poi.read'),
    ('designer', 'news.read'), ('designer', 'news.update'), ('designer', 'events.read'), ('designer', 'events.update'), ('designer', 'poi.read'), ('designer', 'poi.update'),
    ('editor', 'news.read'), ('editor', 'news.create'), ('editor', 'news.update'), ('editor', 'news.delete'),
    ('editor', 'events.read'), ('editor', 'events.create'), ('editor', 'events.update'), ('editor', 'events.delete'),
    ('editor', 'poi.read'), ('editor', 'poi.create'), ('editor', 'poi.update'), ('editor', 'poi.delete'),
    ('moderator', 'news.read'), ('moderator', 'events.read'), ('moderator', 'poi.read')
) AS assignments(role_key, permission_key)
JOIN iam.roles roles
  ON roles.instance_id = 'bb-guben'
 AND roles.role_key = assignments.role_key
JOIN iam.permissions permissions
  ON permissions.instance_id = 'bb-guben'
 AND permissions.permission_key = assignments.permission_key
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

COMMIT;
