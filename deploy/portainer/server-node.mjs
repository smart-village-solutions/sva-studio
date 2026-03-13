import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { appendFileSync } from 'node:fs';
import serverEntry from './server/server.js';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const errorLogFile = '/tmp/sva-server-errors.log';

function logErrorLine(message) {
  try {
    appendFileSync(errorLogFile, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Best effort logging only.
  }
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  const rendered = args
    .map((value) => {
      if (value instanceof Error) {
        return `${value.name}: ${value.message}\n${value.stack || ''}`;
      }
      return typeof value === 'string' ? value : JSON.stringify(value);
    })
    .join(' ');
  logErrorLine(rendered);
};

function buildOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const hostHeader = req.headers.host || `${host}:${port}`;
  return `${proto}://${hostHeader}`;
}

function toRequest(req) {
  const origin = buildOrigin(req);
  const url = new URL(req.url || '/', origin);
  const method = req.method || 'GET';
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  const hasBody = !['GET', 'HEAD'].includes(method);
  const init = {
    method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  };

  return new Request(url, init);
}

const app =
  serverEntry && typeof serverEntry.fetch === 'function'
    ? serverEntry
    : { fetch: serverEntry };

if (!app || typeof app.fetch !== 'function') {
  throw new Error('Server entry does not expose a fetch handler.');
}

const httpServer = createServer(async (req, res) => {
  try {
    const response = await app.fetch(toRequest(req));

    if (response.status >= 500) {
      const bodyPreview = await response.clone().text().then((value) => value.slice(0, 500)).catch(() => '');
      logErrorLine(`Upstream 5xx for ${req.method || 'GET'} ${req.url || '/'}: status=${response.status} body=${bodyPreview}`);
    }

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error('Request handling failed', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

httpServer.listen(port, host, () => {
  console.log(`SVA Studio server listening on ${host}:${port}`);
});
