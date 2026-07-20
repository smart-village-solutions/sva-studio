import { describe, expect, it, vi } from 'vitest';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import {
  createConsumeInstanceConfirmationChallenge,
  createPrepareInstanceConfirmationChallenge,
  hashInstanceConfirmationPhrase,
} from './confirmation-challenges.js';

describe('instance confirmation challenges', () => {
  it('hashes phrases deterministically with a domain-separated SHA-256 digest', () => {
    expect(hashInstanceConfirmationPhrase('ARCHIVE demo')).toMatch(/^[0-9a-f]{64}$/u);
    expect(hashInstanceConfirmationPhrase('ARCHIVE demo')).toBe(hashInstanceConfirmationPhrase('ARCHIVE demo'));
    expect(hashInstanceConfirmationPhrase('ARCHIVE demo')).not.toBe(hashInstanceConfirmationPhrase('ARCHIVE other'));
  });

  it('prepares a challenge without forwarding the plaintext phrase', async () => {
    const prepareConfirmationChallenge = vi.fn(async (input) => ({
      challengeId: 'challenge-1',
      ...input,
      createdAt: '2026-07-13T10:00:00.000Z',
    }));
    const prepare = createPrepareInstanceConfirmationChallenge({
      prepareConfirmationChallenge,
    } as unknown as InstanceRegistryRepository);

    const result = await prepare({
      instanceId: 'demo',
      actorId: 'service-account-sva-studio-mcp',
      actionId: 'instance.status.archive',
      stateFingerprint: 'state-v1',
      confirmationPhrase: 'ARCHIVE demo',
      expiresAt: '2026-07-13T10:05:00.000Z',
      requestId: 'req-1',
    });

    expect(prepareConfirmationChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ phraseHash: expect.stringMatching(/^[0-9a-f]{64}$/u) })
    );
    expect(prepareConfirmationChallenge.mock.calls[0]?.[0]).not.toHaveProperty('confirmationPhrase');
    expect(result).not.toHaveProperty('actorId');
    expect(result).not.toHaveProperty('phraseHash');
  });

  it('preserves an optional module binding without exposing the phrase hash', async () => {
    const prepareConfirmationChallenge = vi.fn(async (input) => ({
      challengeId: 'challenge-module-1',
      ...input,
      createdAt: '2026-07-13T10:00:00.000Z',
    }));
    const prepare = createPrepareInstanceConfirmationChallenge({
      prepareConfirmationChallenge,
    } as unknown as InstanceRegistryRepository);

    const result = await prepare({
      instanceId: 'demo',
      actorId: 'actor-1',
      actionId: 'instance.module.revoke',
      moduleId: 'events',
      stateFingerprint: 'state-v1',
      confirmationPhrase: 'REVOKE events FROM demo',
      expiresAt: '2026-07-13T10:05:00.000Z',
    });

    expect(prepareConfirmationChallenge).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'events' }));
    expect(result).toMatchObject({ moduleId: 'events' });
    expect(result).not.toHaveProperty('phraseHash');
  });

  it('binds atomic consumption to actor, action, instance, state and phrase hash', async () => {
    const consumeConfirmationChallenge = vi.fn(async () => true);
    const consume = createConsumeInstanceConfirmationChallenge({
      consumeConfirmationChallenge,
    } as unknown as InstanceRegistryRepository);

    await expect(
      consume({
        challengeId: 'challenge-1',
        instanceId: 'demo',
        actorId: 'actor-1',
        actionId: 'instance.status.archive',
        stateFingerprint: 'state-v1',
        confirmationPhrase: 'ARCHIVE demo',
      })
    ).resolves.toBe(true);
    expect(consumeConfirmationChallenge).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      instanceId: 'demo',
      actorId: 'actor-1',
      actionId: 'instance.status.archive',
      stateFingerprint: 'state-v1',
      phraseHash: hashInstanceConfirmationPhrase('ARCHIVE demo'),
    });
  });
});
