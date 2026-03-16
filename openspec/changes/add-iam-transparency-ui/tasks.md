## 1. Informationsarchitektur und Contracts

- [ ] 1.1 Routing und Navigationskonzept für `/admin/iam` als Transparenz-Cockpit und `/account/privacy` spezifizieren
- [ ] 1.2 Datenverträge und ViewModels für strukturierte Permissions, Governance-Listen und DSR-Status auf UI-Nutzbarkeit prüfen und bei Bedarf ergänzen
- [ ] 1.3 Rollen- und Zugriffsgates für Governance-/DSR-Sichten im Frontend festlegen

## 2. Frontend-Umsetzung

- [ ] 2.1 `Rechte`-Tab in `/admin/iam` um `resourceId`, `effect`, `scope`, Diagnose- und Subjektinformationen erweitern
- [ ] 2.2 `Governance`-Tab in `/admin/iam` für Permission-Changes, Delegations, Impersonations und Legal-Text-Akzeptanzen umsetzen
- [ ] 2.3 `Betroffenenrechte`-Tab in `/admin/iam` für Requests, Exporte, Legal Holds, Korrekturen und Benachrichtigungen umsetzen
- [ ] 2.4 `/account/privacy` für Self-Service-DSR, Exportstatus und optionale Verarbeitung umsetzen
- [ ] 2.5 Benutzerdetailseite um Avatar, Rollen-Gültigkeitsfenster und echte Historie erweitern
- [ ] 2.6 Rollenverwaltung um externe Zuordnung, Management-Herkunft, Level und Sync-Details erweitern
- [ ] 2.7 Organisationsverwaltung und Kontext-Switcher um Hierarchie-, Metadata- und Membership-Details erweitern

## 3. Qualitätssicherung

- [ ] 3.1 Unit-Tests für neue ViewModels, Mapper und Filterlogik ergänzen
- [ ] 3.2 UI-Tests für Cockpit-Tabs, Privacy-Self-Service und angereicherte Admin-Ansichten ergänzen
- [ ] 3.3 API-/Integrationstests für neue oder geschärfte Transparenzfelder ergänzen
- [ ] 3.4 Barrierefreiheitsprüfungen für Tab-Navigation, Tabellen, Detailpanels und Statusmeldungen ergänzen

## 4. Dokumentation

- [ ] 4.1 Relevante Guides für IAM-Authorization, Governance und DSR-Runbooks um die neuen UI-Sichten ergänzen
- [ ] 4.2 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder begründete Nicht-Änderung dokumentieren
- [ ] 4.3 OpenSpec-Deltas und Aufgabenstatus konsistent halten
