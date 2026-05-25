# Change: WP-005 IAM-Zuweisungen und Vererbungs-Transparenz abschließen

## Why

Die aktuelle IAM-Administration bildet `WP-005` fachlich nur teilweise ab. Beim Bearbeiten von Benutzer-Rollen und -Gruppen werden bestehende Assignment-Metadaten heute destruktiv ersetzt, und die Admin-UI zeigt Vererbungs- und Restriktionspfade effektiver Berechtigungen nicht durchgehend nachvollziehbar an.

## What Changes

- diff-basierter Write-Pfad für Benutzer-Rollen und Benutzer-Gruppen statt globalem Lösch-/Neuaufbau
- strukturierter Transparenzvertrag für direkte, vererbte, restriktive und fachlich unwirksame Berechtigungspfade
- UI-Nachschärfung für Benutzer- und Gruppendetail mit lesbarer Herkunft, Vererbungsweg und Inaktivitätsgründen
- normierter Abnahme- und Nachweisrahmen für Konflikt-, Gruppen-, Vererbungs- und Geo-Szenarien

## Impact

- Affected specs:
  - `account-ui`
  - `iam-access-control`
  - `iam-core`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/users/`
  - `apps/sva-studio-react/src/routes/admin/groups/`
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/iam-admin/src/user-detail-*`
  - `packages/auth-runtime/src/iam-account-management/`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
