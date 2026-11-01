import type { ConstructionSiteInput } from './contract.js';
export type ConstructionSiteFormProps = Readonly<{
  draft: ConstructionSiteInput;
  change: <K extends keyof ConstructionSiteInput>(key: K, value: ConstructionSiteInput[K]) => void;
  errors: readonly string[];
  categories: readonly { id: string; name: string }[];
  canPublish: boolean;
  disabled: boolean;
}>;
export const constructionSiteFieldId = (path: string) => {
  if (!path.startsWith('mediaContents')) return `cs-${path.replace(/\./g, '-')}`;
  const url = /^mediaContents\.(\d+)\.sourceUrl\.url$/.exec(path);
  if (url) return `cs-mediaContents-${url[1]}-sourceUrl-url`;
  return 'cs-mediaContents-summary';
};
