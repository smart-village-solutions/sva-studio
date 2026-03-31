# Change: UI- und IAM-Contract-Spezifikation für rollenbasierte Rechteverwaltung mit Ownership

## Why

Die bestehende IAM-/Admin-Oberfläche zeigt Rollen, Gruppen und effektive Berechtigungen bereits an, bietet aber noch keine fachlich verständliche und konsistente Oberfläche, um Berechtigungen pro Rolle entlang der relevanten Domänenachsen zu vergeben und Ownership-Regeln für Datensätze zu verwalten.

Für SVA Studio werden dafür ein belastbares UI-Konzept, eine spezifizierte Interaktionsarchitektur und ein dazu passender IAM-Contract benötigt, die Exportrechte je Ressource, übertragbaren Besitz sowie mehrdimensionale Geltungsbereiche über Module, Datentypen, räumliche Kategorien, inhaltliche Kategorien, Organisationen und Instanzen abbilden.

## What Changes

- Einführung eines UI-Konzepts für rollenbasierte Rechteverwaltung in den bestehenden Admin-Bereichen
- Ergänzung des IAM-Contracts um strukturierte Scope-, Ownership- und Explainability-Felder für Admin- und Fach-UI
- Erweiterung der Rollenverwaltung um einen Berechtigungsarbeitsbereich mit den Tabs `Allgemein`, `Berechtigungen`, `Zuweisungen` und `Vorschau`
- Spezifikation einer fachlichen Rechte-Matrix pro Ressource mit eigenständigem Exportrecht
- Spezifikation eines separaten Ownership-Modells für Datensatzbesitz, Besitzübertragung und besitzabhängige Entscheidungsregeln
- Festlegung einer initialen Modul- und Datentyp-Taxonomie als kanonische Startmenge stabiler IDs für die erste Version der Rechteverwaltung
- Spezifikation von Scope- und Filtermodellen für Module, Datentypen, räumliche Kategorien, inhaltliche Kategorien, Organisationen und Instanzen
- Verankerung, dass neue Komponenten für diese Oberfläche auf `shadcn/ui`-Primitives basieren
- Festlegung, dass Ownership-Übersteuerungen als separates, eng begrenztes Privileg modelliert werden
- Festlegung, dass Besitzübertragungen sofort wirksam sind, aber transaktional, auditierbar und innerhalb zulässiger Mandanten- und Organisationsgrenzen erfolgen
- Definition konsistenter Zustände für Fach-UI-Aktionen, damit Rechte und Ownership nicht nur serverseitig mit `403`, sondern auch UI-seitig verständlich abgebildet werden
- Festlegung, dass Vorschau und Szenario-Prüfung dieselben serverseitigen Entscheidungsgrundlagen wie operative Autorisierungsprüfungen verwenden

## Impact

- Affected specs:
  - `account-ui`
  - `iam-access-control`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/roles/*`
  - `apps/sva-studio-react/src/routes/admin/users/*`
  - `apps/sva-studio-react/src/routes/admin/groups/*`
  - `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
  - `apps/sva-studio-react/src/routes/content/*`
  - `apps/sva-studio-react/src/components/ui/*`
  - `packages/core/src/iam/*`
  - `packages/auth/src/iam-authorization/*`
  - `packages/auth/src/iam-account-management/*`
- Affected arc42 sections:
  - `04 Solution Strategy`
  - `05 Building Block View`
  - `06 Runtime View`
  - `08 Crosscutting Concepts`
  - `09 Architecture Decisions`
  - `10 Quality Requirements`
  - `11 Risks and Technical Debt`
