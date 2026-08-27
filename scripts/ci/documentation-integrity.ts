import { checkDocumentationBoundaries } from './documentation-integrity-boundaries';
import type {
  DocumentationIntegrityInput,
  DocumentationIssue,
} from './documentation-integrity-contract';
import { checkDocumentationGraph } from './documentation-integrity-graph';

export * from './documentation-integrity-contract';

const issueKey = (issue: DocumentationIssue): string =>
  `${issue.path}\u0000${issue.line.toString().padStart(8, '0')}\u0000${issue.code}\u0000${issue.reason}`;

const sortedIssues = (issues: DocumentationIssue[]): DocumentationIssue[] =>
  issues.sort((left, right) => issueKey(left).localeCompare(issueKey(right), 'en'));

export const checkDocumentationIntegrity = (
  input: DocumentationIntegrityInput
): DocumentationIssue[] =>
  sortedIssues([...checkDocumentationBoundaries(input), ...checkDocumentationGraph(input)]);
