# Plan 028: Organisationstechnische Identitäten linear normalisieren

> **Archivstatus:** DONE

## Status

- **Priorität**: P1
- **Aufwand**: S–M
- **Risiko**: hoch
- **Abhängigkeit**: Plan 027 gemergt; danach auf neuen Main rebasen
- **Kategorie**: algorithmische Security / IAM
- **Geplant auf**: `960955af8`, 15. August 2026
- **Sonar**: `AZ_xm2LjTJR08C9EVXIk`, `AZ_xm2LjTJR08C9EVXIl`; 2 × `typescript:S8786`

## Warum das wichtig ist

`normalizeAsciiSegment` verarbeitet organisationskontrollierte Anzeigenamen in einem produktiven Provisioning-Pfad. Zwei Regex-Schritte besitzen laut Sonar superlineares Backtracking. Die Ausgabe, Kollisionsbehandlung und maximale Länge sind Teil der technischen Account-Identität und dürfen nicht driften.

## Aktueller Zustand und Scope

- `packages/auth-runtime/src/iam-organizations/organization-mainserver-technical-account.ts:22-38`: Separator-Kollaps und Randpunkt-Trim über Regex.
- `packages/auth-runtime/src/iam-organizations/organization-mainserver-provisioning.test.ts:157-180`: bestehende Identitätsfälle.
- Workspace `auth-runtime`; Node-ESM-Regeln und `check:runtime` gelten.
- In Scope nur diese Source- und Testdatei sowie zwingende deutschsprachige Doku/Changelog-Datei. Out of Scope: Keycloak-Aufrufe, Provisioning-State, SQL, Kollisionspriorität, E-Mail-Domain und Account-Persistenz.

## Characterization und Umsetzung

1. Bestehenden fokussierten Unit-Test als Baseline grün ausführen.
2. Vor Source-Änderung eine Matrix für Umlaute/ß, nur Separatoren, führende/abschließende Separatoren, sehr lange gleichartige und adversarial geformte Eingaben, leere Werte, Fallback und collision-safe Suffix ergänzen. Keine konkrete Missbrauchs-Payload dokumentieren. Neue Performancegrenze mit großzügigem deterministischem Zeitbudget gegen Altcode messen; funktionale Tests müssen die exakten Alt-Ausgaben festhalten.
3. Die beiden riskanten Regex-Schritte durch linear begrenzte Plattform-/Kontrollflusslogik ersetzen, ohne neue Abstraktionsschicht.
4. Gates: fokussierte Unit, `auth-runtime:test:types`, `auth-runtime:lint`, `auth-runtime:build`, `auth-runtime:check:runtime`, `pnpm check:server-runtime`, Fallow-New-only für `auth-runtime`, OpenSpec strict/all, File Placement, Changelog, `git diff --check`.

## Erwartete Wirkung

2 S8786 verschwinden; Identitätsbytes bleiben für alle charakterisierten Fälle gleich. Fallow PASS ohne neue Complexity/CRAP/Duplikation.

## STOP-Bedingungen

- Bestehende Normalisierung erzeugt bei gleicher Eingabe nicht deterministische oder bereits persistiert abweichende Identitäten.
- Änderung verlangt Provisioning-, Keycloak-, SQL- oder OpenSpec-Vertragsänderung.
- Aktiver Branch berührt dieselben Source-/Fixture-Verträge.
