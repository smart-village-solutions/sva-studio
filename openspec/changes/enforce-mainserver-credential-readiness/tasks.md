## 1. Credential-Vertrag und Provisioning

- [x] 1.1 Vorhandene Statusableitung auf `ready`, `missing`, `partial`, `stale`
      und `unavailable` vereinheitlichen; Secretwerte nur im internen
      `ready`-Zweig halten
- [x] 1.2 Vollständige kanonische und Legacy-Paare sowie leere, gemischte und
      partielle Attribute mit Units charakterisieren
- [x] 1.3 Gemeinsame Normalisierung und Fingerprint-Erzeugung für erwarteten
      Write und Read-back verwenden
- [x] 1.4 Create, Einzel- und Bulk-Reprovisionierung nach dem bestehenden Write
      instanzgebunden zurücklesen und nur bei passender Version als erfolgreich
      melden
- [x] 1.5 Lokalen Account und getrennte Providererfolgsevidenz bei Read-back-
      Fehlern erhalten

## 2. Projection-Gate und Cooldown

- [x] 2.1 An der bestehenden Projection-Source-/Binding-Grenze Readiness vor
      dem ersten Mainserver-Aufruf prüfen
- [x] 2.2 Nicht bereite Zustände mit stabilen Fehlercodes persistieren und
      vorhandene Snapshots ohne Finalisierung oder Löschabgleich erhalten
- [x] 2.3 Pure Fälligkeitsfunktion aus `last_error_code`, `last_failed_at`,
      Trigger und Uhrzeit ergänzen
- [x] 2.4 `missing`, `partial` und `stale` frühestens nach 15 Minuten erneut
      prüfen; transienten technischen Retry beibehalten
- [x] 2.5 Call-Count-null-, Zwei-Principal-, Snapshot-Erhalt-, Fake-Time-,
      Force- und Prozessneustarttests ergänzen
- [x] 2.6 STOP: Falls Gate oder Cooldown eine neue öffentliche Adapter-API oder
      Schemaänderung benötigen, Design vor der Umsetzung neu freigeben lassen

## 3. Dokumentation und PR-Abnahme

- [x] 3.1 Aktive Rollen- und Ownership-Changes beim Rebase auf Vertragskonflikte
      prüfen
- [x] 3.2 Arc42 04, 05, 06 und 08 prüfen und nur betroffene Aussagen sowie das
      Mainserver-Runbook aktualisieren
- [x] 3.3 Fokussierte Unit-, Type- und Server-Runtime-Gates ausführen; vor einem
      breiten Lauf den affected Scope messen
- [x] 3.4 OpenSpec-, Dokumentations- und Placement-Checks lokal ausführen
- [ ] 3.5 Den exakten PR-HEAD über GitHub-Gates belegen

Production-Verifikation und Rollout-Abnahme sind in
`verify-mainserver-credential-readiness-rollout` verschoben.
