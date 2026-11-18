import { createMainserverJsonRequestHeaders } from '@sva/plugin-sdk';
import { z } from 'zod';
import {
  errors,
  operationSchemas,
  pluginRecordingBase,
  subject,
  uuid,
} from './organisation-key-contracts.js';
export type Operation = keyof typeof operationSchemas;
interface Options {
  id?: string;
  sub?: string;
  query?: URLSearchParams;
  body?: unknown;
  signal?: AbortSignal;
}
export const requestOperation = async <K extends Operation>(
  name: K,
  options: Options = {}
): Promise<z.output<(typeof operationSchemas)[K]['output']>> => {
  const op = operationSchemas[name];
  let path: string = op.path;
  if (path.includes('$id')) path = path.replace('$id', uuid.parse(options.id));
  if (path.includes('$sub'))
    path = path.replace('$sub', encodeURIComponent(subject.parse(options.sub)));
  const response = await fetch(
    pluginRecordingBase + path + (options.query ? '?' + options.query : ''),
    {
      method: op.method,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: options.signal,
      ...(op.method !== 'GET' ? { headers: createMainserverJsonRequestHeaders() } : {}),
      ...('input' in op ? { body: JSON.stringify(op.input.parse(options.body)) } : {}),
    }
  );
  if (!response.ok) {
    const e = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    const parsed = errors.safeParse(e?.error?.code);
    throw new Error(
      parsed.success
        ? parsed.data
        : response.status === 401
          ? 'AUTHENTICATION_REQUIRED'
          : response.status === 403
            ? 'PERMISSION_REQUIRED'
            : 'RECORDING_UNAVAILABLE'
    );
  }
  return op.output.parse(response.status === 204 ? null : await response.json()) as z.output<
    (typeof operationSchemas)[K]['output']
  >;
};
export const readPeople = async (signal: AbortSignal) => {
  const res = await fetch(pluginRecordingBase + '/access-transfer/people', {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!res.ok)
    throw new Error(
      res.status === 401
        ? 'AUTHENTICATION_REQUIRED'
        : res.status === 403
          ? 'PERMISSION_REQUIRED'
          : 'RECORDING_UNAVAILABLE'
    );
  return z
    .strictObject({
      users: z.array(z.strictObject({ sub: subject, displayName: z.string().max(200) })).max(10000),
    })
    .parse(await res.json()).users;
};
