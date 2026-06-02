# Change: Mainserver-Credentials pro Organisation ermöglichen

## Why
Die aktuelle Mainserver-Integration geht fachlich und technisch davon aus, dass Application-ID und Secret immer im Benutzerprofil liegen. Für Organisationen mit gemeinsamem Mainserver-Zugang erzeugt das unnötigen Pflegeaufwand, verhindert organisationsbezogene Zugangshoheit und bildet die bestehende `contentAuthorPolicy` nicht vollständig im Laufzeitverhalten ab.

## What Changes
- ergänzt einen organisationsgebundenen Mainserver-Credential-Speicher in der Studio-Datenbank
- erweitert die Semantik von `contentAuthorPolicy` auf die Mainserver-Credential-Auflösung
- löst Mainserver-Credentials strikt über `activeOrganizationId` aus der Session sowie den dokumentierten Benutzer-Fallback auf
- erweitert die Organisationsverwaltung um write-only Pflege von Mainserver-Credentials und einen read-safe Credential-Status
- präzisiert Fehlercodes, Cache-Isolation und Integrationsgrenzen für organisationsbezogene Mainserver-Aufrufe

## Impact
- Affected specs: `iam-core`, `iam-organizations`, `account-ui`, `sva-mainserver-integration`
- Affected code: `packages/data/migrations`, `packages/iam-admin`, `packages/auth-runtime`, `packages/sva-mainserver`, `apps/sva-studio-react`
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `12-glossary`
- Affected ADRs: `ADR-021-per-user-sva-mainserver-delegation`, `ADR-045-organisationsgebundene-mainserver-credentials-und-policy-gesteuerte-delegation`
