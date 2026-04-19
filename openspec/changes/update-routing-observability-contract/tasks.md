## 1. Spezifikation
- [ ] 1.1 Bestehende `routing`-Capability um Anforderungen für Routing-Observability erweitern
- [ ] 1.2 Event-Kategorien und Pflichtfelder für Routing-Logs spezifizieren
- [ ] 1.3 Noise-Grenzen und Negativabgrenzung dokumentieren (was bewusst nicht geloggt wird)

## 2. Design
- [ ] 2.1 Logger-/Diagnostics-Hook-Vertrag für `@sva/routing` entwerfen
- [ ] 2.2 Trennung zwischen Server-Logging, Browser-Diagnostik und No-op-Fallback festlegen
- [ ] 2.3 Datenschutz- und Redaction-Regeln für Routing-Kontexte definieren

## 3. Implementierung
- [ ] 3.1 Routing-Logger-Interface und zentrale Hilfsfunktionen im Package ergänzen
- [ ] 3.2 Serverseitige Auth-/IAM-Dispatch-Anomalien mit strukturierten Logs absichern
- [ ] 3.3 Guard-Denials und Redirect-Entscheidungen über den neuen Vertrag beobachtbar machen
- [ ] 3.4 Plugin-Guard-Mapping und Plugin-Route-Auflösung observierbar machen
- [ ] 3.5 Search-Param-Normalisierung nur für relevante Korrekturen diagnosefähig machen
- [ ] 3.6 Bestehende Error-/Warn-Logs auf den neuen Vertrag harmonisieren

## 4. Tests
- [ ] 4.1 Unit-Tests für Logger-/Diagnostics-Hooks ergänzen
- [ ] 4.2 Unit-Tests für Guard-Logging, Plugin-Logging und Search-Logging ergänzen
- [ ] 4.3 Bestehende Auth-Route-Logging-Tests an den erweiterten Vertrag anpassen
- [ ] 4.4 Betroffene Nx-Targets ausführen (`pnpm nx run routing:test:unit`, `pnpm nx run routing:test:types`)

## 5. Dokumentation
- [ ] 5.1 `packages/routing/README.md` um Observability-Vertrag ergänzen
- [ ] 5.2 `docs/architecture/routing-architecture.md` aktualisieren
- [ ] 5.3 `docs/architecture/logging-architecture.md` und `docs/development/observability-best-practices.md` um Routing-Aspekte erweitern
- [ ] 5.4 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder Abweichung begründen
