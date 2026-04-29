import type { HostMediaAssetListItem, HostMediaReferenceSelection } from './media-picker-client.js';

export type HostMediaFieldOption = Readonly<{
  assetId: string;
  label: string;
}>;

export const compactOptionalString = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const toDatetimeLocalValue = (value?: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const fromDatetimeLocalValue = (value: string): string => {
  if (value.length === 0) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export const toHostMediaFieldOptions = (assets: readonly HostMediaAssetListItem[]): readonly HostMediaFieldOption[] =>
  assets.map((asset) => ({
    assetId: asset.id,
    label: String(asset.metadata?.title ?? asset.id),
  }));

export const findHostMediaReferenceAssetId = (
  references: readonly HostMediaReferenceSelection[],
  role: string
): string | null => references.find((reference) => reference.role === role)?.assetId ?? null;
