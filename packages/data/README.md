# @sva/data

Kleiner, framework-agnostischer HTTP-DataClient fuer die Anbindung an externe Backends.
Aktuell stellt das Paket einen `GET`-Client mit In-Memory-Cache bereit.

## API

- `createDataClient({ baseUrl, cacheTtlMs? })`
	- `baseUrl`: Basis-URL des Zielsystems
	- `cacheTtlMs`: Optional, Default `30_000`

Rueckgabe:

- `get<T>(path, init?)` -> `Promise<T>`

## Beispiel

```ts
import { createDataClient } from '@sva/data';

const client = createDataClient({ baseUrl: 'https://example.invalid' });

type Health = { ok: boolean };
const health = await client.get<Health>('/health');
```
