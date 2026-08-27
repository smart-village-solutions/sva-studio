# Content-Guidelines

Dieses Dokument beschreibt redaktionelle Mindeststandards für Texte, UI-Inhalte und fachliche Beschriftungen in SVA Studio.

## Ziele

- Inhalte sollen verständlich, präzise und konsistent sein.
- Oberflächen sollen ohne Vorwissen lesbar bleiben.
- Accessibility- und i18n-Anforderungen müssen früh berücksichtigt werden.

## Sprachstil

- kurze, eindeutige Sätze bevorzugen
- Fachbegriffe nur verwenden, wenn sie nötig und im Kontext klar sind
- aktive Formulierungen bevorzugen
- Mehrdeutigkeiten, Füllwörter und rein interne Abkürzungen vermeiden

## Plain Language

Vor jeder Freigabe prüfen:

- Ist die Kernaussage in den ersten ein bis zwei Sätzen verständlich?
- Beschreibt jeder Button oder Link die tatsächliche Aktion?
- Werden Konsequenzen, Fristen oder Fehlerzustände explizit benannt?
- Sind Hinweise und Fehlermeldungen ohne internes Systemwissen verständlich?

## Überschriftenhierarchie

- Pro Seite genau eine inhaltliche Hauptebene.
- Überschriften bilden eine saubere Hierarchie ohne Sprünge.
- Überschriften benennen Inhalt und Aufgabe, nicht nur visuelle Abschnitte.

Beispiele:

- gut: `Zugriff beantragen`
- schwach: `Informationen`

## Linktexte

- Linktexte müssen auch isoliert verständlich sein.
- Generische Texte wie `hier`, `mehr`, `weiter` oder `Link` vermeiden.
- Bei Downloads oder externen Zielen Dateityp oder Zielsystem nennen, wenn relevant.

Beispiele:

- gut: `Deployment-Runbook öffnen`
- gut: `OpenAPI-Spezifikation herunterladen`
- schwach: `Hier klicken`

## Alt-Texte für Bilder und Icons

- informative Bilder erhalten einen Alt-Text mit der relevanten Aussage
- dekorative Bilder erhalten keinen bedeutungstragenden Alt-Text
- rein ikonische Buttons brauchen einen zugänglichen Namen

Faustregel: Der Alt-Text beschreibt den Informationswert, nicht nur das Motiv.

## Formulare

- jedes Feld braucht eine sichtbare Bezeichnung
- Pflichtfelder, Formatvorgaben und Validierungsregeln früh kommunizieren
- Fehlermeldungen benennen das Problem und den nächsten Schritt
- Platzhalter ersetzen keine Labels

## Tabellen

- Tabellen nur für echte tabellarische Daten verwenden
- Spaltenüberschriften müssen eindeutig sein
- Abkürzungen in Tabellen erklären oder vermeiden
- Für kleine Datensätze prüfen, ob eine Liste verständlicher wäre

## Status-, Fehler- und Systemtexte

- klar zwischen Erfolg, Warnung und Fehler unterscheiden
- Ursache und Handlungsempfehlung kombinieren, wenn möglich
- keine internen Stacktraces oder Rohfehler ungefiltert an Endnutzer ausgeben

## Lokalisierung und Konsistenz

- Produkttexte werden nicht hart codiert, sondern über die vorgesehenen i18n-Mechanismen gepflegt
- Begriffe für Rollen, Objekte und Aktionen müssen über Seiten hinweg konsistent bleiben
- Neue Terminologie gehört zuerst in die Fach- oder UI-Dokumentation, wenn sie mehrere Bereiche betrifft

## Freigabe-Checkliste

- Aussage und Zielgruppe sind klar
- Überschriftenhierarchie stimmt
- Linktexte sind selbsterklärend
- Formulare, Tabellen und Medien sind verständlich beschriftet
- Barrierefreiheitsaspekte sind geprüft
- betroffene Doku und Übersetzungen sind aktualisiert

## Verweise

- Accessibility-Richtlinie: `./accessibility.md`
- i18n-Konventionen: `./i18n-key-konventionen-account-ui.md`
- Browser- und AT-Matrix: `../BROWSER-SUPPORT.md`
