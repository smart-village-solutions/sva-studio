## 1. Verträge und Schutzklassifikation

- [x] 1.1 Additive Core-Verträge für Keycloak-Rollenmetadaten, direkte/effektive Benutzerzuweisungen, Zuweisbarkeit und stabile Fehlercodes definieren.
- [x] 1.2 Eine zentrale, tabellengetestete Policy für Builtins, Clientrollen, Service-Rollen und Root-/Plattformrollen implementieren.
- [x] 1.3 Sicherstellen, dass reguläre externe Realm-Rollen ohne Studio-spezifische Namens-Allowlist zuweisbar sind.
- [x] 1.4 Den `system_admin`-Sonderpfad explizit vom generischen externen Zuweisungspfad trennen.

## 2. Keycloak- und IAM-Serverpfade

- [x] 2.1 Den Identity-Provider-Port um getrennte direkte und effektive Realm-Rollenzuweisungen einschließlich Composite-Herkunft erweitern.
- [x] 2.2 Tenantgebundene Read-Endpunkte für Rollenmetadaten und Benutzerzuweisungen hinter `iam.role.read`/`iam.user.read` ergänzen.
- [x] 2.3 Idempotente Assign-/Remove-Delta-Endpunkte hinter `iam.role.write` implementieren, ohne vollständiges Rollen-Replace.
- [x] 2.4 Gemappte und unmapped Keycloak-Benutzer als Ziele unterstützen, ohne bei externen Rollen implizite lokale IAM-Datensätze anzulegen.
- [x] 2.5 Erfolg durch kausalen Re-Read bestätigen und unklare Keycloak-Ergebnisse stabil als Reconciliation-/Konfliktzustand ausgeben.
- [x] 2.6 `system_admin` ausschließlich über den gekoppelten IAM-/Keycloak-Pfad mit Actor-, Hierarchie- und Letztadmin-Schutz mutieren.
- [x] 2.7 Audit- und Observability-Pfade für Erfolg, Ablehnung und unklare Ergebnisse datensparsam ergänzen.

## 3. Studio-UI

- [x] 3.1 Lokale IAM-Rollen sowie direkte und geerbte Keycloak-Rollen in Benutzerliste und -detail klar getrennt anzeigen.
- [x] 3.2 Für berechtigte Actors Assign-/Remove-Aktionen für zuweisbare direkte Realm-Rollen anbieten.
- [x] 3.3 Read-only Gründe für Builtins, Client-, Service-, Root-/Plattform- und geerbte Rollen zugänglich darstellen.
- [x] 3.4 `system_admin` im gemeinsamen Rollenbild anzeigen, aber auf den geschützten kanonischen Zuweisungspfad routen.
- [x] 3.5 Lade-, Leer-, Erfolgs-, Fehler- und Ambiguitätszustände lokalisieren und WCAG-konform umsetzen.

## 4. Tests und Qualität

- [x] 4.1 Unit-Tests für Rollenklassifikation, Scope-Bindung, Permission-Gates, Delta-Bildung und Projektion ergänzen.
- [x] 4.2 Keycloak-Adaptertests für direkte, geerbte, Composite- und konkurrierende Rollenzuweisungen ergänzen.
- [x] 4.3 DB-/API-Integrationstests für gemappte und unmapped Benutzer sowie unveränderte lokale Studio-Permissions ergänzen.
- [x] 4.4 Schutztests für `system_admin`, Letztadmin, Builtins, `realm_account_admin` und `instance_registry_admin` ergänzen.
- [x] 4.5 UI- und E2E-Tests für Anzeige, Zuweisung, Entzug, Tastaturbedienung und Fehlerrückmeldung ergänzen.
- [x] 4.6 Den kleinsten relevanten Nx-Gate-Pfad messen und ausführen; bei Server-Packages zusätzlich `pnpm check:server-runtime` und vor dem initialen PR-Push bevorzugt `pnpm test:pr` ausführen.

## 5. Dokumentation und Rollout

- [x] 5.1 Eine ADR für die administrative Keycloak-Interop-Rollenzuweisung bei weiterhin lokaler Studio-Autorisierung erstellen und in `docs/architecture/09-architecture-decisions.md` verlinken.
- [x] 5.2 `docs/architecture/04-solution-strategy.md`, `05-building-block-view.md`, `06-runtime-view.md` und `08-cross-cutting-concepts.md` an die neue Zuweisungsgrenze anpassen.
- [x] 5.3 `docs/architecture/10-quality-requirements.md` und `11-risks-and-technical-debt.md` um Schutz- und Betriebsnachweise ergänzen.
- [x] 5.4 Bedienhinweise zur getrennten lokalen und externen Rollensicht in der zuständigen aktuellen Dokumentation ergänzen.
- [ ] 5.5 Staging-Smoke mit einer ungefährlichen externen Realm-Rolle durchführen und Builtin-/Root-Schutz sowie Audit nachweisen.
- [ ] 5.6 Regulären Build-once-Rollout mit identischem Image-Digest gemäß `docs/guides/studio-rollout-process.md` durchführen.
