# Security & Architecture Compliance Review: Redis Session Store

**Datum:** 4. Februar 2026
**Reviewer:** AI Assistant
**Status:** ⚠️ **TEILWEISE KONFORM** – Kritische Sicherheitslücken identifiziert

---

## Executive Summary

Die Redis-Session-Store-Implementierung ist **architektonisch korrekt** und passt zur geplanten Gesamtarchitektur (IAM mit Redis Permission Cache). Sie weist jedoch **kritische Sicherheitsmängel** auf, die vor Production-Einsatz behoben werden müssen.

### Bewertung nach Kategorien

| Kategorie | Status | Priorität | Details |
|-----------|--------|-----------|---------|
| **Architektur-Konformität** | ✅ **KONFORM** | - | Passt zu IAM-Konzept (Redis für Permissions + Sessions) |
| **Token-Sicherheit** | ❌ **NICHT KONFORM** | 🔴 **CRITICAL** | Access/Refresh/ID-Tokens unverschlüsselt in Redis |
| **Session-Management** | ⚠️ **TEILWEISE** | 🟡 **HIGH** | TTL vorhanden, aber keine Revocation-API |
| **Zugriffskontrolle** | ❌ **NICHT KONFORM** | 🔴 **CRITICAL** | Redis ohne Authentifizierung/Verschlüsselung |
| **Datenschutz (DSGVO)** | ⚠️ **TEILWEISE** | 🟡 **HIGH** | Keine Audit-Logs, keine Löschgarantie |
| **BSI IT-Grundschutz** | ❌ **NICHT KONFORM** | 🔴 **CRITICAL** | Keine TLS, keine Access-Controls, kein Monitoring |
| **Cookie-Problem** | ⚠️ **OFFEN** | 🔴 **CRITICAL** | Framework-Limitation blockiert Cookie-Transport |

---

## 1. Architektur-Konformität ✅

### Positiv: Passt zur Gesamt-Architektur

Die Implementierung ist **vollständig konform** mit dem IAM-Architekturkonzept:

**Aus `Umsetzung-Rollen-Rechte.md`:**
```
[IAM-DB (Postgres)] <--> [Permission Cache (Redis)]
                     \
                      \--> [Analytics/Reporting]
```

**Unsere Implementierung:**
```
[Auth Service] --> [Redis Session Store] (Sessions mit TTL)
                      ↓
               [Permission Cache] (geplant für Berechtigungen)
```

**✅ Konform:**
- Redis wird bereits für Permission Cache geplant → Sessions im selben Redis-Cluster = konsistent
- Gleiche Infrastruktur, Monitoring, Backup-Strategie
- Trennung: Sessions ≠ Permissions (unterschiedliche Key-Prefixes: `session:*` vs. geplant `perm:*`)

### Positiv: Skalierbarkeit

**Anforderung aus `Milestone_01.md`:**
> "Horizontal skalierbar für Multi-Instance-Betrieb"

**✅ Erfüllt:**
- Redis-basierte Sessions ermöglichen Multi-Instance-Deployment
- Keine In-Memory-Abhängigkeit mehr
- Loadbalancer kann Requests auf beliebige Instanzen verteilen

---

## 2. Token-Sicherheit ❌ KRITISCH

### Problem: Unverschlüsselte Token-Speicherung

**Aus `Sicherheit-Datenschutz.md`, Kap. 3.1:**
> - Verschlüsselung at Rest: Datenbank-Verschlüsselung (Transparent Data Encryption)
> - Ende-zu-Ende-Verschlüsselung für besonders sensible Daten

**Aktuelle Implementierung (`redis-session.server.ts`):**
```typescript
await createSession(sessionId, {
  userId: user.id,
  accessToken: tokenSet.access_token,      // ❌ KLARTEXT in Redis!
  refreshToken: tokenSet.refresh_token,    // ❌ KLARTEXT in Redis!
  idToken: tokenSet.id_token,              // ❌ KLARTEXT in Redis!
  // ...
});
```

**Risiko:**
- **CRITICAL:** Bei Redis-Kompromittierung (z.B. Netzwerk-Sniffing, Memory-Dump, Backup-Leak) sind alle Tokens lesbar
- Access-Tokens erlauben Identitätswechsel
- Refresh-Tokens erlauben langfristige Token-Erneuerung
- ID-Tokens enthalten persönliche Daten (Email, Name, Rollen)

