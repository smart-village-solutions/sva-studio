import type { ConstructionSiteInput } from './contract.js';
export type ConstructionSiteFormProps = Readonly<{
  draft: ConstructionSiteInput;
  change: <K extends keyof ConstructionSiteInput>(key: K, value: ConstructionSiteInput[K]) => void;
  errors: readonly string[];
  categories: readonly { id: string; name: string }[];
  canPublish: boolean;
  disabled: boolean;
}>;
export const constructionSiteFieldId = (path: string) =>
  path.startsWith('mediaContents') ? 'cs-mediaContents-summary' : `cs-${path.replace(/\./g, '-')}`;
