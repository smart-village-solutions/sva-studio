import type { IamContentListItem } from '@sva/core';
import { resolveStudioContentDetailPath, type RegisteredStudioContentType } from '@sva/plugin-sdk';

const createStudioContentTypeMap = (
  studioContentTypes: readonly RegisteredStudioContentType[]
): ReadonlyMap<string, RegisteredStudioContentType> =>
  new Map(studioContentTypes.map((definition) => [definition.contentType, definition] as const));

const hasGrantedAction = (permissionActions: readonly string[], actionId: string): boolean =>
  permissionActions.includes(actionId);

export const filterCreatableStudioContentTypes = (
  studioContentTypes: readonly RegisteredStudioContentType[],
  permissionActions: readonly string[]
): readonly RegisteredStudioContentType[] =>
  studioContentTypes.filter((definition) => hasGrantedAction(permissionActions, definition.requiredCreateAction));

export const filterRegisteredStudioContentItems = (
  items: readonly IamContentListItem[],
  studioContentTypes: readonly RegisteredStudioContentType[],
  permissionActions: readonly string[]
): readonly Readonly<{ item: IamContentListItem; definition: RegisteredStudioContentType }>[] => {
  const byType = createStudioContentTypeMap(studioContentTypes);

  return items.flatMap((item) => {
    const definition = byType.get(item.contentType);
    if (!definition || !hasGrantedAction(permissionActions, definition.requiredReadAction)) {
      return [];
    }

    return [{ item, definition }] as const;
  });
};

export const resolveStudioContentEditPath = (
  item: Pick<IamContentListItem, 'id' | 'contentType'>,
  studioContentTypes: readonly RegisteredStudioContentType[]
): string | null => {
  const definition = createStudioContentTypeMap(studioContentTypes).get(item.contentType);
  return definition ? resolveStudioContentDetailPath(definition, item.id) : null;
};
