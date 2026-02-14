# Redis Setup für lokale Entwicklung

## Quickstart

```bash
# Redis starten
docker compose up -d redis

# Status prüfen
docker compose ps

# Logs ansehen
docker compose logs -f redis

# Redis CLI verwenden
docker compose exec redis redis-cli

# Redis stoppen
docker compose down
```

## Konfiguration

Das lokale Redis läuft mit folgenden Einstellungen:

- **Port**: 6379 (Standard)
- **Persistenz**: AOF (Append-Only File) aktiviert
- **Max Memory**: 256 MB mit LRU Eviction
- **Health Check**: Alle 5 Sekunden

## Verbindung in der App

Die App verbindet sich über die Umgebungsvariable:

```bash
REDIS_URL=redis://localhost:6379
```

Für Development in `.env.local`:
```env
REDIS_URL=redis://localhost:6379
```

## Daten löschen

```bash
# Alle Keys löschen
docker compose exec redis redis-cli FLUSHALL

# Redis Container & Volumes komplett entfernen
docker compose down -v
```

## Monitoring

```bash
# Aktuelle Verbindungen
docker compose exec redis redis-cli INFO clients

# Memory Usage
docker compose exec redis redis-cli INFO memory

# Alle Keys ansehen
docker compose exec redis redis-cli KEYS '*'

# Session ansehen (Beispiel)
docker compose exec redis redis-cli GET "session:abc-123"
```

## Production Setup

Für Production siehe:
- `openspec/changes/add-redis-session-store/design.md` - HA-Anforderungen
- `openspec/changes/add-redis-session-store/specs/auth/spec.md` - Security-Konfiguration
