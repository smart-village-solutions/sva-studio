# Tasks

## 1. Spezifikation

- [ ] 1.1 Bestehende Specs `account-ui` und `iam-access-control` um das Rechteverwaltungs-UI und Ownership-Modell erweitern
- [ ] 1.2 Use-Cases, User-Stories, Scope-Dimensionen sowie den benötigten IAM-Contract für Vorschau und operative Autorisierung in den Delta-Specs verbindlich verankern
- [ ] 1.3 `shadcn/ui` als UI-Standard für neue Rechteverwaltungs-Komponenten und lokalisierte UI-Bezeichnungen statt Contract-IDs im Change festschreiben

## 2. UX- und Interaktionsdesign

- [ ] 2.1 Rollen-Detailarbeitsbereich mit Tabs `Allgemein`, `Berechtigungen`, `Zuweisungen` und `Vorschau` spezifizieren
- [ ] 2.2 Rechte-Matrix für `Lesen`, `Erstellen`, `Bearbeiten`, `Löschen` und `Exportieren` spezifizieren
- [ ] 2.3 Scope-Interaktionen für Module, Datentypen, räumliche Kategorien, inhaltliche Kategorien, Organisationen und Instanzen spezifizieren
- [ ] 2.4 Ownership-Komponenten für Besitzregeln und Besitzübertragung spezifizieren
- [ ] 2.5 Vorschau- und Szenario-Prüfung für nachvollziehbare Rechteentscheidungen auf Basis derselben serverseitigen Entscheidungsfelder wie operative Prüfungen spezifizieren
- [ ] 2.6 Änderungsreview, Dirty-State-Verhalten, Tastaturbedienung, Screenreader-Semantik und responsive Alternativmuster für den Berechtigungsarbeitsbereich spezifizieren

## 3. Fach-UI-Integration

- [ ] 3.1 Einheitliche Zustände für erlaubte, deaktivierte, verborgene und ownership-blockierte Aktionen spezifizieren
- [ ] 3.2 Anforderungen an priorisierte Fachseiten wie Content in die betroffenen Specs aufnehmen

## 4. Sicherheits- und Governance-Guardrails

- [ ] 4.1 Ownership-Override als separates Privileg, Audit-Evidenz, Self-Override-Verbot und zulässige Instanz-/Organisationsgrenzen in den Specs festschreiben
- [ ] 4.2 Sofort wirksame Besitzübertragung nur mit transaktionalen Guardrails, Invalidation und strukturierten Reason-Codes spezifizieren

## 5. Architektur und Dokumentation

- [ ] 5.1 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `09`, `10` und `11` unter `docs/architecture/` referenzieren und die benötigte ADR für Ownership-/Override-/Explainability-Muster festhalten
- [ ] 5.2 Terminologie für Besitz/Besitzregel/Geltungsbereich/Übersteuerung und den Umgang mit technischen Contract-IDs dokumentieren

## 6. Verifikation

- [ ] 6.1 Negative und Konfliktszenarien für Scope, Ownership, Override, Save-Konflikte und Vorschau-vs.-Laufzeit-Entscheidungen in den Delta-Specs ergänzen
- [ ] 6.2 Verifikationsstrategie für Unit-, Integrations-, E2E-, Accessibility-, Responsive- und i18n-Prüfungen für die spätere Umsetzung festhalten
- [ ] 6.3 Proposal mit `openspec validate add-iam-permission-management-ui --strict` validieren
