# Stagehand Admin Exploration

Dieses Dokument beschreibt die lokale, nicht blockierende Pilot-Schicht für explorative Admin-Läufe in `apps/sva-studio-react`.

## Zweck und Einordnung

- `pnpm nx run sva-studio-react:test:explore:admin` ist ein lokaler Explorationslauf für reale Admin-Pfade.
- Die Schicht ergaenzt `test:e2e` und `test:acceptance`, ersetzt sie aber nicht.
- Der Pilot ist bewusst local-first und nicht Teil eines verpflichtenden PR- oder CI-Gates.

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
  - optional; Standard ist `admin-users-overview`
- `OPENAI_API_KEY`
  - bestehender LLM-Zugang für den Stagehand-Kontext

## Ausfuehrung

```bash
pnpm nx run sva-studio-react:test:explore:admin
```

## Aktuelles Pilotverhalten

- Der Runner validiert den Env-Vertrag früh und fail-closed.
- Danach prüft er die lokale Readiness der konfigurierten Base-URL.
- Für `admin-users-overview` öffnet der Pilot die Start-URL `/admin/users` über einen einfachen lokalen Bootstrap-Pfad und klassifiziert:
  - `passed`, wenn Benutzerverwaltung oder fachlich gültiger Leerzustand eindeutig erkannt werden
  - `blocked`, wenn Login-Anforderung oder Login-Redirect erkannt werden
  - `failed`, wenn Forbidden oder ein anderer ungültiger Zielzustand erkannt werden
- Wenn Env oder Readiness fehlen, endet der Lauf explizit mit `BLOCKED` und gibt keinen Scheinerfolg aus.

## Artefakte

Artefakte werden missionsbezogen unter `docs/reports/stagehand-admin-exploration/<mission>/` geschrieben:

- `status.json`
  - strukturierter Missionsstatus mit Findings und Transkriptpfad
- `report.md`
  - kurzer deutschsprachiger Missionsbericht
- `transcript.jsonl`
  - aktuelles Pilot-Schrittprotokoll

## Abgrenzung zu anderen Testschichten

- `test:e2e`
  - deterministische Playwright-Smokes für App, Routing und Browserpfade
- `test:acceptance`
  - reproduzierbarer IAM-Abnahmenachweis gegen die vereinbarte Testumgebung
- `test:explore:admin`
  - explorativer lokaler Zusatzlauf für Admin-Pfade mit klaren Artefakten, aber ohne Gate-Charakter

## Hinweise fuer die Teamnutzung

- Der Pilot ist read-mostly gedacht; er ist kein Freibrief für breite mutierende Admin-Experimente.
- Fehlende lokale Stack-Readiness, Login-Loops oder fehlende Berechtigungen sind erwartete Pilot-Befunde und müssen sichtbar dokumentiert bleiben.
- Die erzeugten Reports sind Diagnose- und Review-Artefakte, keine gleichwertigen CI-Freigaben.
