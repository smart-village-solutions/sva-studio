# Stagehand Admin Exploration

Dieses Dokument beschreibt die lokale, nicht blockierende Stagehand-Schicht für explorative IAM-Admin-Läufe in `apps/sva-studio-react`.

## Zweck und Einordnung

- `pnpm nx run sva-studio-react:test:explore:admin` ist ein lokaler Explorationslauf für reale IAM-Admin-Pfade.
- Die Schicht ergaenzt `test:e2e` und `test:acceptance`, ersetzt sie aber nicht.
- Die Schicht ist bewusst local-first und nicht Teil eines verpflichtenden PR- oder CI-Gates.

## Voraussetzungen

- Die lokale Studio-App läuft und ist über die konfigurierte Base-URL erreichbar.
- Der echte lokale IAM-/Backend-Stack ist bereit.
- Ein gültiger `OPENAI_API_KEY` ist gesetzt, auch wenn der Pilot-Runner aktuell nur den bestehenden Env-Vertrag vorbereitet.
- Dedizierte Admin-Credentials für den lokalen Lauf sind vorhanden.

## Umgebungsvariablen

- `STAGEHAND_ADMIN_BASE_URL` oder `IAM_ACCEPTANCE_BASE_URL`
  - Basisadresse der lokal laufenden Studio-App, zum Beispiel `http://127.0.0.1:3000`
- `STAGEHAND_ADMIN_USERNAME` oder `IAM_ACCEPTANCE_ADMIN_USERNAME`
  - dedizierter Admin-Benutzer für den Explorationslauf
- `STAGEHAND_ADMIN_PASSWORD` oder `IAM_ACCEPTANCE_ADMIN_PASSWORD`
  - Passwort für diese Testidentität
- `STAGEHAND_ADMIN_MISSION`
  - optional; nur für den Legacy-Einzelmissionsmodus relevant
- `STAGEHAND_RUN_MODE`
  - optional; `story-loop` für den Voll-Lauf oder `mission` für den Legacy-Einzelmissionsmodus
- `STAGEHAND_STORY_IDS`
  - optionale CSV-Liste gezielter Story-IDs
- `STAGEHAND_STORY_PACKAGE_IDS`
  - optionale CSV-Liste gezielter Paket-IDs wie `IAM-P2`
- `STAGEHAND_STORY_CLUSTERS`
  - optionale CSV-Liste technischer Cluster-Namen wie `tenant-user-create`
- `STAGEHAND_STORY_RESUME`
  - optional; `true` überspringt Stories, die in `user-stories.json` bereits nicht mehr `offen` sind
- `STAGEHAND_TENANT_BASE_URL`
  - optionale Tenant-Basisadresse für mutierende Tenant-Läufe, z. B. `http://de-musterhausen.studio.localhost:3000`
- `STAGEHAND_TENANT_USERNAME`
  - optionaler Tenant-Admin für mutierende Tenant-Läufe
- `STAGEHAND_TENANT_PASSWORD`
  - optionales Passwort für diesen Tenant-Admin
- `OPENAI_API_KEY`
  - bestehender LLM-Zugang für den Stagehand-Kontext

## Ausfuehrung

```bash
pnpm nx run sva-studio-react:test:explore:admin
```

## Aktuelles Laufverhalten

- Der Runner validiert den Env-Vertrag früh und fail-closed.
- Danach prüft er die lokale Readiness der konfigurierten Base-URL.
- Die Missionsprompts und Reports beziehen ihre fachliche Basis aus `concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json`.
- Für den aktuellen Ausbau werden die User-Stories missions- und clusterbezogen kuratiert:
  - `admin-users-overview`: Stories `18` und `19`
  - `admin-user-permissions-inspection`: Stories `23`, `24`, `25` und `26`
  - `admin-role-management-navigation`: Stories `20`, `21`, `22` und `27`
- Im Standardmodus `story-loop` liest die Schicht alle IAM-Stories aus `user-stories.json`, gruppiert sie in technische Cluster und schreibt die Ergebnisse in ein separates Overlay.
- Der erste echte positive Tenant-Executor deckt Story `18` über Login, Nutzeranlage und Detailansicht im Mandantenkontext ab.
- Weitere Stories werden aktuell entweder über bestehende Cluster positiv klassifiziert oder mit belastbaren Negativbegründungen fortgeschrieben.
- Im Legacy-Modus `mission` öffnet `admin-users-overview` die Start-URL `/admin/users` über einen einfachen lokalen Bootstrap-Pfad und klassifiziert:
  - `passed`, wenn Benutzerverwaltung oder fachlich gültiger Leerzustand eindeutig erkannt werden
  - `blocked`, wenn Login-Anforderung oder Login-Redirect erkannt werden
  - `failed`, wenn Forbidden oder ein anderer ungültiger Zielzustand erkannt werden
- Wenn Env oder Readiness fehlen, endet der Lauf explizit mit `BLOCKED` und gibt keinen Scheinerfolg aus.

## Artefakte

Artefakte werden missionsbezogen unter `docs/reports/stagehand-admin-exploration/<mission>/` geschrieben:

- `status.json`
  - strukturierter Missionsstatus mit Story-Basis, Findings und Transkriptpfad
- `report.md`
  - kurzer deutschsprachiger Missionsbericht inklusive Story-Basis und Akzeptanzkriterien
- `transcript.jsonl`
  - aktuelles Pilot-Schrittprotokoll

Für den Standardmodus `story-loop` entsteht zusätzlich:

- `docs/reports/stagehand-admin-exploration/story-loop/status.json`
  - Aggregatstatus des Voll-Laufs
- `docs/reports/stagehand-admin-exploration/story-loop/overlay.json`
  - reviewbares Result-Overlay für spätere Merge-Entscheidungen in `user-stories.json`
- `docs/reports/stagehand-admin-exploration/story-loop/report.md`
  - Story-zentrierter Gesamtbericht mit allen klassifizierten Stories
- `docs/reports/stagehand-admin-exploration/story-loop/transcript.jsonl`
  - zeilenbasiertes Schrittprotokoll pro Story

## Abgrenzung zu anderen Testschichten

- `test:e2e`
  - deterministische Playwright-Smokes für App, Routing und Browserpfade
- `test:acceptance`
  - reproduzierbarer IAM-Abnahmenachweis gegen die vereinbarte Testumgebung
- `test:explore:admin`
  - explorativer lokaler Zusatzlauf für IAM-Stories mit klaren Artefakten, direkter Fortschreibung von `user-stories.json`, aber ohne Gate-Charakter

## Hinweise fuer die Teamnutzung

- Tenant-Mutationen sind für dedizierte Testdaten erlaubt; Root-/Platform-Host bleibt nach Möglichkeit read-mostly.
- Fehlende lokale Stack-Readiness, Login-Loops, fehlende Berechtigungen oder nicht lokal beobachtbare Betriebsnachweise sind erwartete Befunde und müssen sichtbar dokumentiert bleiben.
- Die erzeugten Reports sind Diagnose- und Review-Artefakte, keine gleichwertigen CI-Freigaben.
- Das Overlay ist bewusst nicht der kanonische Story-Katalog; eine Übernahme in `user-stories.json` erfolgt erst per explizitem Review-/Merge-Schritt.
