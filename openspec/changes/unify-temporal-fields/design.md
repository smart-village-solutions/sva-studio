# Freigegebener Entwurf und Nachweise

## Grenzen

Gemeinsame kleine Bausteine statt einer universellen Komponente mit API-Modi. Frameworkfreie Formatierung und Konvertierung bleiben im SDK, React-Bausteine im UI-Paket. Eine API-Zeitzone ist keine Browserzeitzone. Fachkalender für Jahres-/Mehrfachauswahl bleiben erhalten.

## Wertverträge

| Art                      | Interner/API-Wert                                               | Darstellung                                 |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------- |
| Kalendertag              | `YYYY-MM-DD`, keine Offsetkonvertierung                         | Locale der Redaktion                        |
| Uhrzeit                  | `HH:mm` oder erforderliche Sekundenpräzision                    | Locale, ohne künstliches Datum              |
| Lokales Datum/Uhrzeit    | ISO-Komponenten ohne Offset, nur für bestätigte lokale Verträge | Lokale Bestandteile                         |
| Absoluter Zeitpunkt      | ISO mit Offset/UTC gemäß API                                    | Bestehende Redaktionszeitzone Europe/Berlin |
| Zeitraum/Mehrfachauswahl | Die jeweiligen Einzelwerte, vorhandene Inklusivität             | Passender Fachkalender                      |

## Verbraucher und Verträge

- Events: DatePicker bereits vorhanden; Kalenderdatum und Uhrzeit separat, Zusatzangaben erhalten.
- Baustellen, Jobs, POI-Öffnungszeiten und Abfallwirtschaft: Kalenderdatumfelder und Filter ohne Zeitzonenkonvertierung.
- News-Veröffentlichung, Content-Veröffentlichung, Rechtstexte und Gruppenmitgliedschaften: lokale Bearbeitung absoluter Zeitpunkte über vorhandene SDK-Konvertierung.
- Umfragen und generische Inhalte: Form-/API-Lese- und Schreibpfade vor Migration zusammen prüfen; Namen allein belegen keinen Zeitpunktvertrag.
- API-Schlüssel: Eingabe eines einschließlich geltenden Ablauftags, bestehender API-Adapter berechnet UTC-Beginn des Folgetags.
- Listen, Historien und Statusanzeigen: gemeinsame Formatierung mit ausdrücklich gewählter Semantik; technische Zeitstempel dürfen ihre Präzision nicht verlieren.

## Kritische Invarianten

1. Ein Kalendertag und eine Uhrzeit bleiben unabhängig von Browserzeitzone und Sommerzeit unverändert. Nachweis: Parser/Formatter- und API-Payload-Tests.
2. Laden und unverändertes Speichern erhalten den fachlichen Wert einschließlich Sekunden, Offsetbedeutung und optionaler Werte. Nachweis: Serializer-Roundtrips und bestehende API-Vertragstests.
3. Lokalisierte Texte gelangen nicht in API-Payloads; ungültige/unvollständige Eingaben dürfen nicht als leere gültige Werte gespeichert werden. Nachweis: UI-/Formular- und Requesttests.
4. Absolute Zeitpunkte nutzen die bestehende Redaktionszeitzone. Nicht existente Sommerzeitwerte werden abgewiesen; Referenzwerte bei mehrdeutigen Zeiten bleiben erhalten. Nachweis: bestehende SDK-Tests und ergänzte Randfälle.
5. API-Sonderregeln bleiben beim zuständigen Adapter. Keine Schema- oder Datenmigration. Nachweis: konkrete Payloadassertionen.

## Lieferabschnitte

1. Bestehende gemeinsame Bausteine und Formatierung vervollständigen, unmittelbar gezielt testen.
2. Reine Datums-/Uhrzeitfelder sowie Zeitpunkte und Anzeigen migrieren, pro Verbrauchergruppe kleinste echte Tests/Typechecks.
3. Gesamtinventar, API- und Roundtrip-Nachweise abschließen, Doku fortschreiben. Ersetzte Pfade im selben Abschnitt entfernen.

## Alternativen

Ein universelles Widget mit API-Konfiguration würde Fachkonvertierung in die UI ziehen und wird nicht eingeführt. Nur neue Komponenten ohne Verbrauchermigration erfüllen den Auftrag nicht.

## Konkretisierung nach Reproduktion

Der gemeinsame Parser und der DayPicker konnten unter `Pacific/Apia` den 30.12.2011 auf den Folgetag verschieben beziehungsweise im Raster überspringen. Deshalb verwenden beide vorhandenen Kalenderpfade `UTCDate` aus der etablierten date-fns-UTC-Erweiterung für ihre internen Trägerobjekte und für die neuen Tage des DayPicker. Der gespeicherte/API-Wert bleibt ein Kalendertag, kein UTC-Zeitpunkt. Der Nachweis umfasst direkte Reproduktion, Unit-Tests und Browserinteraktion in abweichenden Zeitzonen.

Die vorhandene UI-Grenze verbietet SDK-Root-Imports. Statt einer Ausnahme für diese Imports ergänzt `plugin-sdk/temporal` einen schmalen browserfähigen Vertrag aus bereits vorhandenen Hilfsfunktionen und der gemeinsamen Übersetzungsauflösung. ESLint erlaubt genau diesen zusätzlichen Subpath; Root- und andere Subpath-Imports bleiben gesperrt. Es entsteht kein neuer Provider, kein neues Package und keine eigene Kalenderarithmetik.

Auch lokale Datum-/Uhrzeiteingaben und `InstantInput` komponieren denselben `DateInput` mit `TimeInput`. Native kombinierte Datum-/Uhrzeitfelder konnten in der Browserprüfung trotz deutscher Oberfläche US-Datumssegmente anzeigen; dieser alternative Datumspfad wird vollständig entfernt. Die bestehenden Formular-/API-Adapter erhalten weiterhin genau einen lokalen beziehungsweise absoluten Wert. Nur Uhrzeiten verwenden die native Uhrzeiteingabe.
