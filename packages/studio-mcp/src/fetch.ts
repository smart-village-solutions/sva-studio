import { readFile } from 'node:fs/promises';
import { Agent, fetch as undiciFetch } from 'undici';

export const createStudioFetch = async (caFilePath?: string): Promise<typeof fetch> => {
  if (!caFilePath) return fetch;
  const ca = await readFile(caFilePath, 'utf8');
  const dispatcher = new Agent({ connect: { ca, rejectUnauthorized: true } });
  return ((input: string | URL | globalThis.Request, init?: RequestInit) => {
    const undiciInit = Object.assign({}, init, { dispatcher }) as Parameters<typeof undiciFetch>[1];
    return undiciFetch(input as Parameters<typeof undiciFetch>[0], undiciInit) as unknown as Promise<Response>;
  }) as typeof fetch;
};
