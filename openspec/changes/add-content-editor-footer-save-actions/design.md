## Context

Die spezialisierten Inhaltseditoren besitzen unterschiedliche fachliche Formularmodelle, verwenden aber überwiegend `StudioDetailPageTemplate` und eine formularweite Primäraktion im Seitenkopf. Vergleichbare lange Arbeitsflächen existieren in der Benutzerbearbeitung, der Rechtstextverwaltung und der Rollenberechtigungsmatrix. Die relevante Primäraktion gehört jeweils zur gesamten Formular- oder Teilflächengrenze und nicht zu einem einzelnen Tab, Feld oder Tabellenabschnitt.

## Goals / Non-Goals

- Goals:
  - Speichern ohne Zurückscrollen ermöglichen
  - identisches Verhalten in langen Bearbeitungsflächen sicherstellen
  - Layout-Ownership für wiederholte Primäraktionen in `studio-ui-react` bündeln
  - vorhandene fachliche Submit-Logik unverändert wiederverwenden
  - neuen Plugins ein dokumentiertes und ausführbares Golden-Path-Pattern geben
- Non-Goals:
  - kein Speichern einzelner Tabs
  - keine Änderung an Validierung, Persistenz oder Berechtigungen
  - keine Verdopplung destruktiver, navigierender oder zurücksetzender Sekundäraktionen
  - keine sticky oder schwebende Aktionsleiste

## Decisions

- Decision: `StudioDetailPageTemplate` erhält einen semantischen `primaryAction`-Vertrag und rendert diese Aktion bei seitengroßen Bearbeitungsflächen im Kopfbereich und nach dem Seiteninhalt.
  - Rationale: Das Template besitzt bereits die Layout-Ownership für Detailseiten. Der semantische Vertrag verhindert, dass neue Plugins die zweite Position versehentlich auslassen, und trennt die wiederholte Commit-Aktion von ausschließlich oben sichtbaren Navigations- oder Löschaktionen.

- Decision: Eingebettete lange Teilflächen verwenden eine gemeinsame `StudioFormActionBar` oberhalb und unterhalb ihres fachlichen Inhalts.
  - Rationale: Die Rollenberechtigungsmatrix besitzt eine eigene Mutationsgrenze innerhalb einer größeren Detailseite und darf nicht an eine globale Seitenspeicherung gekoppelt werden.

- Decision: Die wiederholte Primäraktion wird nicht anhand des aktiven Tabs ausgeblendet.
  - Rationale: Die Aktion speichert das gesamte Formular und ist daher auch im Historien-Tab fachlich gültig.

- Decision: Das Pattern gilt für Tabs, Rich-Text-Flächen, lange Listen oder Tabellen und Bearbeitungsflächen über mehrere Bildschirmhöhen; kurze Dialoge und kompakte Einzelformulare bleiben ausgenommen.
  - Rationale: Eine allgemeine Verdopplung aller Submit-Buttons würde visuelles Rauschen erzeugen und wäre für kurze Interaktionen ohne Scrollproblem nicht hilfreich.

- Decision: Der Plugin-Guide enthält ein vollständiges TypeScript-Beispiel und eine Review-Checkliste.
  - Rationale: Gemeinsame Komponenten sichern den ausführbaren Pfad, während Einsatzgrenzen, Accessibility und Ownership-Regeln für Plugin-Autoren normativ auffindbar bleiben müssen.

## Risks / Trade-offs

- Zwei gleich benannte Buttons erfordern Tests, die bewusst zwischen oberer und unterer Aktion unterscheiden. Die zugängliche Beschriftung bleibt identisch, weil beide Aktionen semantisch dasselbe ausführen.
- Zwei Positionen dürfen nicht zu auseinanderlaufenden Zuständen oder doppelten gleichzeitigen Submits führen. Gemeinsame Handler- und Statusquellen sowie Template-, Action-Bar- und Fachseitentests sichern dies ab.
- Die Migration bestehender Seiten auf gemeinsame Layout-Primitives darf deren Formulargrenzen, Validierung, Berechtigungen oder Unsaved-Changes-Verhalten nicht verändern.

## Migration Plan

1. `primaryAction` im gemeinsamen Detailseiten-Template und die gemeinsame `StudioFormActionBar` ergänzen und testen.
2. Die sechs spezialisierten Inhaltseditoren und den Kern-Inhaltseditor migrieren.
3. Benutzerbearbeitung, Rollenberechtigungsmatrix sowie Rechtstexterstellung und -bearbeitung migrieren.
4. Plugin- und Detailseiten-Guides um das verbindliche Pattern ergänzen.
5. Gezielte Unit- und Type-Gates ausführen.

## Open Questions

Keine.
