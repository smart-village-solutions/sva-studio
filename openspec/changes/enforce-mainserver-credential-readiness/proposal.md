# Change: Mainserver-Credential-Readiness erzwingen

## Why

Production hat für `bb-bad-belzig` und `bb-prignitz` wiederholt Content-
Projektionen und Benutzer-Provisionierungen gestartet, obwohl erforderliche
Mainserver-Attribute fehlten. Der vorhandene Reader erkennt vollständige und
partielle Attribute, reduziert die Information vor den Consumern aber auf
einen groben Fehler. Nach einem Keycloak-Write fehlt zudem der kanonische
Read-back; der Projection-Scheduler wiederholt dauerhafte Fehler jede Minute.

Die Reparatur muss principalgenau bleiben: Ein fehlerhafter persönlicher oder
organisatorischer Credential-Scope darf weder andere Principals noch lokale
Accounts oder vorhandene Projection-Snapshots blockieren.

## What Changes

- Der vorhandene Credential-Reader gibt `ready`, `missing`, `partial`, `stale`
  und `unavailable` ohne Secretwerte zurück.
- Create-, Einzel- und Bulk-Provisionierung melden Mainserver-Erfolg erst nach
  einem vollständigen instanzgebundenen Read-back der geschriebenen Version.
- Die vorhandene Projection-Quellgrenze stoppt nicht bereite Scopes vor dem
  ersten Mainserver-Aufruf.
- Der vorhandene Projection-Sync-State drosselt `missing`, `partial` und
  `stale` auf eine Kontrollprobe frühestens nach 15 Minuten.
- Fokussierte Tests decken fehlende, partielle, veraltete und vollständige
  Credentials ab.

## Scope Boundaries

- Keine neue Tabelle, kein neuer Scheduler und keine neue allgemeine Audit-
  Infrastruktur.
- Kein automatischer Recovery-Hook zwischen IAM und Projection; nach
  Reprovisionierung greifen manueller Refresh oder die nächste fällige Probe.
- Keine neuen Metriken und keine spekulative Änderung der Mainserver-Fassade.
- Kein Root-, Shared- oder fremder Principal-Fallback.
- Keine Accountdeaktivierung, Passwortänderung oder Credential-Rotation.
- Keine Production-Verifikation oder Rollout-Abnahme; diese erfolgt im
  separaten Folge-Change `verify-mainserver-credential-readiness-rollout`.

## Coordination and Impact

- `extend-keycloak-realm-role-assignments` bleibt Eigentümer der initialen
  Mainserver-Rolle; dieser Change ändert nur Credential-Erfolg und Read-back.
- `add-content-ownership-transfer` bleibt Eigentümer von DataProvider-Bindung
  und Ownership; Readiness begründet keine Ownership.
- Betroffene Specs: `iam-core`, `sva-mainserver-integration`.
- Betroffener Code: bestehende Credential-Reader und IAM-Provisionierung in
  `packages/auth-runtime` sowie bestehende Projection-Source-/Sync-Pfade in
  `apps/sva-studio-react`.
- Gemäß IAM-Dokumentationsregel werden arc42 04, 05, 06 und 08 geprüft und nur
  tatsächlich betroffene Aussagen geändert. Das bestehende Mainserver-Runbook
  wird aktualisiert; eine neue ADR wird nur angelegt, falls die Umsetzung ein
  neues IAM-Pattern statt einer Präzisierung des bestehenden Musters erzeugt.
