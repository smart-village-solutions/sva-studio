# Redaktionsorientierung

## Zielgruppen

Das Studio richtet sich nicht an eine einheitliche Rolle. Die Dokumentation sollte mindestens
zwischen folgenden Nutzungskontexten unterscheiden:

- Redakteurinnen und Redakteure pflegen Inhalte, Medien und fachliche Module.
- Instanzadministrierende verwalten Benutzer, Organisationen, Rollen, Gruppen, Module,
  Schnittstellen und Rechtstexte.
- Fachadministrierende arbeiten in einzelnen Modulen wie Abfallmanagement oder Umfragen.
- Betriebs- und Compliance-Rollen prüfen Jobs, Berechtigungen, Governance- und Datenschutzfälle.
- Angemeldete Personen verwalten das eigene Profil, eigene Datenschutzvorgänge und persönliche
  Inhaltsregeln.

Welche Seite und Aktion sichtbar ist, hängt von Instanz, Modulzuweisung, Rolle, Berechtigung,
Organisation und teilweise Feature-Flags ab. Formulierungen wie „Sie sehen immer“ oder „Jeder
Benutzer kann“ sind deshalb zu vermeiden, sofern der Steckbrief keine eindeutige Evidenz nennt.

## Einordnung der gelieferten Informationen

- **Produktfakt:** Im aktuellen Codepfad, in der UI oder durch einen zugehörigen Test belegt.
- **Kontextabhängig:** Hängt von Berechtigung, aktivem Modul, Organisation, Instanz oder
  Laufzeitkonfiguration ab.
- **Redaktioneller Hinweis:** Vorschlag für Erklärung, Beispiel oder Querverweis.
- **Offene Frage:** Benötigt eine fachliche Entscheidung oder zusätzliche Laufzeitevidenz.

## Übergreifende Arbeitsprinzipien

### Berechtigungen und Module

Eine Modulzuweisung schaltet einen Fachbereich für eine Instanz frei. Rollen und direkte
Berechtigungen bestimmen, welche Aktionen innerhalb dieses Bereichs zulässig sind. Das bloße
Vorhandensein eines Menüpunkts ist kein Nachweis für Schreibrechte.

### Persönlicher und organisatorischer Schreibkontext

Mehrere Mainserver-gestützte Inhaltstypen können als persönliche Person oder im Kontext einer
aktiven Organisation bearbeitet werden. Der ausgewählte Principal bestimmt die verwendeten
Mainserver-Zugangsdaten. Fehlt ein eindeutiger Kontext oder passende Credentials, bleiben
Schreibaktionen gesperrt oder schlagen mit einer erklärten Fehlermeldung fehl.

### Speichern, Veröffentlichen und Sichtbarkeit

Diese Begriffe sind nicht austauschbar. Je nach Inhaltstyp gibt es Entwurf, zeitgesteuerte oder
sofortige Veröffentlichung, einen Aktiv- oder Sichtbarkeitsschalter oder einen eigenen Status.
Die Redaktion sollte pro Seite nur den im Steckbrief belegten Lebenszyklus beschreiben.

### Historie

Bei mehreren Inhaltstypen zeigt die Historie ausschließlich erfolgreiche Änderungen, die über das
Studio ausgeführt wurden. Änderungen aus anderen Systemen können fehlen. Bei neuen Einträgen wird
die Historie regelmäßig erst nach dem ersten Speichern verfügbar.

### Gefährliche oder irreversible Aktionen

Löschen kann je nach Bereich physisch, logisch oder wegen bestehender Referenzen blockiert sein.
Warnungen dürfen nicht vereinheitlicht werden. Maßgeblich ist der jeweilige Steckbrief.

### Fehler und Diagnoseangaben

Request-IDs, sichere Fehlercodes und technische Diagnosen sind für Supportfälle hilfreich, aber
kein Ersatz für eine verständliche Handlungsanweisung. Secrets, Tokens, personenbezogene Daten und
interne Metadaten dürfen nicht in Beispielen abgebildet werden.

## Empfohlene Struktur einer veröffentlichten Hilfeseite

1. Wofür ist diese Seite gedacht?
2. Was benötigen Sie vorher?
3. Welche Aufgaben können Sie hier erledigen?
4. Schritt-für-Schritt-Ablauf für die häufigste Aufgabe
5. Bedeutung wichtiger Felder und Zustände
6. Was passiert nach dem Speichern oder Ausführen?
7. Häufige Probleme und sichere nächste Schritte
8. Verwandte Hilfeseiten

Die Struktur darf redaktionell verändert werden. Wichtig ist, dass Voraussetzungen, Folgen und
Kontextabhängigkeiten nicht hinter einer reinen Feldbeschreibung verschwinden.
