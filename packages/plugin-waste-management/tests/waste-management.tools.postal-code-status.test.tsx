import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToolsPostalCodeStatus } from '../src/waste-management.tools.postal-code-status.js';

vi.mock('@sva/plugin-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/plugin-sdk')>();
  return {
    ...actual,
    usePluginTranslation:
      () => (key: string, values?: Readonly<Record<string, string | number>>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('WasteToolsPostalCodeStatus', () => {
  afterEach(cleanup);

  it('announces running city progress', () => {
    const { container } = render(
      <WasteToolsPostalCodeStatus
        job={
          {
            jobTypeId: 'waste-management.enrich-postal-codes',
            status: 'running',
            progress: {
              completedSteps: 5,
              totalSteps: 20,
              details: { processedCities: 5, totalCities: 20 },
            },
          } as never
        }
      />
    );

    expect(container.textContent).toContain(
      'tools.postalCodes.progressSummary:{"processed":5,"total":20}'
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('announces the aggregated terminal result', () => {
    const { container } = render(
      <WasteToolsPostalCodeStatus
        job={
          {
            jobTypeId: 'waste-management.enrich-postal-codes',
            status: 'succeeded',
            resultPayload: {
              plugin: {
                updatedCount: 12,
                ambiguousCount: 2,
                notFoundCount: 3,
                failedCount: 1,
                skippedExistingCount: 4,
              },
            },
          } as never
        }
      />
    );

    expect(container.textContent).toContain(
      'tools.postalCodes.resultSummary:{"updated":12,"ambiguous":2,"notFound":3,"failed":1,"skipped":4}'
    );
  });

  it('announces an exhausted provider request budget as a partial result', () => {
    render(
      <WasteToolsPostalCodeStatus
        job={
          {
            jobTypeId: 'waste-management.enrich-postal-codes',
            status: 'succeeded',
            resultPayload: {
              plugin: {
                budgetExhausted: true,
                providerRequestCount: 3000,
                requestBudget: 3000,
                unprocessedCount: 18,
              },
            },
          } as never
        }
      />
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'tools.postalCodes.budgetSummary:{"requests":3000,"budget":3000,"unprocessed":18}'
    );
  });

  it('explains a missing or disabled geocoding configuration', () => {
    render(
      <WasteToolsPostalCodeStatus
        job={
          {
            jobTypeId: 'waste-management.enrich-postal-codes',
            status: 'failed',
            errorPayload: {
              details: { plugin: { category: 'permanent', code: 'disabled' } },
            },
          } as never
        }
      />
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'tools.postalCodes.errors.geocodingDisabled'
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/interfaces');
  });

  it('shows retained progress when a provider timeout ends the job', () => {
    render(
      <WasteToolsPostalCodeStatus
        job={
          {
            jobTypeId: 'waste-management.enrich-postal-codes',
            status: 'failed',
            progress: { details: { processedCities: 160, totalCities: 274 } },
            errorPayload: { message: 'timeout' },
          } as never
        }
      />
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'tools.postalCodes.errors.timeout:{"processed":160,"total":274}'
    );
  });
});
