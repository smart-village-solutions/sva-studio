# Change: Session-Lifecycle, Forced Reauth und Silent SSO vereinheitlichen

## Why
Der bestehende Auth-Flow war funktional, aber die fachliche Session-Gültigkeit war über Token-Ablauf, Redis-TTL und Browser-Cookie nicht eindeutig modelliert. Zusätzlich fehlten ein deterministischer Forced-Reauth-Mechanismus pro Benutzer und ein kontrollierter Silent-SSO-Recovery-Pfad nach `401`.

## What Changes
- Definiert `Session.expiresAt` als führende fachliche Wahrheit für App-Sessions.
- Koppelt Cookie-Laufzeit und Redis-TTL an die verbleibende Sessiondauer statt an unabhängige Defaults.
- Ergänzt Session-Versionierung und benutzerbezogene Reauth-Steuerung für erzwungenen Re-Login.
- Führt einen kontrollierten Silent-SSO-Flow über `/auth/login?silent=1` und iframe-sicheren Callback ein.
- Ergänzt Audit-Ereignisse für Forced Reauth sowie erfolgreiche und fehlgeschlagene Silent-Reauth-Versuche.
- Synchronisiert Arc42, ADR und Paketdokumentation auf das neue Session-Modell.

## Impact
- Affected specs: `iam-core`, `routing`, `iam-auditing`
- Affected code: `packages/auth`, `apps/sva-studio-react`
- Affected arc42 sections: `04-solution-strategy`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
