import type { ExternalContentReference } from '@sva/auth-runtime/server';

import type { SvaMainserverProjectInput } from '../types.js';
import type { MainserverMutationActor } from './mutation-principal.js';
import type { projectActorInfoOrResponse } from './projects-route-authorization.js';

export type ProjectCreateActorInfo = Exclude<
  Awaited<ReturnType<typeof projectActorInfoOrResponse>>,
  Response
>;

export type ProjectCreateReference = ExternalContentReference;

export type ProjectCreateContext = Readonly<{
  actor: MainserverMutationActor;
  actorInfo: ProjectCreateActorInfo;
  idempotencyKey: string;
  payloadHash: string;
  project: SvaMainserverProjectInput;
}>;

export type ProjectCreateState = { reference?: ProjectCreateReference };
