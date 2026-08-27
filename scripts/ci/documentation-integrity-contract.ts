export const DOCUMENTATION_ENTRYPOINT = 'docs/README.md';
export const ADR_INDEX_PATH = 'docs/adr/README.md';

export const EXCLUDED_PUBLICATION_PREFIXES = [
  'docs/architecture/decisions/',
  'docs/changelog/',
  'docs/pr/',
  'docs/reports/',
  'docs/staging/',
  'docs/superpowers/',
  'docs/user-documentation/',
] as const;

export type DocumentationIssueCode =
  | 'adr-index-mismatch'
  | 'broken-link'
  | 'invalid-manifest'
  | 'publication-boundary'
  | 'unreachable-page'
  | 'wiki-legacy-link';

export interface DocumentationIssue {
  code: DocumentationIssueCode;
  path: string;
  line: number;
  reason: string;
}

export interface DocumentationIntegrityInput {
  files: ReadonlyMap<string, string>;
  manifestEntries: readonly string[];
  publishedPaths: ReadonlySet<string>;
  trackedPaths: ReadonlySet<string>;
  wikiWorkflow: string;
}
