import { useEffect, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useStudioTableQuery, type MainserverPrincipalControlModel } from '@sva/studio-ui-react';
import {
  listVoucherCategories,
  listVoucherLocations,
  listVouchers,
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
  const { locations, categories } = useVoucherChoices(principal);
  const list = useStudioTableQuery(['vouchers', principal, page, query], (signal) =>
    listVouchers(page, query.search, principal, query, signal)
  );
  const result = list.data ?? null;
  const { state } = list;
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
    refetch: list.refetch,
    error: list.error,
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
    setLocations([]);
    const loadLocations = async () => {
      const choices: { id: string; name: string }[] = [];
      for (let page = 1; current; page += 1) {
        const value = await listVoucherLocations(page, principal);
        if (!current) return;
        choices.push(...value.data);
        setLocations([...choices]);
        if (!value.pagination.hasNextPage) return;
      }
    };
    void loadLocations().catch(() => undefined);
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
