# Change: Studio-Rolle bei Mainserver-Provisionierung setzen

## Why

Persönliche und organisationsgebundene technische Studioaccounts werden über den gemeinsamen Mainserver-Benutzer-Endpunkt provisioniert. Ohne explizite Rolle legt der Mainserver neue Nutzer als `restricted` an; diese Rolle besitzt nicht die für Studio verwalteten Mainserver-Rechte. Studio muss deshalb bei jeder eigenen Benutzer-Provisionierung die neue Mainserver-Rolle `studio` als initiale Rolle anfordern, ohne bestehende Rollen bei Wiederholungen zu verändern.

## What Changes

- Studio sendet bei `POST /api/v2/user_provisionings` für persönliche und organisationsgebundene technische Accounts explizit `role: "studio"`.
- Die Rolle bleibt eine reine Mainserver-Initialrolle. Studio führt kein Keycloak-Präfix, kein Rollen-Mapping und keine lokale Spiegelung dieser Mainserver-Rolle ein.
- Idempotente Reprovisionierung aktualisiert Credentials und Profildaten, verändert aber keine bereits bestehende Mainserver-Rolle.
- Cross-Tenant-Ablehnungen (`403`) und ungültige Rollen (`422`) werden als sichere, nicht wiederholbare Provisioning-Fehler behandelt.
- Bestehende Nutzer werden nicht automatisch migriert.
- Die Dokumentation grenzt die Mainserver-Initialrolle ausdrücklich von Studio-/Keycloak-Rollen des technischen Organisationsaccounts ab.

## Impact

- Affected specs: `sva-mainserver-integration`
- Affected code: `packages/auth-runtime/src/iam-account-management`, `packages/auth-runtime/src/iam-organizations`
- Affected documentation: `docs/development/runbook-sva-mainserver.md`, `docs/architecture/06-runtime-view.md`, `docs/adr/ADR-051-technische-accounts-und-organisations-mainserver-provisioning.md`
- Affected arc42 sections: `06-runtime-view`
- No database schema, migration, Keycloak realm role, UI or automatic existing-user migration is introduced.
