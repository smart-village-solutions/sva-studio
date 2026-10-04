import type { ParsedCommand } from './sonar-hotspots-types.ts';
import { error, readSharedOptions } from './sonar-hotspots-parse-shared.ts';
import {
  parseListCommand,
  parseShowCommand,
  parseReviewCommand,
  parseBulkReviewCommand,
} from './sonar-hotspots-parse-hotspots.ts';
import {
  parseIssueListCommand,
  parseIssueShowCommand,
  parseIssueTransitionCommand,
  parseIssueCommentCommand,
} from './sonar-hotspots-parse-issues.ts';

export const parseCommand = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): ParsedCommand => {
  const normalizedArgv = argv[0] === '--' ? argv.slice(1) : argv;
  const [commandName = 'list', ...args] = normalizedArgv;
  const shared = readSharedOptions(args, env);

  switch (commandName) {
    case 'list':
      return parseListCommand(args, shared);
    case 'show':
      return parseShowCommand(args, shared);
    case 'review':
      return parseReviewCommand(args, shared);
    case 'bulk-review':
      return parseBulkReviewCommand(args, shared);
    case 'issues:list':
      return parseIssueListCommand(args, shared);
    case 'issues:show':
      return parseIssueShowCommand(args, shared);
    case 'issues:transition':
      return parseIssueTransitionCommand(args, shared);
    case 'issues:comment':
      return parseIssueCommentCommand(args, shared);
    default:
      return error(`Unbekanntes Kommando: ${commandName}`);
  }
};
