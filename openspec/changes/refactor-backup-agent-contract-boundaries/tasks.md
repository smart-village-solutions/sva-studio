## 1. Vertrag charakterisieren

- [x] 1.1 Bestehende Backup-v1/v2-, Restore-v1- und Waste-Import-v1-Entscheidungen als Negativmatrix für unbekannte Felder, Version/Aktion, Umgebung, Datenbank/Tenant, Ablaufzeit, SHA-256, Präfix und Pfadtraversal festhalten.
- [x] 1.2 Die Matrix vor der Extraktion gegen `deploy/backup-agent/agent.mjs` grün ausführen.

## 2. Validierungsgrenzen extrahieren

- [x] 2.1 Reine Validatoren und diskriminierte Ergebnisgrenzen in ein ESM-Modul extrahieren.
- [x] 2.2 `validRequest` und `validRestoreRequest` als kompatible boolesche Fassaden erhalten.
- [x] 2.3 Sicherstellen, dass OIDC, Replay-Schutz, Signaturprüfung, Digest/SHA, Buckets, Präfixe und Restore-Ausführung unverändert bleiben.
- [x] 2.4 Alle relativen Runtime-Imports mit `.mjs` schreiben und die Module explizit in das Container-Image übernehmen.

## 3. Dokumentation

- [x] 3.1 Das Restore-Runbook um die internen Validierungsgrenzen und den unveränderten Operatorvertrag ergänzen.
- [x] 3.2 Die betroffenen arc42-Baustein-, Laufzeit- und Security-Sichten aktualisieren.

## 4. Verifikation

- [x] 4.1 Unit-, Backup-Agent-Integrations-, Skript-Typ- und Server-Runtime-Gates ausführen.
- [x] 4.2 Complexity-Gate und Fallow-Health-Vergleich ohne Suppression ausführen.
- [x] 4.3 `openspec validate refactor-backup-agent-contract-boundaries --strict` ausführen.
- [x] 4.4 Wenn vertretbar `pnpm test:pr` vor dem Push ausführen und ausgelassene breite Gates transparent dokumentieren.
