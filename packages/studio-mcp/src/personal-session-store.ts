import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PersonalMcpContext } from './config.js';
import { PersonalMcpAuthError } from './personal-auth-errors.js';

const storedSessionSchema = z
  .object({
    version: z.literal(1),
    binding: z.string(),
    subject: z.string().min(1),
    account: z.string().min(1),
    refreshToken: z.string().min(1),
  })
  .strict();
export type StoredPersonalSession = z.infer<typeof storedSessionSchema>;
export interface PersonalSessionStore {
  load(context: PersonalMcpContext): Promise<StoredPersonalSession | undefined>;
  save(context: PersonalMcpContext, session: StoredPersonalSession): Promise<void>;
  delete(context: PersonalMcpContext): Promise<void>;
}

export const personalSessionBinding = (context: PersonalMcpContext): string =>
  createHash('sha256')
    .update(
      JSON.stringify([
        context.id,
        context.kind,
        context.baseUrl,
        context.issuer,
        context.clientId,
        context.kind === 'tenant' ? context.tenantId : null,
      ])
    )
    .digest('hex');

// Credentials travel through stdin, never process arguments, environment, files or logs.
const security = (
  args: readonly string[],
  input?: string
): Promise<{ code: number; output: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/security', [...args], { stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '';
    const timeout = setTimeout(() => child.kill(), 10_000);
    const fail = () => reject(new PersonalMcpAuthError('personal_session_store_unavailable'));
    child.once('error', fail);
    child.stdin.on('error', fail);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (Buffer.byteLength(output) > 64 * 1024) child.kill();
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code === null || Buffer.byteLength(output) > 64 * 1024) fail();
      else resolve({ code, output });
    });
    child.stdin.end(input);
  });

export class MacOsPersonalSessionStore implements PersonalSessionStore {
  constructor() {
    if (process.platform !== 'darwin')
      throw new PersonalMcpAuthError('personal_session_store_unavailable');
  }
  private args(context: PersonalMcpContext): string[] {
    return ['-s', 'sva-studio-mcp-personal-session', '-a', personalSessionBinding(context)];
  }
  async load(context: PersonalMcpContext): Promise<StoredPersonalSession | undefined> {
    const result = await security(['find-generic-password', ...this.args(context), '-w']);
    if (result.code === 44) return undefined;
    if (result.code !== 0) throw new PersonalMcpAuthError('personal_session_store_unavailable');
    try {
      const session = storedSessionSchema.parse(
        JSON.parse(Buffer.from(result.output.trim(), 'base64').toString('utf8'))
      );
      if (session.binding !== personalSessionBinding(context)) throw new Error('binding_mismatch');
      return session;
    } catch {
      await this.delete(context);
      throw new PersonalMcpAuthError('context_login_required');
    }
  }
  async save(context: PersonalMcpContext, session: StoredPersonalSession): Promise<void> {
    if (session.binding !== personalSessionBinding(context))
      throw new PersonalMcpAuthError('context_login_required');
    const value = Buffer.from(JSON.stringify(storedSessionSchema.parse(session))).toString(
      'base64'
    );
    const args = ['add-generic-password', '-U', ...this.args(context), '-w', value];
    // All tokens are base64, all other arguments are fixed strings or hex hashes.
    const command = args.join(' ') + '\n';
    // The native interactive CLI accepts at most 4095 bytes per input line.
    if (Buffer.byteLength(command) > 4095) throw new PersonalMcpAuthError('personal_session_store_unavailable');
    const result = await security(['-i'], command);
    if (result.code !== 0) throw new PersonalMcpAuthError('personal_session_store_unavailable');
  }
  async delete(context: PersonalMcpContext): Promise<void> {
    const result = await security(['delete-generic-password', ...this.args(context)]);
    if (result.code !== 0 && result.code !== 44)
      throw new PersonalMcpAuthError('personal_session_store_unavailable');
  }
}

export const persistPersonalSession = async (
  context: PersonalMcpContext,
  session: import('./personal-auth-callback.js').PersonalSession,
  store?: PersonalSessionStore
): Promise<void> => {
  if (!store) return;
  if (!session.refreshToken) {
    await store.delete(context);
    return;
  }
  await store.save(context, {
    version: 1,
    binding: personalSessionBinding(context),
    subject: session.subject,
    account: session.account,
    refreshToken: session.refreshToken,
  });
};
