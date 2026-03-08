# Implementation Tasks

## 1. Architektur und Zielbild

- [ ] 1.1 Zielstruktur für modulare IAM-Server-Bausteine in `packages/auth` und `packages/data` definieren
- [ ] 1.2 Öffentliche API-Grenzen und zulässige Modulabhängigkeiten pro Fachmodul festlegen
- [ ] 1.3 ADR für die modulare IAM-Server-Architektur erstellen und in Abschnitt 09 referenzieren

## 2. Priorität 1 bis 3: größte IAM-Hotspots

- [ ] 2.1 `QUAL-101`: `iam-account-management.server.ts` in fachlich fokussierte Module für Benutzer, Rollen, Profile, Bulk-Operationen, Feature-Flags, Rate-Limits und Schemas zerlegen
- [ ] 2.2 `QUAL-103`: `iam-data-subject-rights.server.ts` in Export-, SLA-, Lösch- und Statusmodule aufteilen
- [ ] 2.3 `QUAL-104`: `iam-governance.server.ts` in Approval-, Delegation-, Impersonation- und Compliance-Bausteine aufteilen

## 3. Priorität 4 bis 6: Adapter, Autorisierung und Routing

- [ ] 3.1 `QUAL-108`: `keycloak-admin-client.ts` in API-spezifische Adapter oder Submodule zerlegen
- [ ] 3.2 `QUAL-102`: `iam-authorization.server.ts` in Evaluation, Cache-Zugriff, Request-Parsing und Response-Building trennen
- [ ] 3.3 `QUAL-109`: `routes.server.ts` in dünne Route-Composition und fachnahe Handler-Module zerlegen

## 4. Priorität 7 bis 9: Exportfläche, Auth-Flow und Repositories

- [ ] 4.1 `QUAL-105`: `index.server.ts` auf explizite, kleinere Exportflächen reduzieren
- [ ] 4.2 `QUAL-106`: `auth.server.ts` in kleinere Guards, Redirect-Builder und Session-nahe Helfer zerlegen
- [ ] 4.3 `QUAL-107`: `packages/data/src/iam/repositories.ts` in read-/write-orientierte oder domänenspezifische Repository-Module aufteilen

## 5. Shared Modules und Duplikatsvermeidung

- [ ] 5.1 Gemeinsame Hilfslogik für Maskierung, Parsing, Validierung, Rate-Limits und Logging-Kontext in dedizierten Shared-Modulen zentralisieren
- [ ] 5.2 Sicherstellen, dass neue Fachmodule Shared-Helfer konsumieren statt Logik zu duplizieren
- [ ] 5.3 Import-Grenzen und öffentliche APIs gegen ungewollte Querverkopplung prüfen

## 6. Verifikation und Dokumentation

- [ ] 6.1 Unit-, Type- und Integrations-Tests pro zerlegtem Fachmodul ergänzen oder anpassen
- [ ] 6.2 `pnpm complexity-gate` für die betroffenen Module ausführen und Restüberschreitungen mit Tickets dokumentieren
- [ ] 6.3 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `09`, `10` und `11` aktualisieren
- [ ] 6.4 Relevante Entwicklerdokumentation und Runbooks auf neue Modulgrenzen und Entry-Points anpassen
