export type {
  WasteManagementHistoryOverview,
} from '@sva/plugin-sdk';

export type WasteOutputPdfArtifactRecord = Readonly<{
  year: number;
  deliveryUrl: string;
  expiresAt?: string;
  storageKey?: string;
}>;

export type WasteOutputCollectionLocationArtifacts = Readonly<{
  collectionLocationId: string;
  pdfs: readonly WasteOutputPdfArtifactRecord[];
}>;

export type WasteManagementOutputOverview = Readonly<{
  collectionLocations: readonly WasteOutputCollectionLocationArtifacts[];
}>;

export type WasteManagementOutputPdfResult = Readonly<{
  collectionLocationId: string;
  year: number;
  storageKey: string;
  deliveryUrl: string;
  expiresAt?: string;
}>;
