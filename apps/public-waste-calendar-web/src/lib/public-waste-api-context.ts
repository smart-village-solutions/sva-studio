import { createContext } from 'react';

// Empty origin preserves standalone requests. Each embedded root owns its value.
export const PublicWasteApiOriginContext = createContext('');
