#!/usr/bin/env node

import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export type BotCommentStatus = 'accepted' | 'rejected' | 'resolved';

export interface ParsedBotCommentMarker {
  status: BotCommentStatus;
  botCommentId?: number;
  explanation: string;
}

export interface IssueCommentRecord {
  id: number;
  authorLogin: string;
  authorAssociation: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface ReviewThreadCommentRecord {
  id: string;
  databaseId: number;
  authorLogin: string;
  authorAssociation: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface ReviewThreadRecord {
  id: string;
  isResolved: boolean;
  url: string;
  comments: readonly ReviewThreadCommentRecord[];
}

export interface OpenBotCommentRecord {
  source: 'issue-comment' | 'review-thread';
  botCommentId: number | string;
  url: string;
  reason: string;
}

export interface HandledBotCommentRecord {
  source: 'issue-comment' | 'review-thread';
  botCommentId: number | string;
  url: string;
  status: BotCommentStatus;
}

export interface BotCommentEvaluationResult {
  handled: readonly HandledBotCommentRecord[];
  open: readonly OpenBotCommentRecord[];
}

export interface PullRequestContext {
  owner: string;
  repo: string;
  pullNumber: number;
}

const BOT_AUTHORS = new Set(['Copilot', 'chatgpt-codex-connector[bot]']);
const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const MARKER_REGEX = /<!--\s*bot-comment-status:\s*(accepted|rejected|resolved)(?:\s*;\s*bot-comment-id:\s*(\d+))?\s*-->/i;

export const parseBotCommentMarker = (body: string): ParsedBotCommentMarker | null => {
  const match = MARKER_REGEX.exec(body);
  if (!match) {
    return null;
  }

  const explanation = body.replace(match[0], '').trim();
  if (explanation.length === 0) {
    return null;
  }

  return {
    status: match[1].toLowerCase() as BotCommentStatus,
    botCommentId: match[2] ? Number(match[2]) : undefined,
    explanation,
  };
};

const isBotAuthor = (authorLogin: string): boolean => BOT_AUTHORS.has(authorLogin);

const isMaintainerAssociation = (authorAssociation: string): boolean => MAINTAINER_ASSOCIATIONS.has(authorAssociation);

export const evaluateBotCommentHandling = (input: {
  issueComments: readonly IssueCommentRecord[];
  reviewThreads: readonly ReviewThreadRecord[];
}): BotCommentEvaluationResult => {
  const issueResult = evaluateIssueComments(input.issueComments);
  const threadResult = evaluateReviewThreads(input.reviewThreads);

  return {
    handled: [...issueResult.handled, ...threadResult.handled],
    open: [...issueResult.open, ...threadResult.open],
  };
};

export const evaluateIssueComments = (comments: readonly IssueCommentRecord[]): BotCommentEvaluationResult => {
  const handled: HandledBotCommentRecord[] = [];
  const open: OpenBotCommentRecord[] = [];

  for (const comment of comments) {
    if (!isBotAuthor(comment.authorLogin)) {
      continue;
    }

    const matchingReply = comments.find((candidate) => {
      if (candidate.id === comment.id) {
        return false;
      }
      if (new Date(candidate.createdAt).getTime() < new Date(comment.createdAt).getTime()) {
        return false;
      }
      if (!isMaintainerAssociation(candidate.authorAssociation)) {
        return false;
      }

      const marker = parseBotCommentMarker(candidate.body);
      return marker?.botCommentId === comment.id;
    });

    if (!matchingReply) {
      open.push({
        source: 'issue-comment',
        botCommentId: comment.id,
        url: comment.url,
        reason: 'Es fehlt eine qualifizierte Antwort mit standardisiertem Marker und passender bot-comment-id.',
      });
      continue;
    }

    handled.push({
      source: 'issue-comment',
      botCommentId: comment.id,
      url: comment.url,
      status: parseBotCommentMarker(matchingReply.body)!.status,
    });
  }

  return { handled, open };
};

export const evaluateReviewThreads = (threads: readonly ReviewThreadRecord[]): BotCommentEvaluationResult => {
  const handled: HandledBotCommentRecord[] = [];
  const open: OpenBotCommentRecord[] = [];

  for (const thread of threads) {
    const rootComment = thread.comments[0];
    if (!rootComment || !isBotAuthor(rootComment.authorLogin)) {
      continue;
    }

    const maintainerReply = thread.comments.find((comment) => {
      if (comment.id === rootComment.id) {
        return false;
      }
      if (!isMaintainerAssociation(comment.authorAssociation)) {
        return false;
      }
      return parseBotCommentMarker(comment.body) !== null;
    });

    if (!maintainerReply) {
      open.push({
        source: 'review-thread',
        botCommentId: rootComment.databaseId,
        url: thread.url,
        reason: 'Es fehlt eine Maintainer-Antwort mit standardisiertem Marker im Review-Thread.',
      });
      continue;
    }

    if (!thread.isResolved) {
      open.push({
        source: 'review-thread',
        botCommentId: rootComment.databaseId,
        url: thread.url,
        reason: 'Der Review-Thread hat zwar einen Marker, ist aber noch nicht resolved.',
      });
      continue;
    }

    handled.push({
      source: 'review-thread',
      botCommentId: rootComment.databaseId,
      url: thread.url,
      status: parseBotCommentMarker(maintainerReply.body)!.status,
    });
  }

  return { handled, open };
};

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
};

export const derivePullRequestContext = (payload: unknown, repository: string): PullRequestContext => {
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  const event = payload as {
    pull_request?: { number?: number };
    issue?: { number?: number; pull_request?: object | null };
  };

  const pullNumber = event.pull_request?.number ?? (event.issue?.pull_request ? event.issue.number : undefined);
  if (!pullNumber) {
    throw new Error('Event payload does not reference a pull request.');
  }

  return { owner, repo, pullNumber };
};

const githubRequest = async <T>(input: {
  token: string;
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<T> => {
  const response = await fetch(input.url, {
    method: input.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.token}`,
      'User-Agent': 'sva-studio-bot-comment-gate',
      ...(input.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status} ${response.statusText}) for ${input.url}`);
  }

  return (await response.json()) as T;
};

const githubGraphqlRequest = async <T>(input: {
  token: string;
  query: string;
  variables: Record<string, unknown>;
}): Promise<T> => {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'sva-studio-bot-comment-gate',
    },
    body: JSON.stringify({
      query: input.query,
      variables: input.variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed (${response.status} ${response.statusText})`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(`GitHub GraphQL request failed: ${payload.errors.map((error) => error.message ?? 'unknown').join('; ')}`);
  }

  if (!payload.data) {
    throw new Error('GitHub GraphQL request returned no data.');
  }

  return payload.data;
};

export const fetchIssueComments = async (input: PullRequestContext & { token: string }): Promise<IssueCommentRecord[]> => {
  const comments: IssueCommentRecord[] = [];

  for (let page = 1; ; page += 1) {
    const pageComments = await githubRequest<
      Array<{
        id: number;
        body?: string | null;
        created_at?: string;
        html_url?: string;
        author_association?: string;
        user?: { login?: string | null };
      }>
    >({
      token: input.token,
      url: `https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.pullNumber}/comments?per_page=100&page=${page}`,
    });

    comments.push(
      ...pageComments.map((comment) => ({
        id: comment.id,
        authorLogin: comment.user?.login ?? 'unknown',
        authorAssociation: comment.author_association ?? 'NONE',
        body: comment.body ?? '',
        createdAt: comment.created_at ?? '',
        url: comment.html_url ?? `https://github.com/${input.owner}/${input.repo}/pull/${input.pullNumber}`,
      }))
    );

    if (pageComments.length < 100) {
      break;
    }
  }

  return comments;
};

