import { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Button, Input } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
export const SearchHeader = ({ onSearch }: { readonly onSearch: (q: string) => void }) => {
  const pt = usePluginTranslation('search');
  const [q, setQuery] = useState('');
  return (
    <>
      <form
        role="search"
        aria-label={pt('headerLandmark')}
        className="hidden min-w-0 max-w-md flex-1 items-center gap-2 lg:flex"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(q.trim());
        }}
      >
        <Input
          type="search"
          value={q}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={250}
          placeholder={pt('prompt')}
          aria-label={pt('prompt')}
          className="rounded-full bg-surface-inset"
        />
        <Button type="submit" size="icon" variant="tertiary" aria-label={pt('submit')}>
          <IconSearch aria-hidden="true" className="h-5 w-5" />
        </Button>
      </form>
      <Button
        type="button"
        size="icon"
        variant="tertiary"
        className="lg:hidden"
        aria-label={pt('open')}
        onClick={() => onSearch('')}
      >
        <IconSearch aria-hidden="true" className="h-5 w-5" />
      </Button>
    </>
  );
};
