export const projectStatuses = ['draft', 'published', 'archived'] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export type ProjectAuthor =
  | Readonly<{ type: 'organization'; id: string; displayName: string }>
  | Readonly<{ type: 'person'; id: string; displayName: string }>;

export type ProjectImage = Readonly<{
  url: string;
  altText: string;
  caption?: string;
  credits?: string;
  position: number;
}>;

export type ProjectFormInput = Readonly<{
  language: string;
  title: string;
  description: string;
  fullText: string;
  images: readonly ProjectImage[];
  status: ProjectStatus;
}>;

export type ProjectContentItem = ProjectFormInput &
  Readonly<{
    id: string;
    published: boolean;
    publishedAt?: string;
    deleted: boolean;
    createdAt: string;
    updatedAt: string;
    author: ProjectAuthor;
    dataProvider?: Readonly<{ id?: string; name?: string }>;
  }>;

export type ProjectListQuery = Readonly<{ page: number; pageSize: number }>;

export type ProjectPagination = Readonly<{
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  total?: number;
}>;

export type ProjectListResult = Readonly<{
  data: readonly ProjectContentItem[];
  pagination: ProjectPagination;
}>;
