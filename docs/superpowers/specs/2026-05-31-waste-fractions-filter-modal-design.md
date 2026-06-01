# Design: Filter-Modal fuer Fraktionen im Waste Management

## Kontext

Die Fraktionen-Liste im Waste-Management-Plugin besitzt bereits eine bestehende Filterlogik fuer aktive und inaktive Eintraege. Diese Logik wird derzeit ueber den allgemeinen Search-Param `status` gesteuert. In der Fraktionen-Tabellenansicht fehlt jedoch ein eigener, expliziter UI-Einstiegspunkt, ueber den Benutzer diesen Filter bedienen koennen.

Zusaetzlich wird derselbe `status`-Param auch in anderen Waste-Views verwendet. Ein Fraktionen-spezifischer Filter ueber diesen globalen Param fuehrt deshalb zu unnoetiger Kopplung zwischen Tabs.

## Ziele

- Die Fraktionen-Liste zeigt einen Button `Filtern`.
- Ein Klick auf `Filtern` oeffnet ein Modal.
- Das Modal bietet genau die fachlich benoetigten Statusoptionen fuer Fraktionen an.
- Der gewaehlte Filter bleibt reload-stabil und ueber den Deep-Link reproduzierbar.
- Der Fraktionen-Filter ist von anderen Waste-Views entkoppelt.

## Nicht-Ziele

- Kein generisches, tabuebergreifendes Filter-Framework.
- Keine Erweiterung um weitere Fraktionen-Filter wie Farbe, Containergroesse oder Freitext.
- Keine serverseitige Aenderung an der Datenabfrage; die bestehende clientseitige Filterung bleibt erhalten.

## Empfohlener Ansatz

Die Fraktionen-Ansicht erhaelt einen eigenen Search-Param fuer den Statusfilter, statt den bestehenden globalen `status`-Param weiterzuverwenden.

Empfohlener neuer Param:

- `fractionsStatus` mit den erlaubten Werten `all`, `active`, `inactive`

Begruendung:

- Die bestehende Waste-Spec fordert reload-stabile fachliche Filter ueber typisierte Search-Params.
- Fraktionen und Touren/Abholorte sollen sich beim Filtern nicht gegenseitig beeinflussen.
- Das vorhandene Muster fuer typisierte Search-Params kann ohne neue Architekturbausteine erweitert werden.

## Nutzerfluss

1. Ein Benutzer oeffnet die Fraktionen-Liste unter `/plugins/waste-management`.
2. In der Tabellen-Toolbar sieht er den Button `Filtern`.
3. Ein Klick auf den Button oeffnet ein Modal mit den Fraktionen-Statusoptionen.
4. Der Benutzer waehlt `Alle`, `Aktive Fraktionen` oder `Inaktive Fraktionen`.
5. Das Plugin schreibt die Auswahl in den Search-Param `fractionsStatus`.
6. Nach dem Anwenden oder Schliessen bleibt die Fraktionen-Liste entsprechend gefiltert.
7. Ein Reload oder ein geteilter Link stellt denselben Filterzustand wieder her.

## UI-Design

### Toolbar

Die bestehende Fraktionen-Toolbar wird um einen sekundaeren Button `Filtern` erweitert. Der Button soll das vorhandene Waste-Pattern fuer Filtereinstiege aufnehmen und mit einem Filter-Icon markiert werden.

### Modal

Das Modal ist klein und fokussiert. Es benoetigt:

- Titel fuer den Fraktionen-Filter
- kurze Beschreibung
- genau eine Eingabe fuer den Status
- Primaeraktion zum Anwenden
- Sekundaeraktion zum Schliessen oder Abbrechen

Die Statusauswahl enthaelt:

- `Alle`
- `Aktive Fraktionen`
- `Inaktive Fraktionen`

Es wird kein Inline-Filterpanel und kein persistenter Seitenbereich eingefuehrt. Die Bedienung erfolgt ausschliesslich ueber das Modal.

## Zustandsmodell

Die typisierte Search-Param-Normalisierung wird um `fractionsStatus` erweitert. Die Fraktionen-Praesentation filtert danach statt nach dem globalen `status`.

Regeln:

- Ungueltige Werte werden auf `all` normalisiert.
- Bisherige Filter fuer Touren, Standorte oder Scheduling bleiben unveraendert.
- Die Fraktionen-Ansicht darf keine Seiteneffekte auf andere tab-spezifische Filter erzeugen.

## Uebersetzungen

Es werden neue i18n-Keys fuer den Filter-Button und das Modal benoetigt. Dazu gehoeren mindestens:

- Button-Label `Filtern`
- Modal-Titel
- Modal-Beschreibung
- Feld-Label fuer den Status
- Optionen `Alle`, `Aktive Fraktionen`, `Inaktive Fraktionen`
- Action-Labels fuer Anwenden und Abbrechen

Hardcodierte UI-Texte sind ausgeschlossen.

## Tests

Mindestens folgende Tests werden ergaenzt oder angepasst:

- Search-Param-Normalisierung akzeptiert `fractionsStatus` und faellt bei ungueltigen Werten auf `all` zurueck.
- Die Fraktionen-Praesentation filtert korrekt fuer `all`, `active` und `inactive`.
- Die Fraktionen-Toolbar rendert den Button `Filtern`.
- Ein Klick auf `Filtern` oeffnet das Modal.
- Das Anwenden des Modals schreibt den erwarteten Search-Param.
- Bestehende Touren- oder Standortfilter bleiben von `fractionsStatus` unberuehrt.

## Architektur- und Dokuwirkung

Die Aenderung erweitert nur den bestehenden UI- und Search-Param-Vertrag innerhalb der bereits vorhandenen Waste-Management-Capability. Es entsteht kein neuer Architekturbaustein und kein geaenderter Server- oder Datenbankvertrag.

Damit ist voraussichtlich keine Fortfuehrung der arc42-Abschnitte erforderlich. Falls sich waehrend der Umsetzung doch eine uebergreifende Filter-Governance-Aenderung ergibt, waeren primaer Abschnitt 5 und 8 betroffen.
