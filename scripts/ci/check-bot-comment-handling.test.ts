import { expect, it } from 'vitest';

import {
  evaluateIssueComments,
  evaluateReviewThreads,
  parseBotCommentMarker,
  type IssueCommentRecord,
  type ReviewThreadRecord,
} from './check-bot-comment-handling.ts';

it('parseBotCommentMarker extracts status, optional comment id, and explanation', () => {
  const marker = parseBotCommentMarker(
    '<!-- bot-comment-status: rejected; bot-comment-id: 123 -->\nNicht umgesetzt, weil der Hinweis den Host-Vertrag verletzen würde.'
  );

  expect(marker).toEqual({
    status: 'rejected',
    botCommentId: 123,
    explanation: 'Nicht umgesetzt, weil der Hinweis den Host-Vertrag verletzen würde.',
  });
});

it('evaluateIssueComments marks bot conversation comments without a qualifying reply as open', () => {
  const comments: IssueCommentRecord[] = [
    {
      id: 10,
      authorLogin: 'Copilot',
      authorAssociation: 'NONE',
      body: 'Bitte noch einen Regressionstest ergänzen.',
      createdAt: '2026-05-03T10:00:00Z',
      url: 'https://example.test/pr#issuecomment-10',
    },
  ];

  const result = evaluateIssueComments(comments);

  expect(result.handled).toHaveLength(0);
  expect(result.open).toHaveLength(1);
  expect(result.open[0]?.reason ?? '').toMatch(/qualifizierte Antwort/);
});

it('evaluateIssueComments accepts a maintainer reply with marker and matching bot comment id', () => {
  const comments: IssueCommentRecord[] = [
    {
      id: 10,
      authorLogin: 'chatgpt-codex-connector[bot]',
      authorAssociation: 'NONE',
      body: 'Kannst du den Fehlercode präziser machen?',
      createdAt: '2026-05-03T10:00:00Z',
      url: 'https://example.test/pr#issuecomment-10',
    },
    {
      id: 11,
      authorLogin: 'maintainer',
      authorAssociation: 'MEMBER',
      body: '<!-- bot-comment-status: accepted; bot-comment-id: 10 -->\nFehlercode ist jetzt fachlich präziser modelliert.',
      createdAt: '2026-05-03T10:05:00Z',
      url: 'https://example.test/pr#issuecomment-11',
    },
  ];

  const result = evaluateIssueComments(comments);

  expect(result.open).toHaveLength(0);
  expect(result.handled).toHaveLength(1);
  expect(result.handled[0]?.status).toBe('accepted');
});

it('evaluateReviewThreads requires both a maintainer marker reply and a resolved thread', () => {
  const threads: ReviewThreadRecord[] = [
    {
      id: 'thread-1',
      isResolved: false,
      url: 'https://example.test/pr/files#thread-1',
      comments: [
        {
          id: 'comment-1',
          databaseId: 101,
          authorLogin: 'Copilot',
          authorAssociation: 'NONE',
          body: 'Bitte den Pfad validieren.',
          createdAt: '2026-05-03T10:00:00Z',
          url: 'https://example.test/pr/files#comment-1',
        },
        {
          id: 'comment-2',
          databaseId: 102,
          authorLogin: 'maintainer',
          authorAssociation: 'MEMBER',
          body: '<!-- bot-comment-status: accepted -->\nPfadvalidierung ergänzt.',
          createdAt: '2026-05-03T10:10:00Z',
          url: 'https://example.test/pr/files#comment-2',
        },
      ],
    },
  ];

  const result = evaluateReviewThreads(threads);

  expect(result.handled).toHaveLength(0);
  expect(result.open).toHaveLength(1);
  expect(result.open[0]?.reason ?? '').toMatch(/resolved/);
});

it('evaluateReviewThreads accepts resolved bot threads with maintainer marker reply', () => {
  const threads: ReviewThreadRecord[] = [
    {
      id: 'thread-1',
      isResolved: true,
      url: 'https://example.test/pr/files#thread-1',
      comments: [
        {
          id: 'comment-1',
          databaseId: 101,
          authorLogin: 'Copilot',
          authorAssociation: 'NONE',
          body: 'Bitte den Pfad validieren.',
          createdAt: '2026-05-03T10:00:00Z',
          url: 'https://example.test/pr/files#comment-1',
        },
        {
          id: 'comment-2',
          databaseId: 102,
          authorLogin: 'maintainer',
          authorAssociation: 'COLLABORATOR',
          body: '<!-- bot-comment-status: resolved -->\nHinweis geprüft und als bestehend abgedeckt dokumentiert.',
          createdAt: '2026-05-03T10:10:00Z',
          url: 'https://example.test/pr/files#comment-2',
        },
      ],
    },
  ];

  const result = evaluateReviewThreads(threads);

  expect(result.open).toHaveLength(0);
  expect(result.handled).toHaveLength(1);
  expect(result.handled[0]?.status).toBe('resolved');
});
