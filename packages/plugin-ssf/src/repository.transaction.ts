import type { Pool, PoolClient } from 'pg';

const instanceIdPattern = /^(?!xn--)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

export const readCanonicalInstanceId = (instanceId: string): string => {
  if (instanceId !== instanceId.trim() || !instanceIdPattern.test(instanceId)) {
    throw new Error('ssf_tenant_instance_id_invalid');
  }
  return instanceId;
};

export const withTenantTransaction = async <T>(
  pool: Pool,
  instanceId: string,
  readOnly: boolean,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const canonicalInstanceId = readCanonicalInstanceId(instanceId);
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
    await client.query('SELECT set_config($1, $2, true);', [
      'app.instance_id',
      canonicalInstanceId,
    ]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the operation failure; a broken connection may also reject ROLLBACK.
    }
    throw error;
  } finally {
    client.release();
  }
};
