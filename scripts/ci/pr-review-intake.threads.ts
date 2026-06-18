import { runGhJson } from './pr-review-intake.gh.js';
import type { GhExecutor, PullRequestRef, ReviewThreadCollection, ReviewThreadSummary } from './pr-review-intake.types.js';

interface GraphqlReviewThreadsPayload {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          nodes: Array<{
            id: string;
            isResolved: boolean;
            isOutdated: boolean;
            path: string;
            line: number | null;
            originalLine: number | null;
            comments: {
              nodes: Array<{
                id: string;
                body: string;
                createdAt: string;
                url: string;
                author: { login: string | null } | null;
              }>;
            };
          }>;
        } | null;
      } | null;
    } | null;
  };
  errors?: unknown;
}

const THREADS_QUERY = `query($owner:String!,$repo:String!,$number:Int!,$cursor:String){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      reviewThreads(first:100,after:$cursor){
        pageInfo{hasNextPage endCursor}
        nodes{
          id
          isResolved
          isOutdated
          path
          line
          originalLine
          comments(first:100){
            nodes{
              id
              body
              createdAt
              url
              author{login}
            }
          }
        }
      }
    }
  }
}`;

const normalizeReviewThread = (
  thread: NonNullable<
    NonNullable<NonNullable<NonNullable<GraphqlReviewThreadsPayload['data']>['repository']>['pullRequest']>['reviewThreads']
  >['nodes'][number]
): ReviewThreadSummary => {
  const comments = thread.comments.nodes.map((comment) => ({
    id: comment.id,
    authorLogin: comment.author?.login ?? 'unknown',
    body: comment.body,
    createdAt: comment.createdAt,
    url: comment.url,
  }));

  return {
    id: thread.id,
    url: comments[0]?.url ?? '',
    isResolved: thread.isResolved,
    isOutdated: thread.isOutdated,
    path: thread.path,
    line: thread.line ?? null,
    originalLine: thread.originalLine ?? null,
    commentCount: comments.length,
    rootComment: comments[0] ?? null,
    latestComment: comments.at(-1) ?? null,
    comments,
  };
};

export const fetchReviewThreads = (ref: PullRequestRef, executor: GhExecutor): ReviewThreadCollection => {
  const open: ReviewThreadSummary[] = [];
  const resolved: ReviewThreadSummary[] = [];
  let cursor: string | null = null;

  while (true) {
    const args = [
      'api',
      'graphql',
      '-f',
      `query=${THREADS_QUERY}`,
      '-F',
      `owner=${ref.owner}`,
      '-F',
      `repo=${ref.repo}`,
      '-F',
      `number=${ref.number}`,
    ];
    if (cursor) {
      args.push('-F', `cursor=${cursor}`);
    }

    const payload = runGhJson<GraphqlReviewThreadsPayload>(executor, args);
    if (payload.errors) {
      throw new Error(`GitHub GraphQL meldet Fehler: ${JSON.stringify(payload.errors)}`);
    }

    const connection = payload.data?.repository?.pullRequest?.reviewThreads;
    if (!connection) {
      throw new Error(`Review-Threads konnten für PR #${ref.number} nicht geladen werden.`);
    }

    for (const node of connection.nodes) {
      const normalized = normalizeReviewThread(node);
      (normalized.isResolved ? resolved : open).push(normalized);
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break;
    }
    cursor = connection.pageInfo.endCursor;
  }

  return { open, resolved };
};
