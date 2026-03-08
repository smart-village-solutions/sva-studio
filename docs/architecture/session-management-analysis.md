# Session Management: Analyse & Handlungsempfehlung

**Erstellt:** 2026-02-04
**Status:** Vorschlag für Architekturentscheidung
**Kontext:** [Issue zur Auth-Implementierung] & Milestone 1

---

## 1. Problem: Aktuelle Situation

### 1.1 Ist-Zustand

Die aktuelle Auth-Implementierung (`packages/auth`) nutzt **In-Memory-Session-Storage**:

```typescript
// packages/auth/src/session.ts
const sessions = new Map<string, Session>();
const loginStates = new Map<string, LoginState>();
```

**Probleme:**
- ❌ Sessions gehen bei Server-Restart/HMR verloren
- ❌ Nicht skalierbar (nur ein Prozess/Server)
- ❌ Keine Persistenz bei Deployment/Rollouts
- ❌ Kein Cluster-Betrieb möglich

### 1.2 Symptom

Nach Login-Redirect von Keycloak wird die Session initial erstellt, aber:
1. Bei Dev-Server-Reload (HMR) ist die Map leer
2. User sieht "Nicht eingeloggt", obwohl Cookie gesetzt wurde
3. Callback-Flow funktioniert grundsätzlich, aber Session-Persistenz fehlt

---

## 2. Anforderungen aus Projektkontext

### 2.1 Funktionale Anforderungen

- **Multi-Mandanten-Fähigkeit**: Verschiedene Organisationen mit isolierten Sessions
- **Skalierbarkeit**: Horizontal skalierbar (mehrere Backend-Instanzen)
- **Performance**: Berechtigungsprüfung < 50 ms (laut Konzeption)
- **OIDC/Keycloak-Integration**: Access Token, Refresh Token, ID Token verwalten
- **Session-Refresh**: Automatisches Token-Refresh ohne Neuanmeldung

### 2.2 Nicht-funktionale Anforderungen

**Sicherheit & Compliance:**
- DSGVO-konform (Datenminimierung, Verschlüsselung)
- BSI-Grundschutz
- HttpOnly, Secure, SameSite Cookies
- Session-Timeout & Auto-Logout

**Betrieb & Wartbarkeit:**
- Open Source First (keine proprietären Cloud-Dienste zwingend)
- Self-Hosted-Fähigkeit für Kommunen
- Monitoring & Observability
- Disaster Recovery & Backup

**Performance:**
- Session-Lookup < 10 ms
- Berechtigungsprüfung < 50 ms (mit Caching)
- Keine blockierenden Disk-I/O im Request-Path

---

## 3. Lösungsoptionen: Vergleich

### 3.1 Option A: Cookie-basierte Sessions (verschlüsselt)

**Konzept:**
- Session-Daten vollständig im Cookie (JWE/signed)
- Kein Server-Side-Storage nötig
- Stateless

**Vorteile:**
- ✅ Keine externe Abhängigkeit (Redis, DB)
- ✅ Horizontal skalierbar (stateless)
- ✅ Einfaches Deployment
- ✅ Schnell (keine DB-Abfrage)

**Nachteile:**
- ❌ Cookie-Größenlimit (~4 KB)
- ❌ Sensitive Daten im Browser (verschlüsselt, aber risiko)
- ❌ Kein serverseitiges Session-Revoke (nur über Token-Blacklist)
- ❌ Größere Tokens bei vielen Rollen/Orgs

**Bewertung:**
Gut für **einfache Use-Cases**, aber problematisch bei:
- Vielen Organisationszugehörigkeiten
- Komplexen Berechtigungsstrukturen (siehe 7-Personas-System)
- Impersonation/Support-Sessions

---

### 3.2 Option B: Redis Session Store

**Konzept:**
- Session-ID im Cookie
- Session-Daten in Redis (Key-Value)
- TTL-basierte Auto-Expiration

