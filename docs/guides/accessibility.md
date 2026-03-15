# Accessibility

Dieses Dokument ist die zentrale Accessibility-Richtlinie und das öffentliche Accessibility Statement für SVA Studio.

## Geltungsbereich

Die Richtlinie gilt für Web-Oberflächen, Interaktionen, Formulare, Navigation und inhaltliche Komponenten im Repository. Maßgeblich ist der aktuell gepflegte Stand auf `main`.

## Zielstandard

SVA Studio richtet sich an WCAG 2.1 AA aus. Diese Zielsetzung ist auch in den allgemeinen Entwicklungsregeln verankert.

## Accessibility Statement

Wir arbeiten daran, SVA Studio für möglichst viele Menschen nutzbar zu machen. Die Anwendung ist teilweise mit WCAG 2.1 AA konform. Maßgeblich sind dabei semantische Strukturen, Tastaturbedienbarkeit, verständliche Benennung und belastbare Formulare.

Aktueller Stand:

- Kernnavigation, Standardformulare und wesentliche Interaktionspfade müssen ohne Maus nutzbar sein.
- Neue UI-Änderungen sollen vor Merge auf offensichtliche Accessibility-Regressions geprüft werden.
- Bekannte Lücken werden offen dokumentiert und nicht als Vollkonformität dargestellt.

## Verbindliche Regeln

### Tastatur und Fokus

- Alle interaktiven Elemente müssen per Tastatur erreichbar sein.
- Fokus darf nie unsichtbar werden.
- Fokusreihenfolge folgt der visuellen und inhaltlichen Logik.
- Dialoge, Menüs und Overlays müssen Fokus sauber halten und wieder zurückgeben.

### Semantik und Struktur

- Überschriftenhierarchie muss konsistent bleiben.
- Buttons, Links und Formularfelder brauchen zugängliche Namen.
- Statusmeldungen und Fehler müssen von Assistive Technologies wahrnehmbar sein.
- Tabellen dürfen nicht für Layout missbraucht werden.

### Formulare und Validierung

- Jedes Feld hat ein Label.
- Pflichtfelder und Formatregeln werden verständlich beschrieben.
- Fehlermeldungen benennen Problem und nächsten Schritt.
- Nur Farbe als Fehlersignal ist unzulässig.

### Medien, Bilder und visuelle Gestaltung

- Informative Bilder brauchen geeignete Alt-Texte.
- Dekorative Bilder bleiben für Screenreader stumm.
- Kontraste, Fokus-Indikatoren und skalierbare Texte dürfen nicht durch CSS geschwächt werden.
- Bewegung und Animationen dürfen keine Pflicht für die Kernbedienung sein.

## Teststrategie

Accessibility ist Teil der allgemeinen Teststrategie:

- High-Level-Strategie: `../development/testing-strategy.md`
- Browser- und Assistive-Technology-Matrix: `../BROWSER-SUPPORT.md`
- allgemeine Test- und Coverage-Governance: `../development/testing-coverage.md`

Mindesterwartung vor Merge:

- Tastatur-Navigation der betroffenen UI prüfen
- Fokuszustände und sichtbare Beschriftungen prüfen
- offensichtliche Screenreader-Blocker und Kontrastprobleme ausschließen

## Unterstützte Browser und Assistive Technologies

Die verbindliche Matrix für Browser, Geräte und Screenreader liegt unter `../BROWSER-SUPPORT.md`. Diese Richtlinie dupliziert die Matrix bewusst nicht.

## Bekannte Lücken und Roadmap

Aktuell gehen wir von teilweiser Konformität aus. Typische Restarbeiten, die aktiv beobachtet werden müssen:

- inkonsistente Fokusführung in neuen oder komplexen UI-Flows
- unzureichend präzise Link- und Button-Texte in frühen Feature-Ständen
- fehlende oder zu generische Alt-Texte bei neuen Inhaltskomponenten
- manuelle Screenreader-Prüfung nicht für jede Änderung in gleicher Tiefe

Diese Lücken sind kein Freibrief. Sie müssen bei betroffenen Änderungen konkret bewertet und bei Bedarf als Folgearbeit erfasst werden.

## Meldung von Barrierefreiheitsproblemen

Nicht-sensitive Rückmeldungen können als GitHub Issue erfasst werden. Alternativ können Hinweise per E-Mail an `operations@smart-village.app` gesendet werden.

Für gute Reproduzierbarkeit sollten Meldungen enthalten:

- betroffene Seite oder Route
- Browser und Version
- Betriebssystem
- eingesetzte Assistive Technology, falls vorhanden
- konkrete Schritte und beobachtetes Verhalten

## Verweise

- Content-Guidelines: `./content-guidelines.md`
- Browser-Support: `../BROWSER-SUPPORT.md`
- Testing-Strategie: `../development/testing-strategy.md`
- Entwicklungsregeln: `../../DEVELOPMENT_RULES.md`
