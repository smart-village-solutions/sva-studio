## 1. Vertrag und Server

- [x] 1.1 Getrennte Root-/Tenant-Lese- und Schreibverträge ohne Branding definieren
- [x] 1.2 Atomare System- und Tenant-Mutationen samt Validierung ergänzen
- [x] 1.3 Plugin-Admin-Handler mit getrennten Root-/Tenant-Actions registrieren
- [x] 1.4 Unit- und PostgreSQL-Integrationstests ergänzen

## 2. Studio-Oberfläche

- [x] 2.1 Root- und Tenant-Routen samt Navigation registrieren
- [x] 2.2 Root-Formular für installationsweite Standards umsetzen
- [x] 2.3 Tenant-Formular für Overrides, Vererbung und Zurücksetzen umsetzen
- [x] 2.4 Lade-, Fehler-, Read-only- und Erfolgszustände ergänzen
- [x] 2.5 UI-, i18n- und Accessibility-Tests ergänzen

## 3. Dokumentation und Gates

- [x] 3.1 SSF- und Studio-Architekturdokumentation aktualisieren
- [x] 3.2 Relevante Unit-, Type-, Server-Runtime- und Build-Gates ausführen
- [x] 3.3 `pnpm exec openspec validate add-ssf-runtime-configuration-ui --strict` ausführen

## 4. Nachgelagerte Stabilisierung

Diese Punkte blockieren den schnell nutzbaren MVP nicht und werden erst nach
der produktiven IAM- und Lifecycle-Anbindung bearbeitet.

- [ ] 4.1 Default-Sprache und mindestens eine Systemsprache als
      Persistenzinvariante zusätzlich absichern
- [ ] 4.2 Bereinigungs- und HTML-Validierungsfehler durchgängig als fachliche
      `422`-Antwort abbilden
- [ ] 4.3 Effektive Runtime-Konfiguration und `configurationRevision` bei
      nachgewiesenem Betriebsbedarf in einer Diagnoseansicht darstellen
- [ ] 4.4 Browser-Entry-Auflösung für alle unterstützten Plugin-Paketformen
      separat härten
