import type { NewsArticle } from './types';

const STORAGE_KEY = 'sva-plugin-news';

const sampleArticles: NewsArticle[] = [
  {
    id: 'news-1',
    title: 'Willkommen im SVA Studio',
    summary: 'Das SVA Studio ist die zentrale Plattform für Inhalte und Module.',
    content:
      'Das SVA Studio bietet eine moderne Oberfläche zur Verwaltung von Inhalten, Modulen und Erweiterungen für die Smart Village App. Mit dem News-Plugin können redaktionelle Inhalte erstellt und verwaltet werden.',
    author: 'Redaktion',
    status: 'published',
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
  {
    id: 'news-2',
    title: 'Neue Funktionen im Überblick',
    summary: 'Ein Überblick über die neuesten Erweiterungen und Verbesserungen.',
    content:
      'In der aktuellen Version wurden zahlreiche Verbesserungen vorgenommen: Das Plugin-System wurde erweitert, die Navigation überarbeitet und die Benutzerverwaltung optimiert.',
    author: 'Redaktion',
    status: 'draft',
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

const loadArticles = (): NewsArticle[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as NewsArticle[];
    }
  } catch {
    // ignore
  }
  return [...sampleArticles];
};

const persist = (articles: NewsArticle[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
};

export const newsStore = {
  getAll(): NewsArticle[] {
    return loadArticles();
  },

  getById(id: string): NewsArticle | undefined {
    return loadArticles().find((a) => a.id === id);
  },

  create(data: Pick<NewsArticle, 'title' | 'summary' | 'content' | 'author'>): NewsArticle {
    const articles = loadArticles();
    const now = new Date().toISOString();
    const article: NewsArticle = {
      ...data,
      id: `news-${Date.now()}`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    articles.unshift(article);
    persist(articles);
    return article;
  },

  update(id: string, data: Partial<Pick<NewsArticle, 'title' | 'summary' | 'content' | 'status'>>): NewsArticle | undefined {
    const articles = loadArticles();
    const index = articles.findIndex((a) => a.id === id);
    if (index === -1) return undefined;
    articles[index] = { ...articles[index], ...data, updatedAt: new Date().toISOString() };
    persist(articles);
    return articles[index];
  },

  delete(id: string): boolean {
    const articles = loadArticles();
    const filtered = articles.filter((a) => a.id !== id);
    if (filtered.length === articles.length) return false;
    persist(filtered);
    return true;
  },
};
