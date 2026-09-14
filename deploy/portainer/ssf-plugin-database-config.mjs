export const readDatabasePassword = ({
  connectionString,
  expectedDatabase,
  expectedHost,
  expectedPort,
  expectedUser,
  name,
}) => {
  const value = connectionString?.trim();
  if (!value) throw new Error(`${name}_missing`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name}_invalid`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${name}_invalid`);
  }
  if (decodeURIComponent(parsed.username) !== expectedUser) {
    throw new Error(`${name}_user_mismatch`);
  }
  if (decodeURIComponent(parsed.pathname.slice(1)) !== expectedDatabase) {
    throw new Error(`${name}_database_mismatch`);
  }
  if (parsed.hostname.toLowerCase() !== expectedHost.trim().toLowerCase()) {
    throw new Error(`${name}_host_mismatch`);
  }
  if ((parsed.port || '5432') !== expectedPort.trim()) {
    throw new Error(`${name}_port_mismatch`);
  }
  const password = decodeURIComponent(parsed.password);
  if (!password) throw new Error(`${name}_password_missing`);
  return password;
};

export const assertSafeDatabaseLogins = ({ postgresUser, rootLogin, runtimeLogin }) => {
  if (runtimeLogin === rootLogin) {
    throw new Error('SSF_PLUGIN_DATABASE_USERS_must_differ');
  }
  const reservedLogins = new Set([
    postgresUser,
    'postgres',
    'ssf_plugin_root',
    'ssf_plugin_tenant_runtime',
  ]);
  if (reservedLogins.has(runtimeLogin)) {
    throw new Error('SSF_PLUGIN_RUNTIME_DB_USER_reserved');
  }
  if (reservedLogins.has(rootLogin)) {
    throw new Error('SSF_PLUGIN_ROOT_DB_USER_reserved');
  }
};

export const assertDistinctDatabaseNames = ({ adminDatabase, targetDatabase }) => {
  if (adminDatabase === targetDatabase) {
    throw new Error('SSF_PLUGIN_DATABASE_NAME_matches_POSTGRES_DB');
  }
  if (new Set(['postgres', 'template0', 'template1']).has(targetDatabase)) {
    throw new Error('SSF_PLUGIN_DATABASE_NAME_reserved');
  }
};