**Vorteile:**
- ✅ Sehr schnell (< 1 ms Latenz)
- ✅ Horizontal skalierbar (Redis Cluster)
- ✅ TTL/Expiration eingebaut
- ✅ Session-Revoke möglich (DELETE key)
- ✅ Pub/Sub für Cache-Invalidierung

**Nachteile:**
- ⚠️ Externe Abhängigkeit (Redis-Server)
- ⚠️ Keine Persistenz bei Redis-Restart (außer RDB/AOF)
- ⚠️ Zusätzlicher Infrastruktur-Komponente

**Bewertung:**
**Empfohlene Lösung** für Phase 1–2, weil:
- Passt zur Konzeption (Redis bereits für Permission-Cache geplant)
- Ausgezeichnetes Performance-Profil
- Bewährte Technologie (express-session, connect-redis)

---

### 3.3 Option C: Datenbank-basierte Sessions

**Konzept:**
- Session-ID im Cookie
- Session-Daten in Postgres-Tabelle
- Cleanup via Cron-Job oder TTL-Extension (pg_cron)

**Vorteile:**
- ✅ Vollständige Persistenz
- ✅ Transaktionale Konsistenz mit User-Daten
- ✅ Einfaches Backup/Recovery
- ✅ Audit-Trail möglich (Session-History)
- ✅ Keine zusätzliche Infrastruktur (wenn Postgres schon da)

**Nachteile:**
- ❌ Langsamer als Redis (5–20 ms statt < 1 ms)
- ❌ Höhere DB-Last bei vielen Sessions
- ❌ Connection-Pool-Overhead

**Bewertung:**
Sinnvoll für **langfristige Architektur** oder wenn:
- Keine Redis-Infrastruktur gewünscht
- Sessions mit User-Änderungen transaktional verknüpft werden sollen
- Maximale Daten-Persistenz erforderlich

---

### 3.4 Option D: Hybrid-Ansatz (Redis + DB)

**Konzept:**
- **Hot Storage**: Aktive Sessions in Redis (< 1 h)
- **Cold Storage**: Ältere Sessions in DB (für Audit)
- Automatisches Tiering

**Vorteile:**
- ✅ Beste Performance für aktive Sessions
- ✅ Audit-Fähigkeit durch DB-Persistenz
- ✅ Session-History für Compliance

**Nachteile:**
- ⚠️ Höhere Komplexität (2 Stores)
- ⚠️ Sync-Mechanismus nötig

**Bewertung:**
Für **spätere Phasen** relevant, wenn:
- Umfangreiches Session-Audit erforderlich
- Langzeit-Analyse von Login-Mustern
- Forensik/Compliance-Anforderungen steigen

---

## 4. Handlungsempfehlung

### 4.1 Kurz- bis Mittelfrist (Milestone 1–3): **Redis Session Store**

**Begründung:**
1. **Projektkonzeption passt**: Redis bereits für Permission-Cache vorgesehen
2. **Performance-Ziele erfüllbar**: < 50 ms Berechtigungsprüfung nur mit Caching realistisch
3. **Skalierbarkeit**: Horizontal skalierbar, Cloud-Ready
4. **Einfache Migration**: Von In-Memory zu Redis ist straightforward
5. **Open Source**: Redis ist FOSS, self-hosted möglich

**Umsetzungsschritte:**

#### Phase 1: Redis-Integration (Milestone 1)
```typescript
// packages/auth/src/session.redis.ts
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

export const createSession = async (session: Session) => {
  const ttl = 60 * 60 * 24 * 7; // 7 Tage
  await redis.setEx(
    `session:${session.id}`,
    ttl,
    JSON.stringify(session)
  );
};

export const getSession = async (sessionId: string): Promise<Session | null> => {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
};

export const deleteSession = async (sessionId: string) => {
  await redis.del(`session:${sessionId}`);
};
```

