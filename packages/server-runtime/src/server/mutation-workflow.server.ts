type MaybePromise<T> = T | Promise<T>;

type MutationBaseState<TContext> = {
  readonly request: Request;
  readonly context: TContext;
};

type EmptyState = Record<never, never>;

type MutationStepResult<TAdded extends object> = keyof TAdded extends never ? TAdded | Response | void : TAdded | Response;

type MutationStep<TState extends object, TAdded extends object> = (
  state: Readonly<TState>
) => MaybePromise<MutationStepResult<TAdded>>;

type MutationParseStep<TState extends object, TInput> = (state: Readonly<TState>) => MaybePromise<TInput | Response>;

type MutationExecuteStep<TState extends object, TInput, TResult> = (
  state: Readonly<TState & { readonly input: TInput }>
) => MaybePromise<TResult>;

type MutationRespondStep<TState extends object, TResult> = (result: TResult, state: Readonly<TState>) => Response;

type MutationErrorMapper<TState extends object> = (error: unknown, state: Readonly<TState>) => Response;

export type MutationWorkflowContext<TContext> = MutationBaseState<TContext>;
export type PreparedMutation<TContext, TPrepared extends object> = MutationBaseState<TContext> & TPrepared;
export type AuthorizedMutation<TContext, TPrepared extends object, TAuthorized extends object> = PreparedMutation<
  TContext,
  TPrepared & TAuthorized
>;
export type IdempotentMutation<
  TContext,
  TPrepared extends object,
  TAuthorized extends object,
  TIdempotency extends object,
> = AuthorizedMutation<TContext, TPrepared, TAuthorized & TIdempotency>;
export type ParsedMutation<TState extends object, TInput> = TState & { readonly input: TInput };
export type MutationExecutionResult<TResult> = TResult;

export type MutationWorkflowDefinition<
  TContext,
  TPrepared extends object,
  TAuthorized extends object,
  TIdempotency extends object,
  TInput,
  TResult,
> = {
  readonly prepare: MutationStep<MutationBaseState<TContext>, TPrepared>;
  readonly csrf?: MutationStep<PreparedMutation<TContext, TPrepared>, EmptyState>;
  readonly authorize: MutationStep<PreparedMutation<TContext, TPrepared>, TAuthorized>;
  readonly idempotency?: MutationStep<PreparedMutation<TContext, TPrepared & TAuthorized>, TIdempotency>;
  readonly parse: MutationParseStep<PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>, TInput>;
  readonly execute: MutationExecuteStep<PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>, TInput, TResult>;
  readonly mapError: MutationErrorMapper<PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>>;
  readonly respond: MutationRespondStep<PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>, TResult>;
};

const isResponse = (value: unknown): value is Response => value instanceof Response;

const mergeStepState = <TState extends object, TAdded extends object | void>(
  state: TState,
  addition: TAdded
): TState & (TAdded extends object ? TAdded : EmptyState) =>
  (addition && typeof addition === 'object'
    ? { ...state, ...addition }
    : state) as TState & (TAdded extends object ? TAdded : EmptyState);

export const createMutationWorkflow = <
  TContext,
  TPrepared extends object,
  TAuthorized extends object = EmptyState,
  TIdempotency extends object = EmptyState,
  TInput = void,
  TResult = Response,
>(
  definition: MutationWorkflowDefinition<TContext, TPrepared, TAuthorized, TIdempotency, TInput, TResult>
) => {
  return async (request: Request, context: TContext): Promise<Response> => {
    const initialState: MutationBaseState<TContext> = { request, context };
    let currentState = initialState as PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>;

    try {
      const prepared = await definition.prepare(initialState);
      if (isResponse(prepared)) {
        return prepared;
      }

      currentState = mergeStepState(initialState, prepared) as PreparedMutation<
        TContext,
        TPrepared & TAuthorized & TIdempotency
      >;
      const preparedState = currentState as PreparedMutation<TContext, TPrepared>;
      const csrfResult = definition.csrf ? await definition.csrf(preparedState) : undefined;
      if (isResponse(csrfResult)) {
        return csrfResult;
      }

      const csrfState = mergeStepState(preparedState, csrfResult) as PreparedMutation<TContext, TPrepared>;
      currentState = csrfState as PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>;
      const authorized = await definition.authorize(csrfState);
      if (isResponse(authorized)) {
        return authorized;
      }

      const authorizedState = mergeStepState(csrfState, authorized) as PreparedMutation<
        TContext,
        TPrepared & TAuthorized
      >;
      currentState = authorizedState as PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>;
      const idempotencyResult = definition.idempotency ? await definition.idempotency(authorizedState) : undefined;
      if (isResponse(idempotencyResult)) {
        return idempotencyResult;
      }

      const idempotentState = mergeStepState(authorizedState, idempotencyResult) as PreparedMutation<
        TContext,
        TPrepared & TAuthorized & TIdempotency
      >;
      currentState = idempotentState;
      const parsed = await definition.parse(idempotentState);
      if (isResponse(parsed)) {
        return parsed;
      }

      const parsedState = {
        ...idempotentState,
        input: parsed,
      } as ParsedMutation<PreparedMutation<TContext, TPrepared & TAuthorized & TIdempotency>, TInput>;
      const result = await definition.execute(parsedState);
      return definition.respond(result, idempotentState);
    } catch (error) {
      return definition.mapError(error, currentState);
    }
  };
};
