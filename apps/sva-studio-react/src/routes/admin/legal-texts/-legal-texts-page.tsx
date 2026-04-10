import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useLegalTexts } from '../../../hooks/use-legal-texts';
import { t, type TranslationKey } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

type StatusFilter = 'all' | 'draft' | 'valid' | 'archived';
type LegalTextStatus = 'draft' | 'valid' | 'archived';

const statusLabelKeyByValue: Record<LegalTextStatus, TranslationKey> = {
  draft: 'admin.legalTexts.status.draft',
  valid: 'admin.legalTexts.status.valid',
  archived: 'admin.legalTexts.status.archived',
};

const legalTextErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.legalTexts.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.legalTexts.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.legalTexts.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.legalTexts.errors.rateLimited');
    case 'conflict':
      return t('admin.legalTexts.errors.conflict');
    case 'not_found':
      return t('admin.legalTexts.errors.notFound');
    case 'database_unavailable':
      return t('admin.legalTexts.errors.databaseUnavailable');
    case 'invalid_request':
      return error.message && error.message !== `http_${error.status}`
        ? error.message
        : t('admin.legalTexts.errors.invalidRequest');
    default:
      return t('admin.legalTexts.messages.error');
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('admin.legalTexts.table.publishedUnset');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const collapseWhitespace = (value: string): string => {
  let result = '';
  let previousWasWhitespace = true;

  for (const character of value) {
    if (/\s/.test(character)) {
      if (!previousWasWhitespace) {
        result += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }

    result += character;
    previousWasWhitespace = false;
  }

  return result.trim();
};

const stripHtml = (value: string): string => {
  let result = '';
  let insideTag = false;

  for (const character of value) {
    if (character === '<') {
      insideTag = true;
      result += ' ';
      continue;
    }

    if (character === '>') {
      insideTag = false;
      result += ' ';
      continue;
    }

    if (!insideTag) {
      result += character;
    }
  }

  return collapseWhitespace(result);
};

const summarizeHtml = (value: string): string => {
  const plainText = stripHtml(value);
  if (plainText.length <= 120) {
    return plainText || '—';
  }
  return `${plainText.slice(0, 117)}...`;
};

export const LegalTextsPage = () => {
  const legalTextsApi = useLegalTexts();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

  const filteredLegalTexts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return legalTextsApi.legalTexts.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.id.toLowerCase().includes(normalizedSearch) ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.legalTextVersion.toLowerCase().includes(normalizedSearch) ||
        item.locale.toLowerCase().includes(normalizedSearch) ||
        stripHtml(item.contentHtml).toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [legalTextsApi.legalTexts, search, statusFilter]);

  const metrics = React.useMemo(() => {
    const total = legalTextsApi.legalTexts.length;
    const valid = legalTextsApi.legalTexts.filter((item) => item.status === 'valid').length;
    const locales = new Set(legalTextsApi.legalTexts.map((item) => item.locale)).size;
    const acceptances = legalTextsApi.legalTexts.reduce((sum, item) => sum + item.activeAcceptanceCount, 0);
    return { total, valid, locales, acceptances };
  }, [legalTextsApi.legalTexts]);

  return (
    <section className="space-y-5" aria-busy={legalTextsApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.legalTexts.page.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.legalTexts.page.subtitle')}</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.total')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.total}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.valid')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.valid}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.locales')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.locales}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.legalTexts.metrics.acceptances')}</p>
          <p className="text-3xl font-semibold text-foreground">{metrics.acceptances}</p>
        </Card>
      </div>

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_14rem_auto]">
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="legal-texts-search">{t('admin.legalTexts.filters.searchLabel')}</Label>
          <Input
            id="legal-texts-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.legalTexts.filters.searchPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="legal-texts-status">{t('admin.legalTexts.filters.statusLabel')}</Label>
          <Select
            id="legal-texts-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">{t('admin.legalTexts.filters.statusAll')}</option>
            <option value="draft">{t('admin.legalTexts.filters.statusDraft')}</option>
            <option value="valid">{t('admin.legalTexts.filters.statusValid')}</option>
            <option value="archived">{t('admin.legalTexts.filters.statusArchived')}</option>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button asChild type="button">
            <Link to="/admin/legal-texts/new">{t('admin.legalTexts.actions.create')}</Link>
          </Button>
        </div>
      </Card>

      {legalTextsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{legalTextErrorMessage(legalTextsApi.error)}</span>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void legalTextsApi.refetch()}>
                {t('admin.legalTexts.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {filteredLegalTexts.length === 0 ? (
        <Card className="space-y-3 p-6">
          <h2 className="text-xl font-semibold text-foreground">{t('admin.legalTexts.empty.title')}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.legalTexts.empty.body')}</p>
          <div>
            <Button asChild type="button">
              <Link to="/admin/legal-texts/new">{t('admin.legalTexts.actions.create')}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-shell">
          <table className="min-w-full border-collapse" aria-label={t('admin.legalTexts.table.ariaLabel')}>
            <caption className="sr-only">{t('admin.legalTexts.table.caption')}</caption>
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerUuid')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerName')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerVersion')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerLocale')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerStatus')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerContent')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerPublished')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerCreated')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerUpdated')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerAcceptances')}</th>
                <th scope="col" className="px-3 py-3">{t('admin.legalTexts.table.headerLastAccepted')}</th>
                <th scope="col" className="px-3 py-3 text-right">{t('admin.legalTexts.table.headerActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLegalTexts.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-3 py-3 text-xs text-muted-foreground">{item.id}</td>
                  <td className="px-3 py-3 text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.legalTextVersion}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{item.locale}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">{t(statusLabelKeyByValue[item.status])}</Badge>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-sm text-foreground">{summarizeHtml(item.contentHtml)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.publishedAt)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.createdAt)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-3 py-3 text-sm text-foreground">
                    {t('admin.legalTexts.table.acceptanceSummary', {
                      active: String(item.activeAcceptanceCount),
                      total: String(item.acceptanceCount),
                    })}
                  </td>
                  <td className="px-3 py-3 text-sm text-foreground">{formatDateTime(item.lastAcceptedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <Button asChild type="button" variant="outline" size="sm">
                      <Link to="/admin/legal-texts/$legalTextVersionId" params={{ legalTextVersionId: item.id }}>
                        {t('admin.legalTexts.actions.edit')}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
