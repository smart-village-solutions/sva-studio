# Design: Waste-Output-PDF im Waste-Management

> Hinweis: Dieses Design ist fachlich überholt. Der aktuelle Zielvertrag liegt in [2026-06-06-public-waste-pdf-export-shift-design.md](./2026-06-06-public-waste-pdf-export-shift-design.md). Das Studio erzeugt keine PDFs mehr; die Erzeugung erfolgt ad hoc in der öffentlichen Web-App.

## Kontext
Das Waste-Management besitzt bereits gepflegte Fachdaten zu Abholorten, Touren, Fraktionen und Ausweichterminen. Ein älterer Beispielgenerator unter `scripts/ops/waste-calendar-example-pdf*.ts` zeigt ein passendes Layout, ist aber nicht produktiv nutzbar, weil er mit Platzhalterdaten arbeitet und außerhalb der Studio-Runtime lebt.

Für den ersten produktiven Ausbau wird ein schmaler PDF-Ausgabepfad benötigt. Der Umfang bleibt bewusst klein: genau ein Abholort, genau ein Jahr, keine Vorschau, keine Mehrjahreslogik, keine Sammelausgabe und keine Fraktionsfilter.

## Ziele
- Einen produktiven PDF-Ausdruck für genau einen Abholort und genau ein Jahr bereitstellen
- Das bestehende Beispiel-Rendering fachlich und technisch in einen produktiven Package-Pfad überführen
- Im Waste-Management einen neuen Tab `Ausgabe` mit einer ersten Card `PDF-Ausdruck` bereitstellen
- Erzeugte PDFs dauerhaft speichern und bei erneuter Erzeugung für dieselbe Kombination aus Abholort und Jahr still überschreiben
- Vorhandene PDFs zusätzlich in der Tabelle `Abholorte` direkt verlinken

## Nicht-Ziele
- Mehrjahresausgaben
- Sammelausgaben für Ort, Region oder Straße
- Manuelle Fraktionsauswahl
- Eingebettete PDF-Vorschau im Studio
- Versionierung oder Historisierung von PDF-Artefakten
- Asynchrone Job-Orchestrierung für die Erzeugung

## Empfohlener Ansatz
Variante 1 wird umgesetzt: ein schlanker Artefaktpfad im Waste-Modul. Der Server erzeugt das PDF für `collectionLocationId + year`, speichert es unter einem deterministischen Pfad und überschreibt ein bestehendes Artefakt derselben Kombination ohne zusätzlichen Bestätigungsdialog. Die Tabelle `Abholorte` zeigt einen direkten Link auf das gespeicherte Artefakt.

Der Ansatz ist für den ersten Ausbau ausreichend, weil er keinen zusätzlichen Metadaten- oder Job-Vertrag einführt und den Scope eng am fachlichen Bedarf hält.

## Architektur
Die Umsetzung wird in drei klar getrennte Verantwortungsbereiche geschnitten:

1. Dokumentmodell und Rendering
Ein produktiver PDF-Baustein übernimmt die Layout- und Renderidee des Beispielgenerators. Dokumentmodell, Datenaufbereitung und PDF-Rendering werden aus dem Script-Pfad herausgelöst und in einen regulären Workspace-Pfad überführt. Das Script bleibt Referenz, ist aber kein produktiver Laufzeitvertrag.

2. Serverseitige Erzeugung
Ein serverseitiger Waste-Management-Pfad nimmt `collectionLocationId` und `year` entgegen, löst die aktive Instanz auf, lädt die nötigen Waste-Daten und baut daraus das PDF-Dokument. Das Artefakt wird anschließend persistent gespeichert.

3. Plugin-UI
Das Plugin bietet nur Konfiguration und Zugriff. Die UI startet die Erzeugung, zeigt Erfolgs- oder Fehlerzustände und verlinkt vorhandene PDFs. Renderlogik und Datenbankzugriff bleiben vollständig serverseitig.

## Datenfluss
1. Ein berechtigter Benutzer öffnet im Waste-Management den Tab `Ausgabe`.
2. Die Card `PDF-Ausdruck` lädt auswählbare Abholorte und ein Jahr.
3. Nach dem Auslösen der Aktion sendet das Plugin `collectionLocationId + year` an die Studio-Fassade.
4. Der Server lädt alle für den Abholort wirksamen Fraktionen, regulären Termine und fachlich wirksamen Ausweichtermine des Jahres.
5. Der produktive PDF-Baustein rendert daraus den Jahreskalender.
6. Das Ergebnis wird unter einem deterministischen Artefaktpfad gespeichert.
7. Existiert dort bereits ein PDF für dieselbe Kombination, wird es still ersetzt.
8. Die UI erhält den resultierenden Link und kann ihn sowohl im Ausgabe-Flow als auch in `Abholorte` anzeigen.

