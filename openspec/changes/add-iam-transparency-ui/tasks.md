## 1. Informationsarchitektur und Contracts

- [x] 1.1 Routing und Navigationskonzept für `/admin/iam` als Transparenz-Cockpit und `/account/privacy` spezifizieren (inkl. deep-linkbarer Tabs via Search-Param, Back/Forward-Verhalten und Unknown-Tab-Fallback)
- [x] 1.2 Datenverträge und ViewModels für strukturierte Permissions, Governance-Listen und DSR-Status auf UI-Nutzbarkeit prüfen und bei Bedarf ergänzen (inkl. Synchronisation mit `docs/guides/iam-authorization-api-contract.md` und `docs/guides/iam-authorization-openapi-3.0.yaml`)
- [x] 1.3 Rollen- und Zugriffsgates für Governance-/DSR-Sichten im Frontend festlegen (verbindliche Access-Matrix für Route, Tab und Detaildaten; inkl. Deny-Verhalten)

## 2. Frontend-Umsetzung

- [x] 2.1 `Rechte`-Tab in `/admin/iam` um `resourceId`, `organizationId`, `effect`, `scope`, `sourceRoleIds`, Diagnose- und Subjektinformationen (`actorUserId`, `effectiveUserId`, `isImpersonating`) erweitern
- [x] 2.2 `Governance`-Tab in `/admin/iam` für Permission-Changes, Delegations, Impersonations und Legal-Text-Akzeptanzen umsetzen
- [x] 2.3 `Betroffenenrechte`-Tab in `/admin/iam` für Requests, Exporte, Legal Holds, Korrekturen und Benachrichtigungen umsetzen
- [x] 2.4 `/account/privacy` für Self-Service-DSR, Exportstatus und optionale Verarbeitung umsetzen
- [x] 2.5 Benutzerdetailseite um Avatar, Rollen-Gültigkeitsfenster und echte Historie erweitern
- [x] 2.6 Rollenverwaltung um externe Zuordnung, Management-Herkunft, Level und Sync-Details erweitern
- [x] 2.7 Organisationsverwaltung und Kontext-Switcher um Hierarchie-, Metadata- und Membership-Details erweitern

## 3. Qualitätssicherung

- [x] 3.1 Unit-Tests für neue ViewModels, Mapper und Filterlogik ergänzen
- [x] 3.2 UI-Tests für Cockpit-Tabs, Privacy-Self-Service und angereicherte Admin-Ansichten ergänzen (inkl. Empty-State-CTA, Deny-Zustände und Fehler-Recovery)
- [x] 3.3 API-/Integrationstests für neue oder geschärfte Transparenzfelder ergänzen (inkl. `impersonation_not_active`, `impersonation_expired`, 403-Deny und Diagnose-Allowlist)
- [x] 3.4 Barrierefreiheitsprüfungen für Tab-Navigation, Tabellen, Detailpanels und Statusmeldungen ergänzen (Fokus-Management, Live-Regionen, Tastaturbedienung; roving tabindex, Home/End/Pfeiltasten, Dialog-Fokus-Restore, Live-Regionen in Privacy-/IAM-Statuspfaden)
- [x] 3.5 E2E-Tests für End-to-End-Flows ergänzen (`/admin/iam` Tab-Wechsel + Drill-down, `/account/privacy` Erstaufruf + Statuspfade, Berechtigungsgrenzen)
- [x] 3.6 Performance-Nachweise für große Datenmengen ergänzen (Pagination, Filterlatenz, tab-spezifisches Lazy-Loading, keine Vollmengenabfrage; Debounce + AbortController für Governance/DSR, nur aktiver Tab lädt initial)
- [x] 3.7 i18n-Abdeckung für neue UI-Texte sicherstellen (Translation-Keys für `de` und `en`, keine hardcoded Strings)

## 4. Dokumentation

- [x] 4.1 Relevante Guides um die neuen UI-Sichten ergänzen (`docs/guides/iam-authorization-api-contract.md`, `docs/guides/iam-authorization-openapi-3.0.yaml`, Governance-/DSR-Runbooks)
- [x] 4.2 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren (`04`, `05`, `06`, `08`, `09`, `11`) oder begründete Nicht-Änderung dokumentieren
- [x] 4.3 ADR-Bedarf für Contract-/Routing-Entscheidungen prüfen und Entscheidung in `docs/architecture/09-architecture-decisions.md` dokumentieren
- [x] 4.4 OpenSpec-Deltas und Aufgabenstatus konsistent halten
