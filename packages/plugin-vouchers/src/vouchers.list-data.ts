import { useEffect, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type { MainserverPrincipalControlModel } from '@sva/studio-ui-react';
import {
  listVoucherCategories,
  listVoucherLocations,
  listVouchers,
  type VoucherList,
} from './vouchers.api.js';
import { useVoucherAccess } from './vouchers.access.js';
export function useVoucherList(principalControl?: MainserverPrincipalControlModel) {
  const principal = principalControl?.value ?? 'user';
  const params = useSearch({ strict: false }) as {
    poiId?: string;
  };
  const t = usePluginTranslation('vouchers');
  const access = useVoucherAccess();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState({
    search: '',
    categoryId: '',
    visible: '',
    poiId: params.poiId ?? '',
  });
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<VoucherList | null>(null);
  const { locations, categories } = useVoucherChoices(principal);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setState('loading');
    void listVouchers(page, query.search, principal, query).then(
      (value) => {
        if (current) {
          setResult(value);
          setState('ready');
        }
      },
      () => {
        if (current) setState('error');
      }
    );
    return () => {
      current = false;
    };
  }, [page, query, revision, principal]);
  const filter = (key: 'categoryId' | 'visible' | 'poiId', value: string) => {
    setPage(1);
    setQuery((previous) => ({ ...previous, [key]: value }));
  };
  return {
    page,
    setPage,
    query,
    setQuery,
    search,
    setSearch,
    result,
    locations,
    categories,
    state,
    revision,
    setRevision,
    t,
    access,
    filter,
  };
}
export type VoucherListState = ReturnType<typeof useVoucherList>;

function useVoucherChoices(principal: 'organization' | 'user') {
  const [locations, setLocations] = useState<
    readonly {
      id: string;
      name: string;
    }[]
  >([]);
  const [categories, setCategories] = useState<
    readonly {
      id: string;
      name: string;
    }[]
  >([]);
  useEffect(() => {
    let current = true;
    void listVoucherLocations(1, principal).then(
      (value) => {
        if (current) setLocations(value.data);
      },
      () => undefined
    );
    void listVoucherCategories().then(
      (value) => {
        if (current) setCategories(value.data);
      },
      () => undefined
    );
    return () => {
      current = false;
    };
  }, [principal]);
  return { locations, categories };
}
