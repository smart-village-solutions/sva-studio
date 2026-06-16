# Design: Gesammelte Event-Beschreibungen im Public-Waste-iCal

## Kontext
Der Public-Waste-iCal-Feed exportiert pro Termin aktuell nur den Fraktionsnamen als `SUMMARY` und optional eine einzelne Notiz als `DESCRIPTION`. Fachliche Zusatzinformationen aus Fraktion und Tour bleiben damit in Kalender-Clients unsichtbar.

## Zielbild
Jedes `VEVENT` soll eine kompakte, aber vollständige `DESCRIPTION` erhalten, die alle verfügbaren Hinweise des Termins gesammelt ausgibt. Die kalenderweite Beschreibung mit dem Abholort bleibt zusätzlich auf `VCALENDAR`-Ebene bestehen.

## Entscheidungen
- Die Event-`SUMMARY` bleibt kurz und enthält weiterhin nur den Fraktionsnamen.
- Die Event-`DESCRIPTION` sammelt verfügbare Inhalte in stabiler Reihenfolge:
  1. Fraktionsbeschreibung
  2. Tourbeschreibung
  3. Terminnotiz
- Leere Texte und inhaltsgleiche Wiederholungen werden unterdrückt.
- Die Fraktionsbeschreibung wird in das öffentliche Kalenderdatenmodell aufgenommen, damit Repository, UI und Export auf denselben Fachdatensatz zugreifen.

## Format
Die `DESCRIPTION` wird mehrzeilig erzeugt. Beispiel:

```text
Fraktion: Bioabfall aus Küche und Garten
Tour: Regelabfuhr für die Innenstadt
Hinweis: Verschoben wegen Feiertag
```

## Abgrenzung
- Kein Umbau der `SUMMARY`
- Keine zusätzlichen proprietären iCal-Event-Felder
- Keine Änderung der kalenderweiten Abholort-Beschreibung
- Keine Personalisierung des öffentlichen Default-ICS; spätere private/personalisierte ICS-Links mit `VALARM`-Logik sind als Folgearbeit in GitHub-Issue `#557` vorgemerkt

## Tests
- iCal-Renderer prüft die zusammengesetzte `DESCRIPTION`
- Endpoint-Test prüft den Exportpfad mit gesammelten Hinweisen
- Repository-Test prüft die Projektion einer Fraktionsbeschreibung in öffentliche Kalendereinträge
