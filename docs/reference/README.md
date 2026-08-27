# Referenz

## Bereichsvertrag

| Merkmal        | Festlegung                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zweck          | Stabile technische Verträge, Datenmodelle, Mapping-Tabellen und fachliche Nachschlagewerke                                                             |
| Zielgruppe     | Entwicklerinnen und Entwickler, Integratoren, Reviewer und technische Redaktionen                                                                      |
| Autorität      | Führend für den beschriebenen Vertrag; maschinenlesbare API-Schemata unter [`docs/api/`](../api/) haben bei Abweichungen Vorrang vor erläuterndem Text |
| Ownership      | Das Package, Modul oder die Schnittstelle, die den jeweiligen Vertrag implementiert                                                                    |
| Pflege-Trigger | Änderungen an APIs, Reason Codes, Datenformaten, Mapping-Regeln, Inhaltsmodellen oder fachlichen Invarianten                                           |

How-to-Anleitungen gehören nach [Entwicklung](../development/README.md), ausführbare Runbooks nach [Betrieb](../operations/README.md).

## Aktuelle Referenzeinstiege

- [IAM API v1](../api/iam-v1.yaml)
- [Monorepo-Struktur](./monorepo.md)
- [Routing](./routing.md)
- [Browser-Unterstützung](./browser-support.md)

## Technische und fachliche Verträge

- [Komponenten-Mapping für die Account-UI](./account-ui-komponenten-mapping.md)
- [Content-Management-Core-Vertrag](./content-management-core-contract.md)
- [Inhaber von Inhalten übertragen](./content-ownership-transfer.md)
- [Featured Projects](./featured-projects.md)
- [IAM-Authorization-API-Vertrag](./iam-authorization-api-contract.md)
- [IAM-Authorization-Reason-Codes](./iam-authorization-reason-codes.md)
- [Direkte Nutzerrechte im IAM](./iam-direkte-nutzerrechte.md)
- [IAM-Service-API](./iam-service-api-dokumentation.md)
- [Instanz-Lebenszyklus und Navigation](./instance-lifecycle-navigation.md)
- [Instanz-Modulverwaltung](./instance-module-management.md)
- [Public-Waste-API](./public-waste-api.md)
- [Waste-Datenaustausch](./waste-data-exchange.md)
- [Medienverwaltung](./media-management.md)
- [UI-Zugriff und Server-Enforcement](./ui-access-server-enforcement.md)
- [Waste-Abholorte global sortieren und auswählen](./waste-management-abholorte-sortieren.md)
- [Gültigkeitszeiträume von Waste-Touren](./waste-management-tour-gueltigkeit.md)

Das ergänzende Authorization-OpenAPI-Schema liegt unter [`docs/api/iam-authorization-openapi-3.0.yaml`](../api/iam-authorization-openapi-3.0.yaml). Alle finalen Zielpfade und Konsolidierungsentscheidungen sind im [Migrationsnachweis](../governance/dokumentationsmigration.md) festgehalten.

## Benachbarte Bereiche

[Dokumentationsübersicht](../README.md) · [Entwicklung](../development/README.md) · [Betrieb](../operations/README.md) · [Governance](../governance/README.md) · [Architektur](../architecture/README.md)