export const fetchReviewThreads = async (input: PullRequestContext & { token: string }): Promise<ReviewThreadRecord[]> => {
  const query = `
    query BotCommentHandlingThreads($owner: String!, $repo: String!, $pullNumber: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pullNumber) {
          reviewThreads(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              isResolved
              comments(first: 100) {
                nodes {
                  id
                  databaseId
                  body
                  createdAt
                  url
                  authorAssociation
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const threads: ReviewThreadRecord[] = [];
  let after: string | null = null;

  for (;;) {
    const data = await githubGraphqlRequest<{
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
            nodes: Array<{
              id: string;
              isResolved: boolean;
              comments: {
                nodes: Array<{
                  id: string;
                  databaseId: number;
                  body: string;
                  createdAt: string;
                  url: string;
                  authorAssociation: string;
                  author: { login: string | null } | null;
                }>;
              };
            }>;
          };
        } | null;
      } | null;
    }>({
      token: input.token,
      query,
      variables: {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
        after,
      },
    });

    const reviewThreads = data.repository?.pullRequest?.reviewThreads;
    if (!reviewThreads) {
      return [];
    }

    threads.push(
      ...reviewThreads.nodes.map((thread) => ({
        id: thread.id,
        isResolved: thread.isResolved,
        url:
          thread.comments.nodes[0]?.url ??
          `https://github.com/${input.owner}/${input.repo}/pull/${input.pullNumber}/files`,
        comments: thread.comments.nodes.map((comment) => ({
          id: comment.id,
          databaseId: comment.databaseId,
          authorLogin: comment.author?.login ?? 'unknown',
          authorAssociation: comment.authorAssociation,
          body: comment.body,
          createdAt: comment.createdAt,
          url: comment.url,
        })),
      }))
    );

    if (!reviewThreads.pageInfo.hasNextPage || !reviewThreads.pageInfo.endCursor) {
      return threads;
    }

    after = reviewThreads.pageInfo.endCursor;
  }
};

