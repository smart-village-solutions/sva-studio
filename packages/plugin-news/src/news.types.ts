export type NewsPayload = {
  readonly teaser: string;
  readonly body: string;
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
};

export type NewsStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export type NewsContentItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: string;
  readonly payload: NewsPayload;
  readonly status: NewsStatus;
  readonly author: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
};
