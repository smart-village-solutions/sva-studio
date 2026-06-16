import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const setTourDeleteErrorMessage = (state: WasteToursState, pt: Translate, error: unknown) => {
  const code = resolveApiErrorCode(error);
  state.setMessage({
    kind: 'error',
    text:
      code === 'forbidden'
        ? pt('tours.messages.deleteForbidden')
        : code === 'invalid_request'
          ? pt('tours.messages.deleteConflict')
          : pt('tours.messages.deleteError'),
  });
};
