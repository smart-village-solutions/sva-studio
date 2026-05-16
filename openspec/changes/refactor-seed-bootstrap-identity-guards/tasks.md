## 1. Spezifikation
- [ ] 1.1 Seed-, Bootstrap- und Reconcile-Semantik für lokale und bestehende Umgebungen in `instance-provisioning` normativ festschreiben
- [ ] 1.2 Deployment-/Betriebsvertrag für bestehende und neue Umgebungen in `deployment-topology` normativ ergänzen

## 2. Umsetzung
- [ ] 2.1 Historische Seeds identifizieren, die geschützte Identitätsfelder autoritativ überschreiben
- [ ] 2.2 Standard-Seeds auf additive oder fill-missing-Semantik für geschützte Felder umstellen
- [ ] 2.3 Explizite Bootstrap-/Reconcile-Pfade für neue oder bewusst zu korrigierende Umgebungen erhalten oder schärfen
- [ ] 2.4 Guardrails für bestehende lokale und staging-nahe Umgebungen ergänzen, damit abweichende Identitätswerte nicht still überschrieben werden
- [ ] 2.5 Tenant-spezifische Auth-Secrets in den Bootstrap-/Reconcile-Vertrag aufnehmen, damit bestehende Umgebungen nicht auf globale Fallback-Secrets zurückfallen
- [ ] 2.6 Repro-Test für bestehenden lokalen Tenant-Zustand ergänzen, der durch einen Seed-Lauf nicht zurückgedreht werden darf
- [ ] 2.7 Readiness- oder Integrationscheck für den vollständigen Tenant-Login-Flow ergänzen, der Registry-Auflösung und tenant-spezifische Secret-Verwendung gemeinsam abdeckt

## 3. Dokumentation und Architektur
- [ ] 3.1 Betroffene arc42-Abschnitte unter `docs/architecture/04-solution-strategy.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/07-deployment-view.md` und `docs/architecture/08-cross-cutting-concepts.md` aktualisieren oder Abweichung begründen
- [ ] 3.2 Betriebs- und Entwicklerdokumentation für lokalen Bootstrap-/Seed-/Reconcile-Vertrag aktualisieren
