## 1. Vertrag und Sicherheitsgates

- [x] 1.1 Den versionierten Restore-Request, die kanonische Signatur und strikte Schema-Validierung implementieren.
- [x] 1.2 OIDC-, Restore-Workflow-, Environment-, HMAC-, Ablaufzeit- und Request-ID-Replay-Prüfungen implementieren.
- [x] 1.3 Umgebungs-, Bucket-, Präfix-, Datenbank- und `pg_restore`-Option-Allowlist implementieren.

## 2. Agent und Workflow

- [x] 2.1 Read-only Restore-Preflight mit Objekt-, SHA-256-, Archiv- und Schema-Prüfung implementieren.
- [x] 2.2 Frischen, verifizierten Sicherheitsdump vor der Restore-Mutation implementieren.
- [x] 2.3 Dedizierten Restore-Principal sowie kontrollierte App-Stilllegung mit Session-Drain implementieren.
- [x] 2.4 Deterministischen Vollrestore-Executor mit festem Ziel und ohne automatische Fortsetzung oder Wiederholung implementieren.
- [x] 2.5 Dedizierten GitHub-Actions-Workflow mit geschütztem Environment, Wartungsfenster und ausdrücklicher Freigabe implementieren.

## 3. Verifikation und Tests

- [x] 3.1 Redigierte MinIO-Evidenz für Request, Sicherheitsdump und Ergebnis implementieren.
- [x] 3.2 Post-Restore-Prüfungen für Goose, IAM-Schema, App-Principal, Registry, Health und einen Tenant-Redirect implementieren.
- [x] 3.3 Unit-, Vertrags-, Integrations- und Staging-Drill-Tests für Erfolg, Replay, falsche Umgebung, falsche Prüfsumme, abgelaufenen Auftrag, fehlende App-Stilllegung, aktive Sessions und Post-Restore-Fehler ergänzen.

## 4. Dokumentation und Rollout

- [x] 4.1 ADR-048 und Swarm-Runbook aktualisieren, ohne einen konkurrierenden Standard-Deploypfad zu definieren.
- [x] 4.2 arc42-Abschnitte 06, 07, 08, 09 und 11 aktualisieren.
- [ ] 4.3 Restore nur nach erfolgreichem Staging-Drill und expliziter Production-Freigabe aktivieren.