#### Phase 2: Permission-Cache nutzen (Milestone 2)
- Session-User-Permissions aus Permission-Engine cachen
- Invalidierung via Pub/Sub
- Shared Cache für Sessions + Permissions

#### Phase 3: Cluster-Setup (Milestone 3+)
- Redis Sentinel oder Cluster für HA
- Session-Replikation
- Monitoring (Redis Insights, Prometheus)

---

### 4.2 Langfristig (Milestone 4+): **Hybrid Redis + DB**

**Wann relevant?**
- Audit-Trail-Anforderungen steigen
- DSGVO-Auskunftsanfragen (welche Sessions hatte User X?)
- Forensik nach Security-Incident
- Langzeit-Analyse von Login-Mustern

**Umsetzung:**
```typescript
// Schreibe aktive Session in Redis + DB
await Promise.all([
  redis.setEx(`session:${id}`, ttl, JSON.stringify(session)),
  db.sessions.create({ ...session, expiresAt: new Date(Date.now() + ttl * 1000) })
]);

// Cleanup alter DB-Sessions via Cron
await db.sessions.deleteMany({
  expiresAt: { lt: new Date() },
  createdAt: { lt: subMonths(new Date(), 3) } // 3-Monats-Retention
});
```

---

### 4.3 Alternative für Self-Hosted ohne Redis: **DB-Only**

**Falls Kommune Redis ablehnt:**
- Postgres-Session-Store nutzen
- Query-Optimierung (Index auf session_id + expires_at)
- Connection-Pooling optimieren
- Eventuell: pgBouncer für Session-Pooling

**Performance-Tuning:**
```sql
CREATE INDEX idx_sessions_lookup ON iam.sessions(id, expires_at)
WHERE expires_at > NOW();

-- Partitionierung nach Monat für große Installationen
CREATE TABLE iam.sessions_2026_02 PARTITION OF iam.sessions
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

---

## 5. Technische Spezifikation: Redis-Implementierung

### 5.1 Session-Schema in Redis

**Key-Pattern:**
```
session:{sessionId}           -> JSON Session-Objekt
session:user:{userId}:active  -> Set von Session-IDs (für Multi-Device)
session:state:{state}         -> Login-State (PKCE, nur 10 min TTL)
```

**Session-Objekt:**
```typescript
interface Session {
  id: string;
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  createdAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
  // Für Impersonation/Support
  impersonatedBy?: string;
  originalUserId?: string;
}
```

### 5.2 Security-Features

**Encryption at Rest:**
```typescript
import { createCipheriv, createDecipheriv } from 'crypto';

const encrypt = (data: string): string => {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  // ... Verschlüsselung
};

await redis.setEx(
  `session:${id}`,
  ttl,
  encrypt(JSON.stringify(session))
);
```

**Session-Fixation-Schutz:**
```typescript
// Bei Login: Neue Session-ID generieren
const newSessionId = randomUUID();
await deleteSession(oldSessionId); // Alte Session löschen
await createSession({ ...session, id: newSessionId });
```

**IP-Binding (optional):**
```typescript
const session = await getSession(sessionId);
if (session.ipAddress !== request.ip) {
  throw new Error('Session IP mismatch');
}
```

### 5.3 Monitoring & Observability

**Metriken (Prometheus):**
- `session_create_total` (Counter)
- `session_get_duration_seconds` (Histogram)
- `session_active_total` (Gauge)
- `session_expired_total` (Counter)

**Health-Check:**
```typescript
export const healthCheck = async () => {
  try {
    await redis.ping();
    return { status: 'healthy', latency: latency };
  } catch (error) {
    return { status: 'unhealthy', error };
  }
};
```

---

## 6. Migrations-Pfad

### 6.1 Phase 1: Redis lokal (Development)

```bash
# Docker Compose für lokale Entwicklung
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
```

**Code-Änderungen:**
1. `pnpm add redis` in `packages/auth`
2. `session.ts` → `session.redis.ts` mit async Funktionen
3. `auth.server.ts`: Alle Session-Calls `await`
4. `.env.local`: `REDIS_URL=redis://localhost:6379`

