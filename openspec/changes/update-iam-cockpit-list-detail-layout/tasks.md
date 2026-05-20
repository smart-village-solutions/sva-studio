## 1. Umsetzung

- [ ] 1.1 Bestehende IAM-Cockpit-Tabstruktur und Waste-Referenzmuster auf gemeinsame UI-Bausteine abbilden
- [ ] 1.2 IAM-Tab-Darstellung unter `/admin/iam` auf das Waste-ähnliche Trigger-/Panel-Muster umstellen
- [ ] 1.3 `rights` als barrierefreie, konsistente Tabellenübersicht auf denselben Darstellungsstandard anheben
- [ ] 1.4 `governance` von Kartenliste mit Inline-Details auf Tabellenübersicht umstellen
- [ ] 1.5 `dsr` von Kartenliste mit Inline-Details auf Tabellenübersicht umstellen
- [ ] 1.6 Typsichere Detailrouten für Governance- und DSR-Fälle ergänzen
- [ ] 1.7 Governance-Detailseite mit Rücknavigation, Kopfsektion und strukturierten Detailblöcken umsetzen
- [ ] 1.8 DSR-Detailseite mit Rücknavigation, Kopfsektion und strukturierten Detailblöcken umsetzen
- [ ] 1.9 Datenladung so ausrichten, dass Listen und Detaildaten getrennt und on-demand geladen werden
- [ ] 1.10 Bestehende IAM-Tests auf das neue Listen-/Detailmuster anpassen und neue Routing-/Navigations-Tests ergänzen
- [ ] 1.11 Relevante Dokumentation und betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder begründete Nicht-Änderung dokumentieren
- [ ] 1.12 `openspec validate update-iam-cockpit-list-detail-layout --strict` erfolgreich ausführen

## 2. Verifikation

- [ ] 2.1 Betroffene Unit- und Routing-Tests via Nx ausführen
- [ ] 2.2 Betroffene Type-Tests via Nx ausführen
- [ ] 2.3 Relevante IAM-UI-Flows lokal gegen `/admin/iam?tab=rights`, `/admin/iam?tab=governance` und `/admin/iam?tab=dsr` prüfen
