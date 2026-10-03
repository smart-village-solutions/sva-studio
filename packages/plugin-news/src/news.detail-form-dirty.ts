import type {
  NewsContentBlockFormValue,
  NewsDetailFormValues,
  NewsDetailTabId,
} from './news.types.js';

type DirtyFieldTree = {
  readonly [key: string]: true | DirtyFieldTree | readonly DirtyFieldTree[] | undefined;
};

type DirtyTabState = Record<NewsDetailTabId, boolean>;
const getVisibleTextLength = (value: string): number => {
  let inTag = false;
  let previousWasWhitespace = true;
  let visibleLength = 0;

  for (const character of value) {
    if (character === '<') {
      inTag = true;
      continue;
    }

    if (character === '>' && inTag) {
      inTag = false;
      previousWasWhitespace = true;
      continue;
    }

    if (inTag) {
      continue;
    }

    if (/\s/u.test(character)) {
      previousWasWhitespace = true;
      continue;
    }

    if (previousWasWhitespace && visibleLength > 0) {
      visibleLength += 1;
    }

    visibleLength += 1;
    previousWasWhitespace = false;
  }

  return visibleLength;
};

const hasDirtyPath = (
  tree: DirtyFieldTree | readonly DirtyFieldTree[] | true | undefined,
  path: readonly string[]
): boolean => {
  if (tree === true) {
    return true;
  }

  if (!tree) {
    return false;
  }

  if (Array.isArray(tree)) {
    return tree.some((entry) => hasDirtyPath(entry, path));
  }

  if (path.length === 0) {
    return Object.keys(tree).length > 0;
  }

  const [head, ...tail] = path;
  const nextTree = (
    tree as Record<string, true | DirtyFieldTree | readonly DirtyFieldTree[] | undefined>
  )[head];
  return hasDirtyPath(nextTree, tail);
};

export const deriveDirtyNewsDetailTabs = (dirtyFields: DirtyFieldTree): DirtyTabState => ({
  basis: [['title'], ['keywords'], ['categories']].some((path) => hasDirtyPath(dirtyFields, path)),
  content: [
    ['contentBlocks'],
    ['contentIntro'],
    ['contentBody'],
    ['contentMedia'],
    ['sourceUrl'],
    ['sourceUrlDescription'],
    ['address'],
    ['pointOfInterestId'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  settings: [
    ['publishedAt'],
    ['publicationDate'],
    ['showPublishDate'],
    ['pushNotification'],
    ['pushNotificationEnabled'],
    ['wasteLocationKeys'],
    ['publicationMode'],
    ['scheduledPublicationAt'],
    ['externalId'],
    ['newsType'],
    ['charactersToBeShown'],
    ['fullVersion'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  history: false,
});

export const buildNewsDetailCharacterCounts = (
  values: Pick<NewsDetailFormValues, 'title'> &
    Partial<Pick<NewsDetailFormValues, 'contentIntro' | 'contentBody'>> & {
      readonly contentBlocks?: readonly Pick<NewsContentBlockFormValue, 'intro' | 'body'>[];
    }
) => {
  const contentBlocks = values.contentBlocks ?? [
    { intro: values.contentIntro ?? '', body: values.contentBody ?? '' },
  ];

  return {
    title: values.title.length,
    intros: contentBlocks.map((block) => block.intro.length),
    bodies: contentBlocks.map((block) => getVisibleTextLength(block.body)),
  };
};
