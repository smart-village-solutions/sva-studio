# Change: Plugin-Auth-Beiträge an der Studio-Composition-Root binden

## Why

Das Standard-Studio-Image enthält `@sva/plugin-ssf` absichtlich nicht. Der gemeinsame
Account-Create-Pfad in `@sva/auth-runtime` importiert SSF dennoch statisch; der
gemeinsame Bootstrap lädt zusätzlich SSF-OIDC-Anforderungen. Dadurch scheitert
die Image-Verifikation bereits beim Start des Standard-Studios.

## What Changes

- Der bestehende Runtime-Snapshot erhält genau einen optionalen, typisierten
  Account-Create-Beitrag für den aktuell benötigten SSF-Fall. Ohne Beitrag
  bleibt die Core-Benutzeranlage SSF-neutral.
- Die SSF-spezifische Claim-Ableitung wird in `@sva/plugin-ssf` verlagert.
  Readiness, Tenant-Sperre, vier Claims und bestehende Konfliktfehler bleiben
  semantisch unverändert.
- Die bestehenden Build-Profile binden Auth-Beitrag und OIDC-Anforderungen
  ausschließlich an der App-Composition-Root. Gemeinsame Runtime- und
  Bootstrap-Pfade importieren kein konkretes Plugin mehr.
- Der ersetzte SSF-Helper und die Runtime-Abhängigkeit von `@sva/auth-runtime`
  auf `@sva/plugin-ssf` entfallen im selben Lieferabschnitt.

## Nicht-Ziele

- Keine installationsbasierte freie Plugin-Auswahl; sie bleibt in #1503.
- Keine Änderung an `optional`, `automatic` oder `required` und keine neue
  Account-, IAM-, Projektions- oder Datenbankschema-Semantik.
- Keine Änderung am geschützten Image-Verify-/Promote-Vertrag (#1408) und kein
  Kassel-Rollout (#1325).

## Impact

- Affected spec: `plugin-platform`
- Affected code: `@sva/auth-runtime`, `@sva/plugin-ssf`,
  `apps/sva-studio-react`-Composition-Root, deren gezielte Tests und der
  bestehende Nx-Build-Input für das Distributionsprofil
- Affected arc42: `04-solution-strategy.md`, `05-building-block-view.md`,
  `06-runtime-view.md`, `08-cross-cutting-concepts.md`,
  `09-architecture-decisions.md`
- Database impact: keine Migration oder Schemaänderung

## Erfolg

Das Standard-Image kann ohne SSF-Paket starten und erzeugt bei einer
Core-Benutzeranlage keine SSF-Claims. Das SSF-Profil behält die synchrone
Benutzeranlage mit bestätigter Readiness und tenantgebundener Sperre. Gezielte
Tests und ein Artefaktcheck belegen beide Verhaltensweisen für den PR-HEAD;
das vollständige Image-Verify und die Promotion bleiben #1408.
