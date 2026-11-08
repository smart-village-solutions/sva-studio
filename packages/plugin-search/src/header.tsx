import { useEffect, useState } from 'react';
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router';
import { IconSearch } from '@tabler/icons-react';
import { Button, Input } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { parseSearchQuery } from './search-contract.js';
export const SearchHeader = ({ onSearch }: { readonly onSearch: (q: string) => void }) => {
  const pt = usePluginTranslation('search');
  const search = useSearch({ strict: false });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const activeQuery =
    pathname === '/plugins/search' && typeof search.q === 'string' ? search.q : '';
  const [q, setQuery] = useState(activeQuery);
  useEffect(() => setQuery(activeQuery), [activeQuery]);
  return (
    <form
      role="search"
      aria-label={pt('headerLandmark')}
      className="flex w-full min-w-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (pathname === '/plugins/search') {
          void navigate({
            to: '/plugins/search' as never,
            search: { ...parseSearchQuery(search), q: q.trim(), page: 1 } as never,
          });
        } else onSearch(q.trim());
      }}
    >
      <Input
        type="search"
        value={q}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={250}
        placeholder={pt('prompt')}
        aria-label={pt('prompt')}
        className="min-w-0 rounded-full bg-surface-inset"
      />
      <Button type="submit" size="icon" variant="tertiary" aria-label={pt('submit')}>
        <IconSearch aria-hidden="true" className="h-5 w-5" />
      </Button>
    </form>
  );
};