### Erforderliche Maßnahmen

**1. Token-Verschlüsselung (MANDATORY):**
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY!; // 32 Byte AES-256
const ALGORITHM = 'aes-256-gcm';

function encryptToken(token: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final()
  ]);

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

function decryptToken(encrypted: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
```

**2. Separate Token-Storage (RECOMMENDED):**
```typescript
// Sessions: Nur Metadaten
type Session = {
  userId: string;
  createdAt: string;
  expiresAt: string;
  tokenRef: string;  // Referenz zu verschlüsseltem Token-Storage
};

// Tokens: Separater, verschlüsselter Key
await redis.set(
  `tokens:${sessionId}`,
  JSON.stringify({
    accessToken: encryptToken(tokenSet.access_token),
    refreshToken: encryptToken(tokenSet.refresh_token),
    idToken: encryptToken(tokenSet.id_token),
  }),
  'EX',
  ttl
);
```

**3. Key-Rotation (RECOMMENDED):**
```typescript
// Unterstütze mehrere Encryption-Keys für nahtlose Rotation
const CURRENT_KEY_VERSION = 2;
const ENCRYPTION_KEYS = {
  1: process.env.SESSION_KEY_V1,
  2: process.env.SESSION_KEY_V2,
};
```

---

## 3. Redis-Zugriffskontrolle ❌ KRITISCH

### Problem: Keine Authentifizierung/Verschlüsselung

**Aktuelle Konfiguration (`redis.server.ts`):**
```typescript
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
// ❌ Keine TLS
// ❌ Kein Passwort
// ❌ Kein ACL
```

**BSI IT-Grundschutz-Anforderungen (aus `Sicherheit-Datenschutz.md`):**
> - TLS 1.3 für alle externen Verbindungen
> - Principle of Least Privilege: Minimale Rechte für alle Accounts
> - Zugriffskontrollen: MFA für administrative Zugriffe

### Erforderliche Maßnahmen

**1. TLS-Verschlüsselung (MANDATORY):**
```typescript
const redisUrl = process.env.REDIS_URL || 'rediss://localhost:6379'; // 's' = TLS

redisClient = new Redis(redisUrl, {
  tls: {
    rejectUnauthorized: true,
    ca: readFileSync('./certs/redis-ca.crt'),
  },
  // ...
});
```

**2. Redis ACL (MANDATORY):**
```bash
# redis.conf oder via CLI
ACL SETUSER cms-sessions on >StrongPassword123! ~session:* ~login_state:* +@read +@write +@connection -@admin
```

```typescript
const redisUrl = process.env.REDIS_URL || 'rediss://cms-sessions:PASSWORD@localhost:6379';
```

**3. Network Segmentation (RECOMMENDED):**
```yaml
# docker-compose.yml
services:
  redis:
    networks:
      - backend
    # Nicht in "frontend" Network!
```

**4. Firewall-Regeln (MANDATORY für Production):**
```bash
# Nur CMS-Backend darf auf Redis zugreifen
iptables -A INPUT -p tcp --dport 6379 -s 10.0.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP
```

---

## 4. Session-Management ⚠️

### Positiv: TTL-basierte Expiration

**✅ Konform mit `Sicherheit-Datenschutz.md`:**
> Session-Management mit automatischem Timeout (30 Minuten Inaktivität)

**Implementiert:**
```typescript
const DEFAULT_SESSION_TTL = 60 * 60 * 24 * 7; // 7 Tage
const DEFAULT_LOGIN_STATE_TTL = 60 * 10;      // 10 Minuten
```

**⚠️ Probleme:**
1. **7 Tage zu lang für inaktive Sessions** → sollte max. 24h sein
2. **Keine Sliding-Window** → Session läuft auch bei aktiver Nutzung ab
3. **Keine Inaktivitäts-Detection** → 30-Minuten-Timeout aus Anforderungen fehlt

### Fehlt: Session-Revocation

**Anforderung aus `Umsetzung-Rollen-Rechte.md`:**
> "Batch-Job im IAM, der anhand `lastLogin` und `status` automatisch Accounts auf „inactive" setzt, Keycloak-User disabled & **Sessions revoked**"

**Nicht implementiert:**
```typescript
// ❌ Fehlt: Manuelle Session-Revocation
export async function revokeAllUserSessions(userId: string): Promise<void>

// ❌ Fehlt: Admin-API zum Beenden von Sessions
export async function revokeSession(sessionId: string, reason: string): Promise<void>

// ❌ Fehlt: Logout von allen Geräten
export async function logoutEverywhere(userId: string): Promise<void>
```

### Erforderliche Maßnahmen

**1. Sliding Window TTL (MANDATORY):**
```typescript
export async function refreshSessionActivity(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  const INACTIVITY_TIMEOUT = 30 * 60; // 30 Minuten
  await redis.expire(`session:${sessionId}`, INACTIVITY_TIMEOUT);
}
```

**2. Session-Revocation API (MANDATORY):**
```typescript
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const pattern = `session:*`;
  const keys = await redis.keys(pattern);

  let revoked = 0;
  for (const key of keys) {
    const session = await redis.get(key);
    if (session && JSON.parse(session).userId === userId) {
      await redis.del(key);
      revoked++;
    }
  }

  return revoked;
}
```

**3. Revocation-Logging (REQUIRED für Audit):**
```typescript
await auditLog.create({
  action: 'SESSION_REVOKED',
  userId,
  sessionId,
  reason: 'Admin forced logout',
  timestamp: new Date().toISOString(),
});
```

---

## 5. DSGVO-Konformität ⚠️

### Fehlt: Audit-Logging

**Anforderung aus `Sicherheit-Datenschutz.md`, Kap. 3.1:**
> - Zentrale Protokollierung aller sicherheitsrelevanten Ereignisse
> - Log-Retention mindestens 6 Monate (besser 1 Jahr)
> - Integritätsschutz der Logs (Write-Once-Read-Many)

**Nicht implementiert:**
- ❌ Keine Logs bei Session-Erstellung
- ❌ Keine Logs bei Session-Zugriff
- ❌ Keine Logs bei Session-Revocation
- ❌ Keine Logs bei Failed-Login (Login-State-Consumption)

### Fehlt: Daten-Löschgarantie

**DSGVO Art. 17 (Recht auf Löschung):**
> Betroffene Personen haben das Recht, unverzüglich die Löschung sie betreffender personenbezogener Daten zu verlangen.

**Problem:**
- Redis-TTL garantiert **keine sofortige Löschung**
- Bei User-Deletion müssen alle Sessions **manuell gelöscht** werden
- Keine API für "GDPR-compliant user deletion"

### Erforderliche Maßnahmen

**1. Audit-Logging (MANDATORY):**
```typescript
import { createAuditLog } from '../audit/audit.server';

