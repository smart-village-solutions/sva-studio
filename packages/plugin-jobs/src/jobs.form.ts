import type { JobInput } from './contract.js';
export type JobFormProps = Readonly<{
  draft: JobInput;
  change: <K extends keyof JobInput>(key: K, value: JobInput[K]) => void;
  errors: readonly string[];
  categories: readonly { id: string; name: string }[];
  categoriesLoading?: boolean;
  categoryError?: boolean;
  canPublish: boolean;
  disabled: boolean;
}>;
export const jobFieldId = (path: string) => {
  if (!path.startsWith('mediaContents')) return `job-${path.replace(/\./g, '-')}`;
  const url = /^mediaContents\.(\d+)\.sourceUrl\.url$/.exec(path);
  if (url) return `job-mediaContents-${url[1]}-sourceUrl-url`;
  return 'job-mediaContents-summary';
};
