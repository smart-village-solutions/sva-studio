## 1. Umsetzung

- [x] 1.1 Bestehende IAM-Cockpit-Tabstruktur und Waste-Referenzmuster auf gemeinsame UI-Bausteine abbilden
- [x] 1.2 IAM-Tab-Darstellung unter `/admin/iam` auf das Waste-ähnliche Trigger-/Panel-Muster umstellen
- [x] 1.3 `rights` als barrierefreie, konsistente Tabellenübersicht auf denselben Darstellungsstandard anheben
- [x] 1.4 `governance` von Kartenliste mit Inline-Details auf Tabellenübersicht umstellen
- [x] 1.5 `dsr` von Kartenliste mit Inline-Details auf Tabellenübersicht umstellen
- [x] 1.6 Typsichere Detailrouten für Governance- und DSR-Fälle ergänzen
- [x] 1.7 Governance-Detailseite mit Rücknavigation, Kopfsektion und strukturierten Detailblöcken umsetzen
- [x] 1.8 DSR-Detailseite mit Rücknavigation, Kopfsektion und strukturierten Detailblöcken umsetzen
- [x] 1.9 Datenladung so ausrichten, dass Listen und Detaildaten getrennt und on-demand geladen werden
- [x] 1.10 Bestehende IAM-Tests auf das neue Listen-/Detailmuster anpassen und neue Routing-/Navigations-Tests ergänzen
- [x] 1.11 Relevante Dokumentation und betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder begründete Nicht-Änderung dokumentieren
- [x] 1.12 `openspec validate update-iam-cockpit-list-detail-layout --strict` erfolgreich ausführen

## 2. Verifikation

- [x] 2.1 Betroffene Unit- und Routing-Tests via Nx ausführen
- [x] 2.2 Betroffene Type-Tests via Nx ausführen
- [x] 2.3 Relevante IAM-UI-Flows lokal gegen `/admin/iam?tab=rights`, `/admin/iam?tab=governance` und `/admin/iam?tab=dsr` prüfen