export const formatEvaluationSummary = (result: BotCommentEvaluationResult): string => {
  const lines = [
    '## Bot-Kommentar-Gate',
    '',
    `- Bearbeitet: ${result.handled.length}`,
    `- Offen: ${result.open.length}`,
  ];

  if (result.open.length === 0) {
    lines.push('', 'Alle relevanten Bot-Kommentare haben einen gültigen Bearbeitungsnachweis.');
    return lines.join('\n');
  }

  lines.push('', 'Offene Bot-Kommentare:');
  for (const entry of result.open) {
    lines.push(`- ${entry.source} ${entry.botCommentId}: ${entry.reason} (${entry.url})`);
  }

  lines.push(
    '',
    'Erlaubte Marker:',
    '- `<!-- bot-comment-status: accepted -->` im resolved Review-Thread',
    '- `<!-- bot-comment-status: rejected -->` im resolved Review-Thread mit Begründung',
    '- `<!-- bot-comment-status: resolved -->` im resolved Review-Thread mit Begründung',
    '- `<!-- bot-comment-status: <status>; bot-comment-id: <id> -->` in einer Maintainer-Antwort auf normale PR-Kommentare'
  );

  return lines.join('\n');
};

const writeStepSummary = async (summary: string): Promise<void> => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  await appendFile(summaryPath, `${summary}\n`);
};

export const run = async (): Promise<void> => {
  const token = readRequiredEnv('GITHUB_TOKEN');
  const repository = readRequiredEnv('GITHUB_REPOSITORY');
  const eventPath = readRequiredEnv('GITHUB_EVENT_PATH');
  const payloadText = await readFile(eventPath, 'utf8');
  const payload = JSON.parse(payloadText) as unknown;
  const context = derivePullRequestContext(payload, repository);
  const [issueComments, reviewThreads] = await Promise.all([
    fetchIssueComments({ token, ...context }),
    fetchReviewThreads({ token, ...context }),
  ]);
  const result = evaluateBotCommentHandling({ issueComments, reviewThreads });
  const summary = formatEvaluationSummary(result);

  console.log(summary);
  await writeStepSummary(summary);

  if (result.open.length > 0) {
    throw new Error(`Found ${result.open.length} open bot comment(s).`);
  }
};

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (isMainModule) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
