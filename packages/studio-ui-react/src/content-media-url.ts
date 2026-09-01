import {
  inspectManualMediaUrl,
  isPersistableManualMediaUrl,
  type ManualMediaUrlInspection,
} from '@sva/core';

export const isPersistableManualContentMediaUrl = (value: string): boolean =>
  isPersistableManualMediaUrl(value);

export type ManualContentMediaUrlInspection = ManualMediaUrlInspection;

export const inspectManualContentMediaUrl = (input: string): ManualContentMediaUrlInspection =>
  inspectManualMediaUrl(input);

export const probeContentMediaImageUrl = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof globalThis.Image !== 'function') {
      resolve(false);
      return;
    }

    const image = new globalThis.Image();
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timeoutId = globalThis.setTimeout(() => finish(false), 10_000);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  });
