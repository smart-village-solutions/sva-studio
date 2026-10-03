import { Pool } from 'pg';
import { createWasteEmailReminderRepository } from '@sva/waste-management-runtime/repositories';
import type { WasteEmailReminderPendingSignupInput } from '@sva/waste-management-runtime/repositories';
import {
  createPublicWasteReminderPageHandler,
  createPublicWasteReminderSignupRateLimitConsumer,
  createPublicWasteReminderSignupSubmitter,
} from './public-waste-email-reminders.server.js';
import type {
  RepositoryHandle,
  PublicWasteReminderSignupSubmitter,
  PublicWasteReminderPageHandler,
} from './public-waste-runtime.js';

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (value: string): string => {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`invalid_waste_schema:${value}`);
  }
  return `"${value}"`;
};

const persistPendingSignup = async (
  repositoryHandle: RepositoryHandle,
  signup: WasteEmailReminderPendingSignupInput
): Promise<void> => {
  const client = await repositoryHandle.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SET LOCAL search_path TO ${quoteIdentifier(repositoryHandle.schemaName)}, public`
    );
    const repository = createWasteEmailReminderRepository({
      execute: async <TRow = Record<string, unknown>>(statement: {
        readonly text: string;
        readonly values?: readonly unknown[];
      }) => {
        const result = await client.query(
          statement.text,
          statement.values ? [...statement.values] : undefined
        );
        return {
          rowCount: result.rowCount ?? 0,
          rows: result.rows as readonly TRow[],
        };
      },
    });
    await repository.createPendingSignup(signup);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const persistPendingSignupWithLimitCheck = async (
  repositoryHandle: RepositoryHandle,
  {
    signup,
    maxSubscriptionsPerEmailAndLocation,
  }: {
    readonly signup: WasteEmailReminderPendingSignupInput;
    readonly maxSubscriptionsPerEmailAndLocation: number;
  }
): Promise<'created' | 'subscription_limit_reached'> => {
  const client = await repositoryHandle.pool.connect();
  let transactionFinished = false;
  try {
    await client.query('BEGIN');
    await client.query(
      `SET LOCAL search_path TO ${quoteIdentifier(repositoryHandle.schemaName)}, public`
    );
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      signup.emailHash,
      JSON.stringify([
        signup.selection.regionId ?? null,
        signup.selection.cityId,
        signup.selection.streetId,
        signup.selection.houseNumberId ?? null,
      ]),
    ]);
    const repository = createWasteEmailReminderRepository({
      execute: async <TRow = Record<string, unknown>>(statement: {
        readonly text: string;
        readonly values?: readonly unknown[];
      }) => {
        const result = await client.query(
          statement.text,
          statement.values ? [...statement.values] : undefined
        );
        return {
          rowCount: result.rowCount ?? 0,
          rows: result.rows as readonly TRow[],
        };
      },
    });
    const existingCount = await repository.countSubscriptionsForEmailLocation({
      emailHash: signup.emailHash,
      selection: signup.selection,
    });
    if (existingCount >= maxSubscriptionsPerEmailAndLocation) {
      await client.query('ROLLBACK');
      transactionFinished = true;
      return 'subscription_limit_reached';
    }
    await repository.createPendingSignup(signup);
    await client.query('COMMIT');
    transactionFinished = true;
    return 'created';
  } catch (error) {
    if (!transactionFinished) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
};

export const createDefaultReminderSignupSubmitter = (input: {
  readonly repositoryHandle: RepositoryHandle;
}): PublicWasteReminderSignupSubmitter => {
  const consumeRateLimit = createPublicWasteReminderSignupRateLimitConsumer();
  return createPublicWasteReminderSignupSubmitter({
    consumeRateLimit,
    persistPendingSignup: async (signup) =>
      await persistPendingSignup(input.repositoryHandle, signup),
    persistPendingSignupWithLimitCheck: async (signupInput) =>
      await persistPendingSignupWithLimitCheck(input.repositoryHandle, signupInput),
  });
};

const createReminderRepositoryExecutor = (input: {
  readonly pool: Pool;
  readonly schemaName: string;
}) => ({
  async executeWithinTransaction<TResult>(
    callback: (
      repository: ReturnType<typeof createWasteEmailReminderRepository>
    ) => Promise<TResult>
  ): Promise<TResult> {
    const client = await input.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${quoteIdentifier(input.schemaName)}, public`);
      const repository = createWasteEmailReminderRepository({
        execute: async <TRow = Record<string, unknown>>(statement: {
          readonly text: string;
          readonly values?: readonly unknown[];
        }) => {
          const result = await client.query(
            statement.text,
            statement.values ? [...statement.values] : undefined
          );
          return {
            rowCount: result.rowCount ?? 0,
            rows: result.rows as readonly TRow[],
          };
        },
      });
      const result = await callback(repository);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
});

export const createDefaultReminderPageHandler = (input: {
  readonly repositoryHandle: RepositoryHandle;
}): PublicWasteReminderPageHandler => {
  const executor = createReminderRepositoryExecutor({
    pool: input.repositoryHandle.pool,
    schemaName: input.repositoryHandle.schemaName,
  });
  return createPublicWasteReminderPageHandler({
    activateByDoiTokenHash: async (payload) =>
      await executor.executeWithinTransaction(
        async (repository) => await repository.activateByDoiTokenHash(payload)
      ),
    loadUnsubscribeSubscriptionById: async (payload) =>
      await executor.executeWithinTransaction(
        async (repository) => await repository.loadUnsubscribeSubscriptionById(payload)
      ),
    unsubscribeByTokenHash: async (payload) =>
      await executor.executeWithinTransaction(
        async (repository) => await repository.unsubscribeByTokenHash(payload)
      ),
  });
};
