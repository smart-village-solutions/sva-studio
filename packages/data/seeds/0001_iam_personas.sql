BEGIN;

INSERT INTO iam.instances (id, display_name)
VALUES (
  'de-musterhausen',
  'Seed Instance Default'
)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

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
  ('30222222-2222-2222-2222-222222222222', 'de-musterhausen', 'app_manager', 'app_manager', 'app_manager', 'app_manager', 'Application management persona', true, 'studio', 'pending', 80),
  ('30333333-3333-3333-3333-333333333333', 'de-musterhausen', 'feature-manager', 'feature-manager', 'feature-manager', 'feature-manager', 'Feature management persona', true, 'studio', 'pending', 60),
  ('30444444-4444-4444-4444-444444444444', 'de-musterhausen', 'interface-manager', 'interface-manager', 'interface-manager', 'interface-manager', 'Interface management persona', true, 'studio', 'pending', 50),
  ('30555555-5555-5555-5555-555555555555', 'de-musterhausen', 'designer', 'designer', 'designer', 'designer', 'Design persona', true, 'studio', 'pending', 40),
  ('30666666-6666-6666-6666-666666666666', 'de-musterhausen', 'editor', 'editor', 'editor', 'editor', 'Editorial persona', true, 'studio', 'pending', 30),
  ('30777777-7777-7777-7777-777777777777', 'de-musterhausen', 'moderator', 'moderator', 'moderator', 'moderator', 'Moderation persona', true, 'studio', 'pending', 35),
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
  ('40111111-1111-1111-1111-111111111119', 'de-musterhausen', 'content.update', 'content.update', 'content', NULL, 'allow', '{}'::jsonb, 'Update content'),
  ('40111111-1111-1111-1111-111111111120', 'de-musterhausen', 'content.publish', 'content.publish', 'content', NULL, 'allow', '{}'::jsonb, 'Publish content'),
  ('40111111-1111-1111-1111-111111111121', 'de-musterhausen', 'content.moderate', 'content.moderate', 'content', NULL, 'allow', '{}'::jsonb, 'Moderate content'),
  ('40111111-1111-1111-1111-111111111122', 'de-musterhausen', 'integration.manage', 'integration.manage', 'integration', NULL, 'allow', '{}'::jsonb, 'Manage integrations'),
  ('40111111-1111-1111-1111-111111111123', 'de-musterhausen', 'feature.toggle', 'feature.toggle', 'feature', NULL, 'allow', '{}'::jsonb, 'Toggle feature flags')
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
  ('50111111-1111-1111-1111-111111111111', 'de-musterhausen', 'seed:system_admin', 'enc:v1:seed:2Br4L9r7mA:89azg6De9W2xgh9ZWMDg7Q:6ZkQz-ljCq8', 'enc:v1:seed:r76A9cbcvQ:F6GQjC-KsZdU6kgb4fX6RQ:Wr8vP9mS7hY'),
  ('50222222-2222-2222-2222-222222222222', 'de-musterhausen', 'seed:app_manager', 'enc:v1:seed:Y2W6W_Q6YA:4IbeUqS5iZgRyj8wud1dnQ:BK4U5GJp2xM', 'enc:v1:seed:8uoN0kRw1A:3FSkP2_Pfc7RK2Y9CB_q5Q:h-ZwYFhN0q8'),
  ('50333333-3333-3333-3333-333333333333', 'de-musterhausen', 'seed:feature_manager', 'enc:v1:seed:4N10D5lGmA:8u6j2qXxmnLr8XHnQw5H7w:G4KfA9iWv0o', 'enc:v1:seed:aXh5YpP9mQ:1d8W5v4u0QvXfBY3M2e0nA:T2hPn6Kx4Rc'),
  ('50444444-4444-4444-4444-444444444444', 'de-musterhausen', 'seed:interface_manager', 'enc:v1:seed:9bH6fVv8xQ:5vxw8QjC2LrYAfj9QJ8R6w:hD6mQs1v9Nk', 'enc:v1:seed:H2n7bLx4kA:6gq3j8G2p8QYk6M8rA1N6g:R7kL0jU2nQw'),
  ('50555555-5555-5555-5555-555555555555', 'de-musterhausen', 'seed:designer', 'enc:v1:seed:V4k9rMz0pA:9D8m4W2nV7qQf1eR6yU2dA:K6hPa9sV3wQ', 'enc:v1:seed:uM0w7Xn2cA:2f8N6d3Qv9sK1aP4rT7yBg:B9mPq2hV6xW'),
  ('50666666-6666-6666-6666-666666666666', 'de-musterhausen', 'seed:editor', 'enc:v1:seed:G1y8nVb6qA:3r6M9d2Pq8wV4cT1mK7xJQ:L5pQw8nZ2vR', 'enc:v1:seed:mQ9k7Bv2dA:7t1P4nW8rQ6yV3fM9xJ2cQ:N4sLh7kP1wR'),
  ('50777777-7777-7777-7777-777777777777', 'de-musterhausen', 'seed:moderator', 'enc:v1:seed:T8m4cN1vQw:8a2K5qP9rW3nX6dM1jF7yA:Q7wP2nK6vXs', 'enc:v1:seed:zR3n8Vq5mA:5y9J2kF6pQ4tW1dN8xM3rQ:P2hVk9mQ4wX')
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE
SET
  email_ciphertext = EXCLUDED.email_ciphertext,
  display_name_ciphertext = EXCLUDED.display_name_ciphertext,
  updated_at = NOW();

INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', 'member'),
  ('de-musterhausen', '50222222-2222-2222-2222-222222222222', 'member'),
  ('de-musterhausen', '50333333-3333-3333-3333-333333333333', 'member'),
  ('de-musterhausen', '50444444-4444-4444-4444-444444444444', 'member'),
  ('de-musterhausen', '50555555-5555-5555-5555-555555555555', 'member'),
  ('de-musterhausen', '50666666-6666-6666-6666-666666666666', 'member'),
  ('de-musterhausen', '50777777-7777-7777-7777-777777777777', 'member')
ON CONFLICT (instance_id, account_id) DO UPDATE
SET
  membership_type = EXCLUDED.membership_type;

INSERT INTO iam.account_roles (instance_id, account_id, role_id)
VALUES
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', '30111111-1111-1111-1111-111111111111'),
  ('de-musterhausen', '50222222-2222-2222-2222-222222222222', '30222222-2222-2222-2222-222222222222'),
  ('de-musterhausen', '50333333-3333-3333-3333-333333333333', '30333333-3333-3333-3333-333333333333'),
  ('de-musterhausen', '50444444-4444-4444-4444-444444444444', '30444444-4444-4444-4444-444444444444'),
  ('de-musterhausen', '50555555-5555-5555-5555-555555555555', '30555555-5555-5555-5555-555555555555'),
  ('de-musterhausen', '50666666-6666-6666-6666-666666666666', '30666666-6666-6666-6666-666666666666'),
  ('de-musterhausen', '50777777-7777-7777-7777-777777777777', '30777777-7777-7777-7777-777777777777')
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
  ('de-musterhausen', '50111111-1111-1111-1111-111111111111', '22333333-3333-3333-3333-333333333333', false, 'internal'),
  ('de-musterhausen', '50222222-2222-2222-2222-222222222222', '22333333-3333-3333-3333-333333333333', true, 'internal'),
  ('de-musterhausen', '50333333-3333-3333-3333-333333333333', '22333333-3333-3333-3333-333333333333', true, 'internal'),
  ('de-musterhausen', '50333333-3333-3333-3333-333333333333', '22444444-4444-4444-4444-444444444444', false, 'external'),
  ('de-musterhausen', '50444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', true, 'internal'),
  ('de-musterhausen', '50555555-5555-5555-5555-555555555555', '22444444-4444-4444-4444-444444444444', true, 'internal'),
  ('de-musterhausen', '50666666-6666-6666-6666-666666666666', '22444444-4444-4444-4444-444444444444', true, 'internal'),
  ('de-musterhausen', '50666666-6666-6666-6666-666666666666', '22333333-3333-3333-3333-333333333333', false, 'internal'),
  ('de-musterhausen', '50777777-7777-7777-7777-777777777777', '22333333-3333-3333-3333-333333333333', true, 'internal')
ON CONFLICT (instance_id, account_id, organization_id) DO UPDATE
SET
  is_default_context = EXCLUDED.is_default_context,
  membership_visibility = EXCLUDED.membership_visibility;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
VALUES
  -- system-admin
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111111'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111112'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111113'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111114'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111115'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111116'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111118'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111119'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111120'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111121'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111122'),
  ('de-musterhausen', '30111111-1111-1111-1111-111111111111', '40111111-1111-1111-1111-111111111123'),
  -- app-manager
  ('de-musterhausen', '30222222-2222-2222-2222-222222222222', '40111111-1111-1111-1111-111111111111'),
  ('de-musterhausen', '30222222-2222-2222-2222-222222222222', '40111111-1111-1111-1111-111111111112'),
  ('de-musterhausen', '30222222-2222-2222-2222-222222222222', '40111111-1111-1111-1111-111111111115'),
  ('de-musterhausen', '30222222-2222-2222-2222-222222222222', '40111111-1111-1111-1111-111111111116'),
  ('de-musterhausen', '30222222-2222-2222-2222-222222222222', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30222222-2222-2222-2222-222222222222', '40111111-1111-1111-1111-111111111123'),
  -- feature-manager
  ('de-musterhausen', '30333333-3333-3333-3333-333333333333', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30333333-3333-3333-3333-333333333333', '40111111-1111-1111-1111-111111111119'),
  ('de-musterhausen', '30333333-3333-3333-3333-333333333333', '40111111-1111-1111-1111-111111111123'),
  -- interface-manager
  ('de-musterhausen', '30444444-4444-4444-4444-444444444444', '40111111-1111-1111-1111-111111111115'),
  ('de-musterhausen', '30444444-4444-4444-4444-444444444444', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30444444-4444-4444-4444-444444444444', '40111111-1111-1111-1111-111111111122'),
  -- designer
  ('de-musterhausen', '30555555-5555-5555-5555-555555555555', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30555555-5555-5555-5555-555555555555', '40111111-1111-1111-1111-111111111119'),
  -- editor
  ('de-musterhausen', '30666666-6666-6666-6666-666666666666', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30666666-6666-6666-6666-666666666666', '40111111-1111-1111-1111-111111111118'),
  ('de-musterhausen', '30666666-6666-6666-6666-666666666666', '40111111-1111-1111-1111-111111111119'),
  -- moderator
  ('de-musterhausen', '30777777-7777-7777-7777-777777777777', '40111111-1111-1111-1111-111111111117'),
  ('de-musterhausen', '30777777-7777-7777-7777-777777777777', '40111111-1111-1111-1111-111111111120'),
  ('de-musterhausen', '30777777-7777-7777-7777-777777777777', '40111111-1111-1111-1111-111111111121')
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

COMMIT;
