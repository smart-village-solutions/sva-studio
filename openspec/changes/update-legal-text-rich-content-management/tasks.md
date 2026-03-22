## 1. Spezifikation
- [x] 1.1 Rechtstext-Anforderungen in `account-ui` und `iam-core` auf das neue fachliche Modell erweitern
- [x] 1.2 Technisches Design für Persistenz, Statusmodell und HTML-Bearbeitung dokumentieren

## 2. Backend
- [x] 2.1 Datenbank-Schema für Name, HTML-Inhalt, Status und `updated_at` erweitern
- [x] 2.2 Contracts, Repository und Handler auf das neue Rechtstext-Modell umstellen
- [x] 2.3 Validierung für erlaubte Statuswerte und HTML-Inhalt ergänzen
- [x] 2.4 HTML-Sanitizing und serverseitige Inhaltsvalidierung paketkonform außerhalb der React-App verankern
- [x] 2.5 Unit-Tests für Listing, Create, Update und Fehlerfälle anpassen oder ergänzen

## 3. Frontend
- [x] 3.1 Admin-Ansicht der Rechtstexte auf fachliche Felder und Statusdarstellung umbauen
- [x] 3.2 Erstell- und Bearbeitungsdialoge um Name, HTML-Inhalt, Status und Timestamps erweitern
- [x] 3.3 Rich-Text-Editor für HTML-Inhalt integrieren
- [x] 3.4 Hinweise entfernen, dass der Textkörper nicht serverseitig gespeichert wird
- [x] 3.5 Betroffene Unit- und Type-Tests aktualisieren
- [x] 3.6 Sicherstellen, dass keine UI-spezifischen Editor-Typen oder Abhängigkeiten in `packages/core` oder `packages/auth` landen

## 4. Dokumentation
- [x] 4.1 API-Dokumentation und Guides für Rechtstext-Endpunkte aktualisieren
- [x] 4.2 Betroffene arc42-Abschnitte unter `docs/architecture/` anpassen
