## Umsetzung

- [x] 1. Root-HTTP-Verträge für Mainserver-Bestandsstatus und gezieltes GET/PUT auf dem bestehenden Instanzpfad ergänzen; Root-Host, Rollen, Zielinstanz, CSRF/Service-Auth und URL-Validierung gezielt testen.
- [x] 2. Zentrale MCP-Tools für Bestand, Detail und gezieltes Speichern anbinden; secretfreie Antworten, Readback und Fehlerfälle testen.
- [x] 3. Root-Instanzübersicht und Instanzdetail um Mainserver-Status und gezielte Konfigurationspflege ergänzen; deutsche und englische Texte, Fehler- und Accessibility-Tests abdecken.
- [x] 4. Die betroffenen arc42-Abschnitte [05](../../../docs/architecture/05-building-block-view.md), [06](../../../docs/architecture/06-runtime-view.md), [08](../../../docs/architecture/08-cross-cutting-concepts.md) und [10](../../../docs/architecture/10-quality-requirements.md) sowie die MCP-Betriebsanleitung aktualisieren.
- [x] 5. Gezielte Unit-/Type-Gates, `check:server-runtime`, OpenSpec-Validierung und Dateiablage prüfen; Production-Rollout und Live-Audit bleiben getrennte spätere Nachweise.