export async function createSession(sessionId: string, session: Session): Promise<void> {
  await redis.set(key, JSON.stringify(session), 'EX', ttl);

  await createAuditLog({
    eventType: 'SESSION_CREATED',
    userId: session.userId,
    sessionId,
    metadata: { ttl, expiresAt: session.expiresAt },
    ipAddress: request.ip,
    userAgent: request.headers.get('User-Agent'),
  });
}
```

**2. GDPR-Deletion-API (MANDATORY):**
```typescript
export async function deleteAllUserData(userId: string): Promise<{
  sessionsDeleted: number;
  loginStatesDeleted: number;
  auditLogsArchived: number;
}> {
  // Sessions löschen
  const sessionKeys = await redis.keys(`session:*`);
  let sessionsDeleted = 0;
  for (const key of sessionKeys) {
    const session = await redis.get(key);
    if (session && JSON.parse(session).userId === userId) {
      await redis.del(key);
      sessionsDeleted++;
    }
  }

  // Login States löschen (falls user-verknüpft)
  // ...

  // Audit-Logs archivieren (nicht löschen! Compliance!)
  const auditLogs = await archiveUserAuditLogs(userId);

  return { sessionsDeleted, loginStatesDeleted, auditLogsArchived: auditLogs.length };
}
```

---

## 6. Cookie-Transport-Problem ⚠️ KRITISCH

### Framework-Limitation blockiert Cookie-basierte Sessions

**Problem bereits dokumentiert in `technical-findings.md`:**
> TanStack Router/Start interceptiert SSR-Responses und transmittiert Set-Cookie Headers nicht zum Browser.

**Auswirkung auf Sicherheit:**
- ❌ Ohne Cookie-Transport sind Sessions **nicht nutzbar**
- ❌ Alternative Mechanismen (URL, LocalStorage) haben **Sicherheitsrisiken**

### Risiko-Analyse alternativer Transport-Mechanismen

| Mechanismus | Sicherheit | Compliance | Implementierbarkeit |
|-------------|-----------|------------|---------------------|
| **Cookies** | ✅ Best Practice | ✅ BSI-konform | ❌ Framework blockiert |
| **URL-Parameter** | ❌ Session-ID in Logs/History | ❌ DSGVO-kritisch | ✅ Einfach |
| **LocalStorage** | ❌ XSS-anfällig | ⚠️ Akzeptabel mit CSP | ✅ Einfach |
| **SessionStorage** | ⚠️ XSS-anfällig, aber kurzlebig | ⚠️ Akzeptabel | ✅ Einfach |
| **Custom Header** | ✅ Sicher bei HTTPS + CORS | ✅ Konform | ⚠️ Komplex (Pre-Flight) |

### Empfohlene Lösung (unter Vorbehalt)

**SessionStorage + Custom Header + CSRF-Token:**

```typescript
// Client-Side (nach OAuth-Callback)
sessionStorage.setItem('sva_session_id', sessionId);

