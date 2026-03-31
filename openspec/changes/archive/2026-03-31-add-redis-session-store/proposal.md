# Change: Redis-basierte Session-Persistenz für App-Sessions konsolidieren

## Why
Die frühere In-Memory-Session-Logik verlor Sitzungen bei Restarts und war nicht horizontal skalierbar. Inzwischen ist die technische Grundlage für Redis-basierte App-Sessions weitgehend umgesetzt, der OpenSpec-Change bildet den tatsächlichen Scope aber nicht mehr sauber ab.

Zusätzlich wurden Session-Lifecycle, Forced Reauth und Silent SSO inzwischen separat präzisiert. Dieser Change soll deshalb nicht länger ein Sammelbecken für Compliance-, Audit-, Operations- und Post-Launch-Themen sein, sondern nur noch die Redis-basierte Session-Persistenz als technische Basis konsistent beschreiben.

## What Changes
- Konsolidiert Redis als persistenten, geteilten Store für aktive App-Sessions.
- Verankert, dass Redis-TTL aus der fachlich führenden `Session.expiresAt`-Gültigkeit abgeleitet wird.
- Verankert verschlüsselte Token-Persistenz, abgesicherte Redis-Anbindung und explizite Session-Invalidierung als Kernumfang.
- Definiert `Self-Hosted Redis` als Betriebsmodell für Staging.
- Definiert für den ersten Produktionsschnitt bewusst `Single Redis mit Backup/Restore` statt eines HA-Clusters.
- Nimmt Audit-, GDPR-, Monitoring- und betriebliche Folgearbeiten wieder in denselben Change auf, statt sie auszulagern.

## Impact
- Affected specs: `iam-core`
- Affected code: `packages/auth`, Runtime-/Deployment-Konfiguration für Redis
- **BREAKING**: keine
