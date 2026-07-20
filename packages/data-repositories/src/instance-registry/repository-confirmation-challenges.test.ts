import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor } from './test-support.js';

const challengeRow = {
  id: '4dc33447-ff8d-4ac6-a2d7-06a57332b9d8',
  instance_id: 'demo',
  actor_id: 'actor-1',
  action_id: 'instance.status.archive',
  module_id: null,
  state_fingerprint: 'state-v1',
  phrase_hash: 'a'.repeat(64),
  expires_at: '2026-07-13T10:05:00.000Z',
  consumed_at: null,
  request_id: 'req-1',
  created_at: '2026-07-13T10:00:00.000Z',
};

describe('instance confirmation challenge repository', () => {
  it('stores only the phrase hash and returns a safe challenge projection', async () => {
    const { executor, statements } = createQueuedExecutor([[challengeRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.prepareConfirmationChallenge({
        instanceId: 'demo',
        actorId: 'actor-1',
        actionId: 'instance.status.archive',
        stateFingerprint: 'state-v1',
        phraseHash: 'a'.repeat(64),
        expiresAt: '2026-07-13T10:05:00.000Z',
        requestId: 'req-1',
      })
    ).resolves.toEqual({
      challengeId: challengeRow.id,
      instanceId: 'demo',
      actorId: 'actor-1',
      actionId: 'instance.status.archive',
      stateFingerprint: 'state-v1',
      expiresAt: '2026-07-13T10:05:00.000Z',
      requestId: 'req-1',
      createdAt: '2026-07-13T10:00:00.000Z',
    });
    expect(statements[0]?.values).toContain('a'.repeat(64));
    expect(statements[0]?.values).not.toContain('ARCHIVE demo');
    expect(statements[0]?.text).not.toContain('confirmation_phrase');
  });

  it('consumes exactly once with every security binding in one update', async () => {
    const { executor, statements } = createQueuedExecutor([[{ id: challengeRow.id }], []]);
    const repository = createInstanceRegistryRepository(executor);
    const input = {
      challengeId: challengeRow.id,
      instanceId: 'demo',
      actorId: 'actor-1',
      actionId: 'instance.status.archive',
      stateFingerprint: 'state-v1',
      phraseHash: 'a'.repeat(64),
    };

    await expect(repository.consumeConfirmationChallenge(input)).resolves.toBe(true);
    await expect(repository.consumeConfirmationChallenge(input)).resolves.toBe(false);
    expect(statements[0]?.text).toContain('consumed_at IS NULL');
    expect(statements[0]?.text).toContain('expires_at > NOW()');
    expect(statements[0]?.text).toContain('actor_id = $3');
    expect(statements[0]?.text).toContain('action_id = $4');
    expect(statements[0]?.text).toContain('module_id IS NOT DISTINCT FROM $5');
    expect(statements[0]?.text).toContain('state_fingerprint = $6');
    expect(statements[0]?.text).toContain('phrase_hash = $7');
    expect(statements[0]?.values?.[4]).toBeNull();
  });

  it('rejects a challenge consumed for a different module', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.consumeConfirmationChallenge({
        challengeId: challengeRow.id,
        instanceId: 'demo',
        actorId: 'actor-1',
        actionId: 'instance.module.revoke',
        moduleId: 'events',
        stateFingerprint: 'state-v1',
        phraseHash: 'a'.repeat(64),
      })
    ).resolves.toBe(false);
    expect(statements[0]?.values?.[4]).toBe('events');
    expect(statements[0]?.text).toContain('module_id IS NOT DISTINCT FROM $5');
  });
});
