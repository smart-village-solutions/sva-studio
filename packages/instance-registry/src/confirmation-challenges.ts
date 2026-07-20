import { createHash } from 'node:crypto';

import type { InstanceRegistryRepository } from '@sva/data-repositories';

const PHRASE_HASH_DOMAIN = 'sva-instance-confirmation-v1\0';

export type PrepareInstanceConfirmationChallengeInput = {
  readonly instanceId: string;
  readonly actorId: string;
  readonly actionId: string;
  readonly moduleId?: string;
  readonly stateFingerprint: string;
  readonly confirmationPhrase: string;
  readonly expiresAt: string;
  readonly requestId?: string;
};

export type InstanceConfirmationChallenge = {
  readonly challengeId: string;
  readonly instanceId: string;
  readonly actionId: string;
  readonly moduleId?: string;
  readonly stateFingerprint: string;
  readonly expiresAt: string;
  readonly requestId?: string;
  readonly createdAt: string;
};

export type ConsumeInstanceConfirmationChallengeInput = Omit<
  PrepareInstanceConfirmationChallengeInput,
  'expiresAt' | 'requestId'
> & { readonly challengeId: string };

export const hashInstanceConfirmationPhrase = (phrase: string): string =>
  createHash('sha256').update(PHRASE_HASH_DOMAIN).update(phrase, 'utf8').digest('hex');

export const createPrepareInstanceConfirmationChallenge = (repository: InstanceRegistryRepository) =>
  async (input: PrepareInstanceConfirmationChallengeInput): Promise<InstanceConfirmationChallenge> => {
    const record = await repository.prepareConfirmationChallenge({
      instanceId: input.instanceId,
      actorId: input.actorId,
      actionId: input.actionId,
      ...(input.moduleId ? { moduleId: input.moduleId } : {}),
      stateFingerprint: input.stateFingerprint,
      phraseHash: hashInstanceConfirmationPhrase(input.confirmationPhrase),
      expiresAt: input.expiresAt,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    });
    return {
      challengeId: record.challengeId,
      instanceId: record.instanceId,
      actionId: record.actionId,
      ...(record.moduleId ? { moduleId: record.moduleId } : {}),
      stateFingerprint: record.stateFingerprint,
      expiresAt: record.expiresAt,
      ...(record.requestId ? { requestId: record.requestId } : {}),
      createdAt: record.createdAt,
    };
  };

export const createConsumeInstanceConfirmationChallenge = (repository: InstanceRegistryRepository) =>
  (input: ConsumeInstanceConfirmationChallengeInput): Promise<boolean> =>
    repository.consumeConfirmationChallenge({
      challengeId: input.challengeId,
      instanceId: input.instanceId,
      actorId: input.actorId,
      actionId: input.actionId,
      ...(input.moduleId ? { moduleId: input.moduleId } : {}),
      stateFingerprint: input.stateFingerprint,
      phraseHash: hashInstanceConfirmationPhrase(input.confirmationPhrase),
    });
