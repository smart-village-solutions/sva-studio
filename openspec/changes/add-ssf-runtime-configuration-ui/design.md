## Context

Die wirksame SSF-Konfiguration entsteht bereits im Plugin aus Produktdefaults,
serverweiten Vorgaben und tenantlokalen Overrides. Die UI darf weder eine
zweite Konfigurationslogik noch eine zweite Tenant-Registry einführen.

## Goals / Non-Goals

### Goals

- Root-Editor für installationsweite Standards bereitstellen.
- Tenant-Editor für optionale Overrides bereitstellen.
- Vorhandene Plugin-, Auth-, Datenbank- und Formulargrenzen wiederverwenden.
- Systemstandard, Tenant-Override und wirksamen Wert unterscheidbar machen.

### Non-Goals

- Keine Branding-, Logo- oder Icon-Verwaltung.
- Keine Bearbeitung von Tenantname oder Zeitzone.
- Kein Draft-/Publish-, Versions- oder Freigabemodell.
- Keine neue Rich-Text- oder Formularbibliothek.

## Decisions

### Beide Oberflächen bleiben Plugin-Contributions

Das SSF-Plugin registriert eine Root-Route unter `System → SSF-Standards` und
eine Tenant-Route unter `Anwendungen → SSF-Konfiguration`. Dadurch bleibt ein
Studio ohne SSF-Plugin SSF-neutral. Sichtbarkeit und Serverzugriff verwenden
getrennte fully-qualified Actions. Der Tenant-Client sendet keine frei wählbare
`instanceId`; der Server bindet den Tenant aus dem verifizierten Kontext.
Root-Zugriffe bleiben explizit installationsweit.

### Beide Ebenen bearbeiten denselben kleinen Wertebereich

Der Root-Editor enthält Standardsprache, verfügbare Sprachen, je Sprache die
drei Erklärungstexte sowie Gesprächsspeicherung `ask` oder `disabled`.

Der Tenant-Editor zeigt dafür Systemstandard, optionalen Tenant-Override und
wirksamen Wert. Overrides können einzeln gesetzt oder über „Systemstandard
verwenden“ entfernt werden. Die Standardsprache muss aktiv sein. Bei
`disabled` ist die Speicherfrage nicht erforderlich und wird wirksam `null`.
Branding-Felder werden weder angezeigt noch in UI-Verträgen mitgeführt.

### Gespeicherte und wirksame Werte bleiben getrennt

Die Root-API liefert und ändert Systemstandards. Die Tenant-API liefert
Systemstandards, Tenant-Overrides und die mit dem Runtime-Resolver aufgelöste
wirksame Konfiguration. Nach erfolgreichem Speichern laden beide UIs den
bestätigten Stand erneut; die Tenant-UI zeigt die `configurationRevision`.

### HTML und Persistenz bleiben serverseitig abgesichert

Die UI verwendet vorhandene Studio-Rich-Text-Primitives. Der Server validiert
Größen und bereinigt HTML erneut mit der SSF-Sanitization. Systemeinstellungen
und Systemsprachen beziehungsweise Tenant-Einstellungen und Tenant-Sprachen
werden jeweils atomar gespeichert.

## UI-Struktur

Beide Seiten folgen den bestehenden Studio-Einstellungen:

1. Kopf mit Titel, Beschreibung und Status,
2. Karte für Standardsprache und verfügbare beziehungsweise aktive Sprachen,
3. Sprach-Tabs mit drei Textfeldern; tenantlokal zusätzlich mit Herkunft und
   „Systemstandard verwenden“,
4. Karte für Gesprächsspeicherung,
5. Formularaktionen mit Speichern und Verwerfen.

Validierungsfehler erscheinen am Feld und zusammengefasst. Fokusführung,
Tastaturbedienung und Statusmeldungen folgen den Accessibility-Konventionen.

## Risks / Trade-offs

- Der Slice benötigt schmale Schreibendpunkte; eine reine React-Oberfläche wäre
  nicht nutzbar und unsicher.
- Systemänderungen wirken sofort auf nicht überschriebene Tenantwerte. Die
  Tenant-Seite macht diese Vererbung explizit sichtbar.
- Bestätigter Read-back genügt zunächst; Locking und Drafts wären Overengineering.
