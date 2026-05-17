import { useEffect, useState } from 'react';

export const useLocationsFiltersOpen = (selectedTourId?: string) => {
  const [filtersOpen, setFiltersOpen] = useState(Boolean(selectedTourId));

  useEffect(() => {
    if (selectedTourId) {
      setFiltersOpen(true);
    }
  }, [selectedTourId]);

  return { filtersOpen, setFiltersOpen };
};