// Bei jedem Request
const sessionId = sessionStorage.getItem('sva_session_id');
const csrfToken = sessionStorage.getItem('sva_csrf_token');

fetch('/api/data', {
  headers: {
    'X-Session-ID': sessionId,
    'X-CSRF-Token': csrfToken,
  },
});
```

**Server-Side Validierung:**
```typescript
// CSRF-Protection
if (request.method !== 'GET' && !validateCSRFToken(request)) {
  throw new Error('CSRF validation failed');
}

// Session-ID aus Custom Header
const sessionId = request.headers.get('X-Session-ID');
if (!sessionId) {
  throw new Error('Unauthorized');
}
```

**⚠️ ABER: Dies widerspricht Best Practices!**
- Cookies sind der **standardisierte, sichere Mechanismus**
- Custom Headers erfordern zusätzliche CORS-Konfiguration
- SessionStorage ist XSS-anfällig (erfordert strikte CSP)

**Empfehlung:**
1. **Kurzfristig:** SessionStorage + Custom Header als Workaround
2. **Mittelfristig:** Framework-Update auf TanStack Router-Version mit Cookie-Support abwarten
3. **Langfristig:** Ggf. Framework-Migration prüfen (Next.js, Remix, SvelteKit)

---

## 7. Monitoring & Observability ❌

### Fehlt: Production-Monitoring

**Anforderung aus `Sicherheit-Datenschutz.md`, Kap. 3.1:**
> - SIEM-Integration (Security Information and Event Management)
> - Automatische Alarmierung bei Sicherheitsvorfällen

**Nicht implementiert:**
- ❌ Keine Metriken (Sessions pro Minute, Fehlerrate)
- ❌ Keine Alerts (Redis-Down, hohe Session-Creation-Rate = möglicher Angriff)
- ❌ Keine Health-Checks
- ❌ Keine Dashboards

### Erforderliche Maßnahmen

**1. Prometheus-Metriken (RECOMMENDED):**
```typescript
import { Counter, Gauge, Histogram } from 'prom-client';

const sessionCreations = new Counter({
  name: 'sessions_created_total',
  help: 'Total number of sessions created',
});

const activeSessions = new Gauge({
  name: 'sessions_active',
  help: 'Number of active sessions',
  async collect() {
    const count = await getSessionCount();
    this.set(count);
  },
});

