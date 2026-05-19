import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import { readPublicWasteBootstrapStateFromEnvironment } from './src/lib/public-waste-bootstrap.server.js';
import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWasteSelectionRequest,
} from './src/lib/public-waste-endpoints.server.js';
import { createPublicWasteRepository } from './src/lib/public-waste-repository.server.js';

const publicWasteApiPlugin = (): Plugin => {
  const configPath = [
    resolve(process.cwd(), 'public-waste-config.local.json'),
    resolve(process.cwd(), 'public-waste-config.example.json'),
  ].find((path) => existsSync(path));

  const bootstrapState = readPublicWasteBootstrapStateFromEnvironment({
    rawConfigJson: process.env.PUBLIC_WASTE_CONFIG_JSON ?? (configPath ? readFileSync(configPath, 'utf8') : undefined),
  });

  const pool =
    bootstrapState.status === 'ready'
      ? new Pool({
          connectionString: bootstrapState.config.supabase.databaseUrl,
          max: 4,
          idleTimeoutMillis: 5_000,
          connectionTimeoutMillis: 5_000,
        })
      : null;

  const repository =
    bootstrapState.status === 'ready' && pool
      ? createPublicWasteRepository({
          schemaName: bootstrapState.config.supabase.schemaName,
          execute: async <TRow = Record<string, unknown>>({ text, values }: {
            readonly text: string;
            readonly values?: readonly unknown[];
          }) => {
            const result = await pool.query(text, values ? [...values] : undefined);
            return {
              rowCount: result.rowCount ?? 0,
              rows: result.rows as readonly TRow[],
            };
          },
        })
      : null;

  const handleApiRequest = async (url: string, headers: Headers): Promise<Response> => {
    if (bootstrapState.status !== 'ready' || !repository) {
      return new Response(
        JSON.stringify({
          error: bootstrapState.status === 'error' ? bootstrapState.reason : 'invalid_config',
          message: bootstrapState.status === 'error' ? bootstrapState.message : 'Konfiguration ist ungültig.',
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }
      );
    }

    const request = new Request(url, { method: 'GET', headers });

    if (url.includes('/api/public-waste/selection')) {
      return handlePublicWasteSelectionRequest({ repository, request });
    }
    if (url.includes('/api/public-waste/calendar?')) {
      return handlePublicWasteCalendarRequest({
        repository,
        request,
        pdfUrlTemplate: bootstrapState.config.pdf.urlTemplate,
      });
    }
    return handlePublicWasteIcalRequest({ repository, request });
  };

  return {
    name: 'public-waste-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (
          !url.startsWith('/api/public-waste/selection') &&
          !url.startsWith('/api/public-waste/calendar') &&
          !url.startsWith('/api/public-waste/ical')
        ) {
          return next();
        }

        const response = await handleApiRequest(`http://localhost${url}`, new Headers(req.headers as Record<string, string>));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (
          !url.startsWith('/api/public-waste/selection') &&
          !url.startsWith('/api/public-waste/calendar') &&
          !url.startsWith('/api/public-waste/ical')
        ) {
          return next();
        }

        const response = await handleApiRequest(`http://localhost${url}`, new Headers(req.headers as Record<string, string>));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
};

export default defineConfig({
  plugins: [react(), publicWasteApiPlugin()],
});
