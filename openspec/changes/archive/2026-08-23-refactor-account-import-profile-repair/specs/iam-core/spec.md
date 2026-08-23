## MODIFIED Requirements

### Requirement: Keycloak User Synchronization Scope

The system SHALL run Keycloak user synchronization as a reconciliation flow that explains differences between Keycloak and Studio instead of hiding unmapped or partially failed objects. The synchronization scope focuses on identities, scope resolution, technical realm access markers, and explicitly managed Sonderrollen rather than treating arbitrary Keycloak role catalogs as the normative source of tenant authorization.

#### Scenario: Sync reports legacy role drift without reintroducing it

- **WHEN** ein User-Sync Keycloak-Rollen findet, die außerhalb des normativen Sonderrollenschnitts liegen
- **THEN** enthält der Sync-Report diese Rollen als Legacy-, Interop- oder Driftbefund
- **AND** das System projiziert sie nicht automatisch als kanonische tenantlokale Fachrollen

#### Scenario: Partial failure remains actionable

- **WHEN** ein Sync mit `partial_failure` endet
- **THEN** enthält der Report objektbezogene Ursachen wie `missing_instance_attribute`, `forbidden_role_mapping`, `read_only_federated_field` oder `idp_forbidden`
- **AND** Admins können daraus Reconcile- oder Runbook-Aktionen ableiten

#### Scenario: Fehlende Profilfelder werden deterministisch repariert

- **GIVEN** ein Keycloak-User gehört zum tenantlokalen Importpfad einer aufgelösten Instanz
- **WHEN** E-Mail, Vorname oder Nachname im Quellprofil fehlt oder nur aus Leerzeichen besteht
- **THEN** verwendet das System pro Feld zuerst einen vorhandenen Quellwert und danach den ausschließlich über dieselbe Instanz und dasselbe Subject geladenen lokalen Seed
- **AND** verwendet es nur für eine weiterhin fehlende E-Mail zuletzt einen syntaktisch gültigen Username
- **AND** mutiert es ausschließlich das exakte Keycloak-Subject über den bereits aufgelösten tenantlokalen Provider
- **AND** führt ein weiterhin unvollständiges Profil ohne IAM-Persistenz in die manuelle Prüfung

#### Scenario: Vollständiges Quellprofil bleibt vorrangig

- **GIVEN** Quellprofil und lokaler Seed enthalten widersprüchliche vollständige Profilwerte
- **WHEN** der tenantlokale Import den User verarbeitet
- **THEN** bleiben die Quellwerte unverändert vorrangig
- **AND** das System führt keine Profilreparatur-Mutation aus
