export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
};