## Artefaktstrategie
Das Artefakt wird persistent gespeichert und über einen direkten Link zugänglich gemacht. Der Link geht im ersten Ausbau nicht über einen zusätzlichen Studio-Download-Endpoint.

Anforderungen an die Ablage:
- deterministischer Speicherort pro `collectionLocationId + year`
- stabiles Überschreiben bei erneuter Erzeugung
- Linkanzeige nur dann, wenn das Artefakt tatsächlich vorhanden ist
- keine Versionkette und keine Historie im ersten Ausbau

Ein plausibles Namensmuster ist ein pfadbasierter Schlüssel wie `collection-locations/<collectionLocationId>/<year>.pdf`. Das genaue technische Storage-Backend kann in der Implementierung konkretisiert werden, der Fachvertrag bleibt jedoch: genau ein aktuelles PDF pro Abholort und Jahr.

## UI-Design
Der neue Tab `Ausgabe` wird als eigenes Tabpanel im Waste-Management ergänzt. Das Panel ist als vertikale Folge von Cards angelegt, damit spätere Ausgabearten ergänzt werden können, ohne die erste Card umzubauen.

Die erste Card `PDF-Ausdruck` enthält:
- Auswahlfeld `Abholort`
- Auswahl- oder Eingabefeld `Jahr`
- Primäraktion `PDF erzeugen`

Nicht Bestandteil des Tabs:
- PDF-Vorschau
- Download-Historie
- Fraktionsauswahl
- Mehrfachselektion

Die Tabelle `Abholorte` wird um eine zusätzliche Sichtbarkeit für vorhandene PDFs ergänzt. Wenn ein Artefakt für den Datensatz existiert, erscheint dort ein direkter Link.

## Fehler- und Zustandsmodell
Der Ausgabe-Flow benötigt klare Leer-, Lade-, Fehler- und Erfolgszustände:

- Leerzustand:
  Wenn noch kein Abholort oder kein Jahr gewählt ist, bleibt die Aktion deaktiviert oder fachlich klar als noch nicht ausführbar markiert.
- Ladezustand:
  Während der Erzeugung ist die Aktion gegen Doppelstart geschützt und zeigt einen laufenden Zustand.
- Fehlerzustand:
  Fachliche oder technische Fehler bei Datenermittlung, Rendering oder Speicherung werden im Tab sichtbar rückgemeldet.
- Erfolgszustand:
  Nach erfolgreicher Erzeugung zeigt die UI den resultierenden Link direkt an und die Tabelle `Abholorte` kann denselben Link nach Reload oder erneuter Datenladung ebenfalls darstellen.

Bei erneuter Erzeugung derselben Kombination wird kein Bestätigungsdialog gezeigt. Das bestehende PDF wird still überschrieben.

## Sicherheits- und Betriebsgrenzen
- Die PDF-Erzeugung läuft serverseitig im aktiven Instanzkontext.
- Browser-Code erhält keinen direkten Zugriff auf Render-Interna, Storage-Secrets oder DB-Credentials.
- Die UI arbeitet ausschließlich über die bestehende Studio-Fassade.
- Direkte Artefaktlinks sind im ersten Ausbau bewusst akzeptiert; eine spätere Härtung über einen Download-Endpoint bleibt möglich, ist aber nicht Teil dieses Scopes.

## Teststrategie
Die Umsetzung soll mindestens in drei Schichten abgesichert werden:

1. Kernlogik
Tests für Dokumentmodell und Kalenderaufbereitung, insbesondere für Terminauflösung, Fraktionszuschnitt und Jahresbezug.

2. Serverpfad
Tests für den Erzeugungspfad mit erfolgreicher Generierung, Fehlerfällen und Überschreiben bestehender Artefakte.

3. Plugin-UI
Tests für den Tab `Ausgabe`, die Card `PDF-Ausdruck`, Zustandswechsel sowie die Linkanzeige in `Abholorte`.

## Betroffene Bereiche
- `packages/plugin-waste-management/*`
- `packages/auth-runtime/src/waste-management/*`
- `packages/data-repositories/src/waste-management/*`
- potenziell `packages/core/*` für produktive Dokument- und Kalenderlogik
- ergänzende Dokumentation in `openspec/changes/add-waste-output-pdf/*` und relevanten Architekturstellen

## Offene Abgrenzung für die Implementierung
Nicht mehr offen sind Scope und Benutzerverhalten. In der Implementierung ist nur noch technisch zu konkretisieren, in welchem Storage-Mechanismus das persistierte PDF abgelegt wird. Diese Konkretisierung darf den hier festgelegten Fachvertrag nicht aufweiten.
