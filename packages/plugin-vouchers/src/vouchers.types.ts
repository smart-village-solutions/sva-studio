export type VoucherQuota = Readonly<{
  maxQuantity: number | null;
  availableQuantity: number | null;
  maxPerPerson: number | null;
  frequency: string | null;
}>;
export type VoucherInput = Readonly<{
  title: string;
  teaser: string;
  body: string;
  pointOfInterestIds: readonly string[];
  discountMode: 'percentage' | 'amount' | 'price';
  discountValue: number;
  originalPrice?: number;
  maxQuantity: number;
  maxPerPerson?: number;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dateStart?: string;
  dateEnd?: string;
  visible: boolean;
  categories: readonly Readonly<{
    name: string;
  }>[];
  mediaContents: readonly Readonly<{
    contentType: string;
    hostMediaAssetId?: string;
    captionText?: string;
    copyright?: string;
    sourceUrl: Readonly<{
      url: string;
      description?: string;
    }>;
  }>[];
}>;
export type VoucherRecord = Readonly<{
  contentFingerprint?: string;
  id: string;
  title: string;
  teaser: string;
  visible: boolean;
  payload: Readonly<Record<string, unknown>>;
  pointOfInterest: Readonly<{
    id: string;
    name: string;
  }> | null;
  dataProvider: Readonly<{
    id: string;
  }> | null;
  quota: VoucherQuota | null;
  discountType: Readonly<{
    originalPrice: number | null;
    discountedPrice: number | null;
    discountPercentage: number | null;
    discountAmount: number | null;
  }> | null;
  contentBlocks: readonly Readonly<{
    body?: string | null;
  }>[];
  dates: readonly Readonly<{
    dateStart?: string | null;
    dateEnd?: string | null;
  }>[];
  categories: readonly Readonly<{
    name: string;
  }>[];
  mediaContents: VoucherInput['mediaContents'];
}>;