const sessionLatency = new Histogram({
  name: 'session_operation_duration_seconds',
  help: 'Session operation latency',
  labelNames: ['operation'],
});
```

**2. Health-Check-Endpoint (MANDATORY):**
```typescript
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  redis: boolean;
  activeSessions: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Redis-Verbindung testen
  let redisHealthy = false;
  try {
    await redis.ping();
    redisHealthy = true;
  } catch (error) {
    errors.push(`Redis unavailable: ${error.message}`);
  }

  // Session-Count prüfen
  let activeSessions = 0;
  try {
    activeSessions = await getSessionCount();
  } catch (error) {
    errors.push(`Session count failed: ${error.message}`);
  }

  const status = errors.length === 0 ? 'healthy' :
                 redisHealthy ? 'degraded' : 'unhealthy';

  return { status, redis: redisHealthy, activeSessions, errors };
}
```

---

## 8. Zusammenfassung & Handlungsempfehlungen

### Kritische Sicherheitslücken (MUST FIX vor Production)

| # | Problem | Impact | Aufwand | Deadline |
|---|---------|--------|---------|----------|
| 1 | **Unverschlüsselte Tokens in Redis** | 🔴 CRITICAL | 2-3 Tage | VOR Staging |
| 2 | **Keine Redis-Authentifizierung/TLS** | 🔴 CRITICAL | 1 Tag | VOR Staging |
| 3 | **Cookie-Transport blockiert** | 🔴 CRITICAL | 3-5 Tage | VOR Staging |
| 4 | **Keine Session-Revocation** | 🟡 HIGH | 1 Tag | VOR Production |
| 5 | **Keine Audit-Logs** | 🟡 HIGH | 2-3 Tage | VOR Production |
| 6 | **Keine GDPR-Deletion-API** | 🟡 HIGH | 1 Tag | VOR Production |
| 7 | **Kein Monitoring** | 🟢 MEDIUM | 2 Tage | VOR Production |

### Empfohlene Reihenfolge

**Phase 1: Grundlegende Sicherheit (VOR Staging-Deployment)**
1. Redis TLS + Authentifizierung aktivieren
2. Token-Verschlüsselung implementieren
3. Cookie-Transport-Problem lösen (SessionStorage-Workaround)

**Phase 2: Compliance (VOR Production-Deployment)**
4. Audit-Logging hinzufügen
5. Session-Revocation-API implementieren
6. GDPR-Deletion-API implementieren
7. Health-Checks + Monitoring

**Phase 3: Optimierungen (nach Production-Launch)**
8. Sliding-Window-TTL
9. Prometheus-Metriken
10. Framework-Migration evaluieren (Cookie-Problem langfristig)

### Geschätzter Gesamtaufwand

- **Critical Fixes (Phase 1):** 6-9 Arbeitstage
- **Compliance (Phase 2):** 5-7 Arbeitstage
- **Monitoring (Phase 3):** 2-3 Arbeitstage

**TOTAL:** ~3 Wochen (1 Senior-Developer)

---

## 9. Architektur-Empfehlungen

### Positiv: Architektur ist grundsätzlich richtig

✅ Redis-basierte Sessions passen perfekt zur IAM-Architektur
✅ Skalierbarkeit gewährleistet
✅ Trennung Session-Store ↔ Permission-Cache sauber

### Verbesserungsvorschläge

**1. Hybrid-Ansatz: Redis + DB**
```
[Redis] → Hot-Storage (aktive Sessions, 24h TTL)
    ↓
[PostgreSQL] → Cold-Storage (Audit-Trail, lange Retention)
```

**2. Token-Refresh-Strategie**
- Access-Token nicht in Redis speichern (Keycloak als Single Source of Truth)
- Nur Refresh-Token verschlüsselt speichern
- Access-Token bei jedem Request frisch von Keycloak holen

**3. Multi-Layer-Security**
```
Layer 1: TLS (Transport)
Layer 2: Redis ACL (Access Control)
Layer 3: Token-Verschlüsselung (Data at Rest)
Layer 4: Audit-Logging (Detection)
```

---

## 10. Fazit

**Status: ⚠️ NICHT PRODUKTIONSREIF**

Die Redis-Session-Store-Implementierung ist **architektonisch korrekt** und ein wichtiger Schritt Richtung skalierbarem IAM. Sie erfüllt jedoch **kritische Sicherheitsanforderungen nicht** und ist in der aktuellen Form **nicht für Production geeignet**.

**Empfehlung:**
1. ✅ Weiterarbeit an Redis-Implementation
2. ❌ **KEIN Staging-Deployment** ohne Fixes aus Phase 1
3. ⚠️ Cookie-Problem **dringend lösen** (Blocker für gesamte Auth-Flow)
4. 📋 Security-Roadmap erstellen mit Meilensteinen

**Next Steps:**
1. Dieses Review mit Team besprechen
2. Entscheidung: Framework-Workaround vs. Framework-Migration
3. Security-Tasks in Backlog priorisieren
4. Penetration-Test nach Phase 2

---

**Kontakt für Rückfragen:** Security-Team, Architektur-Board
