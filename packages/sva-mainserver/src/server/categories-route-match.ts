const CATEGORY_COLLECTION_PATH = '/api/v1/mainserver/categories';

export type CategoryAction =
  'categories.read' | 'categories.create' | 'categories.update' | 'categories.delete';
export type CategoryRoute =
  Readonly<{ kind: 'collection' }> | Readonly<{ kind: 'item'; id: string }>;

export const matchCategoryRoute = (request: Request): CategoryRoute | null => {
  const pathname = new URL(request.url).pathname;
  if (pathname === CATEGORY_COLLECTION_PATH) return { kind: 'collection' };
  const prefix = `${CATEGORY_COLLECTION_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  try {
    const id = decodeURIComponent(pathname.slice(prefix.length)).trim();
    return id && !id.includes('/') ? { kind: 'item', id } : null;
  } catch {
    return null;
  }
};

export const resolveCategoryAction = (
  request: Request,
  route: CategoryRoute
): CategoryAction | null => {
  if (request.method === 'GET') return 'categories.read';
  if (request.method === 'POST' && route.kind === 'collection') return 'categories.create';
  if (request.method === 'PUT' && route.kind === 'item') return 'categories.update';
  if (request.method === 'DELETE' && route.kind === 'item') return 'categories.delete';
  return null;
};
