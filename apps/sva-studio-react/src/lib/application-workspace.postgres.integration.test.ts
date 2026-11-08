// @vitest-environment node
/** Real cookie session, dispatcher, module/permission queries and host transaction. */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { withInstanceDb } from '../../../../packages/auth-runtime/src/db.js';
import { bumpPermissionRevisionWithClient } from '../../../../packages/auth-runtime/src/iam-authorization/permission-revision-store.js';
import { closeRedis } from '../../../../packages/auth-runtime/src/redis.js';
import { createSession, deleteSession } from '../../../../packages/auth-runtime/src/redis-session.js';
import { createStudioPluginServerHandlerDispatcher } from './plugin-server-runtime.server.js';
import { applicationWorkspaceHost } from './application-workspace.server.js';
import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
const url = process.env.APPLICATION_WORKSPACE_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || process.env.IAM_DATABASE_URL !== url) throw Error('explicit_disposable_host_database_required');
const pool = new Pool({ connectionString: url });
const instance = `workspace-${randomUUID()}`, foreign = `workspace-${randomUUID()}`;
const actor = randomUUID(), subject = randomUUID(), role = randomUUID(), sessionId = randomUUID();
const origin = `https://tenant.${instance}.qa.test`;
let dispatch: Awaited<ReturnType<typeof createStudioPluginServerHandlerDispatcher>>;
const request = (path = '', method = 'GET', body?: unknown, cookie = true) => new Request(`${origin}/api/v1/plugins/application-workspace${path}`, {
  method, headers: { ...(cookie ? { Cookie: `sva_auth_session=${sessionId}` } : {}), Origin: origin, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const call = async (...args: Parameters<typeof request>) => {
  const response = await dispatch(request(...args));
  if (!response) throw Error('installed_plugin_handler_missing');
  return response;
};
const configuration = { version: 0, tiles: [{ id: 'one', icon: 'calendar', url: 'https://calendar.example', texts: { de: { name: 'Kalender', description: 'Termine', cta: 'Öffnen' } } }] };
beforeAll(async () => {
  for (const id of [instance, foreign]) {
    await pool.query(`INSERT INTO iam.instances(id,display_name,primary_hostname,tenant_admin_client_id,auth_realm,auth_client_id,status) VALUES($1,'QA',$2,'tenant-admin',$1,'studio','active')`, [id, `tenant.${id}.qa.test`]);
    await pool.query("INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES($1,'application-workspace',true)", [id]);
    await pool.query("INSERT INTO iam.instance_plugin_lifecycle(instance_id,plugin_id,readiness_status,completed_generation) VALUES($1,'application-workspace','ready',1)", [id]);
  }
  await pool.query("INSERT INTO iam.accounts(id,keycloak_subject,instance_id,status) VALUES($1,$2,$3,'active')",[actor,subject,instance]);
  await pool.query('INSERT INTO iam.instance_memberships(account_id,instance_id) VALUES($1,$2)',[actor,instance]);
  await pool.query("INSERT INTO iam.roles(id,role_name,role_key,display_name,external_role_name,instance_id) VALUES($1,'QA','qa','QA','qa',$2)",[role,instance]);
  await pool.query('INSERT INTO iam.account_roles(account_id,role_id,instance_id) VALUES($1,$2,$3)',[actor,role,instance]);
  for (const action of ['application-workspace.settings.read','application-workspace.settings.update']) {
    const permission = randomUUID();
    await pool.query("INSERT INTO iam.permissions(id,permission_key,action,resource_type,instance_id) VALUES($1,$2,$2,'application-workspace.settings',$3)",[permission,action,instance]);
    await pool.query('INSERT INTO iam.role_permissions(role_id,permission_id,instance_id) VALUES($1,$2,$3)',[role,permission,instance]);
  }
  await createSession(sessionId,{ id: sessionId, userId: subject, user: { id: subject, instanceId: instance, roles: ['qa'] }, createdAt: Date.now(), expiresAt: Date.now()+600000 });
  dispatch = await createStudioPluginServerHandlerDispatcher();
});
afterAll(async () => {
  await deleteSession(sessionId);
  const cleanup = await pool.connect();
  try {
    await cleanup.query("BEGIN; SET LOCAL iam.retention_mode='true';");
    await cleanup.query('DELETE FROM iam.instances WHERE id=ANY($1::text[])',[[instance,foreign]]);
    await cleanup.query('COMMIT');
  } catch (error) { await cleanup.query('ROLLBACK'); throw error; }
  finally { cleanup.release(); }
  await pool.end();
  await closeRedis();
});
it('loads the installed descriptor and rejects anonymous or forged sessions', async () => {
  expect((await call('', 'GET', undefined, false)).status).toBe(401);
  const authenticated = await call();
  expect(await authenticated.clone().json()).not.toHaveProperty('error');
  expect(authenticated.status).toBe(200);
  const forged = request(); forged.headers.set('Cookie','sva_auth_session=not-a-session');
  expect((await dispatch(forged))?.status).toBe(401);
});
it('persists through the actual host with audit, CSRF protection and independent readback', async () => {
  const csrf = request('/settings','PUT',configuration); csrf.headers.delete('X-Requested-With');
  expect((await dispatch(csrf))?.status).toBe(403);
  const response = await call('/settings','PUT',configuration);
  expect(response.status).toBe(200);
  expect((await response.json()).data.version).toBe(1);
  expect((await (await call()).json()).data.tiles).toEqual(configuration.tiles);
  const audit = await pool.query("SELECT payload FROM iam.activity_logs WHERE instance_id=$1 AND event_type='plugin_action_authorized'",[instance]);
  expect(audit.rowCount).toBeGreaterThanOrEqual(2);
});
it('rejects stale revisions and disabled modules without losing stored data', async () => {
  expect((await call('/settings','PUT',configuration)).status).toBe(409);
  await pool.query("UPDATE iam.instance_modules SET effective_active=false WHERE instance_id=$1 AND module_id='application-workspace'",[instance]);
  try { expect((await call()).status).toBe(403); }
  finally { await pool.query("UPDATE iam.instance_modules SET effective_active=true WHERE instance_id=$1 AND module_id='application-workspace'",[instance]); }
  expect((await (await call()).json()).data.version).toBe(1);
});
it('rolls back the actual storage adapter when its actual audit insert fails', async () => {
  await pool.query(`CREATE FUNCTION iam.workspace_qa_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.instance_id = '${instance}' THEN RAISE EXCEPTION 'qa_audit_failed'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER workspace_qa_audit_failure BEFORE INSERT ON iam.activity_logs FOR EACH ROW EXECUTE FUNCTION iam.workspace_qa_audit_failure()');
  try { expect((await call('/settings','PUT',{version:1,tiles:[]})).status).toBe(503); }
  finally { await pool.query('DROP TRIGGER workspace_qa_audit_failure ON iam.activity_logs'); await pool.query('DROP FUNCTION iam.workspace_qa_audit_failure()'); }
  expect((await (await call()).json()).data).toEqual({version:1,tiles:configuration.tiles});
});
it('keeps the injected adapter tenant-bound independently of a caller supplied tile', async () => {
  const foreignContext: Extract<PluginServerHandlerExecutionContext,{scope:'tenant'|'platform'}> = { request: request(), sessionId, pluginId: 'application-workspace', handlerId: 'application-workspace.settings.save', pathParams: {}, scope:'tenant', actor:{ id:subject,roles:[],instanceId:foreign } };
  expect(await applicationWorkspaceHost.read(foreign)).toEqual({version:0,tiles:[]});
  await applicationWorkspaceHost.save(foreignContext,{version:0,tiles:[]});
  expect((await applicationWorkspaceHost.read(instance)).tiles).toEqual(configuration.tiles);
});

it('ignores a forged instance header and enforces revoked settings rights at the direct API', async () => {
  const forged = request(); forged.headers.set('X-Instance-Id', foreign);
  expect((await (await dispatch(forged))!.json()).data.tiles).toEqual(configuration.tiles);
  await withInstanceDb(instance, async (client) => {
  await client.query(`DELETE FROM iam.role_permissions WHERE role_id=$1 AND permission_id IN (SELECT id FROM iam.permissions WHERE instance_id=$2 AND action='application-workspace.settings.read')`,[role,instance]);
    await bumpPermissionRevisionWithClient(client, { kind: 'user', instanceId: instance, keycloakSubject: subject });
  });
  expect((await call('/settings')).status).toBe(403);
  expect((await call('/settings','PUT',{version:1,tiles:[]})).status).toBe(403);
  expect((await call()).status).toBe(200);
});
