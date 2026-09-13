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
- **AND** persistiert es einen Account mit aufgelöster E-Mail und optionalen Namensfeldern samt tenantlokaler Membership
- **AND** schreibt es keine Default-Namen nach Keycloak oder IAM
- **AND** führt es ausschließlich ein Profil mit weiterhin fehlender E-Mail ohne IAM-Persistenz in die manuelle Prüfung

#### Scenario: Fehlende Namen blockieren die Membership nicht

- **GIVEN** ein tenantlokaler Keycloak-User hat eine aufgelöste E-Mail, aber keinen Vor- oder Nachnamen
- **WHEN** ein berechtigter Admin den Keycloak-User-Sync ausführt
- **THEN** upserted das System den subject- und instanzgebundenen IAM-Account mit optionalen Namensfeldern
- **AND** stellt es die tenantlokale Membership idempotent sicher
- **AND** erzeugt es für die fehlenden Namen keinen `manual_review`-Warnzustand

#### Scenario: Abgewiesene reine Namensreparatur blockiert die Membership nicht

- **GIVEN** ein tenantlokaler Keycloak-User hat eine aufgelöste E-Mail und ein optionales Namensfeld ist aus dem subjectgebundenen lokalen Seed auflösbar
- **WHEN** Keycloak die reine Namensreparatur deterministisch wegen eines schreibgeschützten Attributs ablehnt
- **AND** sämtliche strukturierten Feldfehler ausschließlich schreibgeschützte Vor- oder Nachnamen betreffen
- **THEN** normalisiert und persistiert das System den subjectgebundenen IAM-Account weiterhin
- **AND** stellt es die tenantlokale Membership idempotent sicher
- **AND** protokolliert es nur eine datensparsame technische Warnung ohne Profilwerte
- **AND** verwendet es einen vorhandenen Anzeigenamen-Fallback, ohne diesen als erfundenes Profildatum zu persistieren

#### Scenario: Nicht auflösbare E-Mail bleibt blockiert

- **GIVEN** ein tenantlokaler Keycloak-User hat weder eine Quell-E-Mail noch einen subjectgebundenen lokalen Seed oder einen syntaktisch gültigen Username als E-Mail-Fallback
- **WHEN** ein berechtigter Admin den Keycloak-User-Sync ausführt
- **THEN** persistiert das System weder IAM-Account noch Membership für dieses Subject
- **AND** zählt es den Fall als `identity_profile_incomplete` in `manual_review`
- **AND** enthält der operative Nachweis keine Profilwerte oder Klartext-Subjects

#### Scenario: Vollständiges Quellprofil bleibt vorrangig

- **GIVEN** Quellprofil und lokaler Seed enthalten widersprüchliche vollständige Profilwerte
- **WHEN** der tenantlokale Import den User verarbeitet
- **THEN** bleiben die Quellwerte unverändert vorrangig
- **AND** das System führt keine Profilreparatur-Mutation aus