### 6.2 Phase 2: Staging (Redis Cloud/Managed)

**Optionen:**
- **Redis Cloud** (free tier für testing)
- **AWS ElastiCache** (wenn AWS-Hosting)
- **Self-Hosted** (Redis auf VM, Ansible-Playbook)

**Config:**
```env
REDIS_URL=redis://:password@redis.staging.sva-studio.de:6379
REDIS_TLS=true
REDIS_CLUSTER_MODE=true
```

### 6.3 Phase 3: Production (HA-Setup)

**Redis Sentinel:**
```yaml
services:
  redis-master:
    image: redis:7-alpine
  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379
  sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

**Client-Code:**
```typescript
import { createClient } from 'redis';

const client = createClient({
  socket: {
    host: process.env.REDIS_SENTINEL_HOST,
    port: 26379
  },
  sentinel: {
    name: 'mymaster',
    sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD
  }
});
```

---

## 7. Alternativen & Trade-offs

### 7.1 Warum nicht Keycloak-Sessions direkt nutzen?

**Idee:** Keycloak als einzige Session-Authority.

**Contra:**
- Keycloak-Sessions sind für SSO optimiert, nicht für App-State
- Keine feingranularen CMS-spezifischen Session-Daten
- Performance-Overhead (HTTP-Call zu Keycloak bei jedem Request)
- Vendor Lock-in (schwer zu migrieren)

**Fazit:** Keycloak für **Authentifizierung**, CMS für **Session-State**.

---

### 7.2 Warum nicht Supabase Auth?

**Idee:** Supabase hat eingebautes Auth-System.

**Contra:**
- Wir nutzen bereits Keycloak (Projektanforderung)
- Supabase Auth ist weniger flexibel für Custom-Flows
- Keine Passkeys/FIDO2-Unterstützung (Stand 2026)

**Fazit:** Supabase nur als **Datenbank**, Keycloak als **IdP**.

---

### 7.3 Warum nicht JWT-only (stateless)?

**Idee:** Nur Access Token, kein Session-Store.

**Contra:**
- Kein Session-Revoke (Logout wirkt erst nach Token-Expiry)
- Refresh-Token-Rotation kompliziert
- Impersonation/Support-Sessions schwierig
- Token-Größe bei vielen Claims (Permissions, Orgs)

**Fazit:** **Hybrid-Ansatz**: Short-Lived Access Token (15 min) + Server-Side-Session für Refresh Token.

---

## 8. Offene Fragen & Next Steps

### 8.1 Zu klären

1. **Redis-Hosting-Strategie:**
   - Managed Service (Redis Cloud, AWS) vs. Self-Hosted?
   - Budget-Freigabe nötig?

2. **Backup & Recovery:**
   - RDB-Snapshots täglich?
   - AOF für Point-in-Time-Recovery?

3. **Monitoring-Stack:**
   - Prometheus + Grafana bereits vorhanden?
   - Alert-Regeln für Session-Store-Ausfälle?

4. **DSGVO-Retention:**
   - Session-Daten nach 30 Tagen löschen?
   - Audit-Log in DB für 90 Tage behalten?

### 8.2 Action Items

- [ ] Redis-Setup in `docker-compose.yml` für lokale Dev
- [ ] `packages/auth/src/session.redis.ts` implementieren
- [ ] Integration-Tests mit Testcontainers
- [ ] Staging-Deployment mit Redis Cloud (Free Tier)
- [ ] Performance-Benchmarks (Session-Lookup < 10 ms)
- [ ] Security-Review (Encryption, Session-Fixation)
- [ ] Dokumentation für Deployment-Team

---

## 9. Fazit & Empfehlung

**Für SVA Studio empfehle ich:**

1. **Jetzt (Milestone 1):** Redis Session Store implementieren
   - Schnell, bewährt, passt zur Architektur
   - Minimale Infrastruktur-Änderung (Redis lokal/Docker)
   - Basis für späteren Permission-Cache

2. **Später (Milestone 3+):** Hybrid Redis + DB
   - Für Audit-Trail & Compliance
   - Session-History für DSGVO-Auskunft
   - Forensik nach Security-Incidents

3. **Fallback:** DB-Only für Self-Hosted ohne Redis
   - Performance-Tuning erforderlich
   - Aber funktional vollständig

**Vorteile für Projekt:**
- ✅ Open Source (Redis ist FOSS)
- ✅ Self-Hosted-fähig (keine Cloud-Pflicht)
- ✅ Skalierbar (Cluster-Mode)
- ✅ DSGVO-konform (Data Residency)
- ✅ BSI-konform (Verschlüsselung, Monitoring)
- ✅ Community-Standard (express-session, connect-redis)

---

**Nächster Schritt:** Implementierungs-Ticket erstellen + Tech-Review im Team.

---

## 10. Stellungnahme (Security & Privacy)

Aus Security-Sicht ist die Redis-Strategie grundsätzlich passend und skalierbar. Vor Umsetzung müssen jedoch Key-Management (KMS/Rotation), Token-Schutz im Session-Store sowie ein verbindliches Retention-/Löschkonzept festgelegt werden, um DSGVO/BSI-Anforderungen zu erfüllen.

---

## 11. Stellungnahme (UX & Accessibility)

**Statement (UX & Accessibility Reviewer):** Die Analyse adressiert UX/A11y nur indirekt. Für die Umsetzung sollten klare Session-Timeout- und Re-Login-Flows mit barrierefreien Hinweisen (Screenreader-Text, Fokus-Management, eindeutige Fehlermeldungen) verbindlich ergänzt werden, damit Nutzer:innen nicht unerwartet aus Sitzungen fallen.

---

## 12. Stellungnahme (Operations & Reliability)

**Statement (Operations & Reliability Reviewer):** Die Analyse benennt Redis als zentrale Betriebsabhängigkeit, aber es fehlen konkrete Runbooks, RTO/RPO‑Ziele, Backup/Restore‑Verfahren und ein belastbarer HA‑Plan (Sentinel/Cluster) inkl. Monitoring/Alerting. Für einen 24/7‑Betrieb müssen diese Punkte verbindlich festgelegt und getestet werden (insb. Failover‑Tests, Restore‑Drills, Ressourcen‑Sizing).

---

## 13. Stellungnahme (Interoperabilität & Daten)

**Statement (Interoperability & Data Reviewer):** Die Analyse ist technisch schlüssig, adressiert aber Interoperabilität nur indirekt. Für Wechsel- und Migrationsfähigkeit fehlen klare Vorgaben zu Export/Import von Sessions/Audit-Daten, Versionierung der Auth-API sowie ein dokumentierter Deprecation‑Pfad. Ohne diese Standards ist die Exit‑Fähigkeit eingeschränkt und ein Anbieterwechsel risikobehaftet.

---

## 14. Stellungnahme (Architektur & FIT)

**Statement (Architecture & FIT Compliance Reviewer):** Die Redis-Empfehlung ist aus Skalierungs- und API‑First‑Sicht plausibel und kompatibel mit dem Headless‑Ansatz. Für FIT‑Konformität fehlen jedoch explizite ADRs zur Abgrenzung Keycloak vs. CMS‑IAM, zum Vendor‑Lock‑in‑Risiko (Redis/Keycloak) sowie zu offenen Standards (OIDC/SAML/SCIM‑Erweiterungen). Diese Entscheidungen sollten dokumentiert werden, um Abweichungen nachvollziehbar zu machen.
