## Context

`StudioDataTable` verwendet aktuell das clientseitige Sortiermodell von TanStack Table für jede sortierbare Spalte. Das ist nur korrekt, wenn `data` den vollständigen, bereits gefilterten Datenbestand enthält. Mehrere Aufrufer übergeben jedoch ausschließlich eine serverseitig oder fachlich zugeschnittene Seite. Die gemeinsame Komponente sortiert diese Seite anschließend lokal und vermittelt damit einen globalen Sortierzustand, den die Datenquelle nicht erfüllt.

Die Inhaltsliste besitzt bereits einen serverseitigen Sortiervertrag, deckt aber nicht alle aktuell als sortierbar markierten Spalten ab. `createdAt` und `publishedAt` werden deshalb still auf `updatedAt` zurückgeführt und danach nur innerhalb der geladenen Seite korrigiert; Typ und Status werden nach technischen Werten statt nach den sichtbaren Übersetzungen sortiert. Die Organisationsliste paginiert in SQL, ohne Sortierparameter anzunehmen, und ordnet standardmäßig nach Hierarchietiefe. Governance- und DSR-Read-Models filtern vollständige fachliche Mengen und schneiden danach Seiten zu, die UI verwirft jedoch Gesamtzahl und weitere Seiten. Waste-Fraktionen sortieren bereits vor ihrer lokalen Pagination, werden in der Tabelle aber redundant nochmals sortiert. Tenant- und Plattform-Benutzerlisten stammen im führenden Pfad aus paginierten Keycloak-Abfragen; Keycloak bietet für die dargestellten Spalten keinen passenden globalen Sortiervertrag.

Die abgeschlossene FAQ-Standardisierung verwendet für Filter bereits fachlich `Filterung → Sortierung → Pagination`. Dieser Change verallgemeinert den Vertrag für alle Studio-Datentabellen, ohne die dortige Pluginmigration zu duplizieren.

## Goals / Non-Goals

- Goals:
  - Sortierung paginierter Tabellen arbeitet immer auf dem durch Berechtigung und aktuelle Filter definierten Gesamtbestand.
  - Die gemeinsame Tabellenkomponente kann eine einzelne Seite niemals unbemerkt als Gesamtbestand sortieren.
  - Clientseitige Vollbestands-Sortierung und externe Sortierung sind typseitig und im Aufrufer erkennbar.
  - Externe Sortierung bleibt auf Desktop und Mobilgeräten mit demselben Zustand bedienbar.
  - Seitenwechsel bleiben durch deterministische Tie-Breaker stabil.
  - Fehlende Sortierwerte bleiben fehlend und werden weder angezeigt noch sortiert durch fachfremde Ersatzwerte verfälscht.
  - Bestehende korrekte Server- und Fachsortierungen werden wiederverwendet.
- Non-Goals:
  - keine Keycloak-Vollscans oder neue Benutzerprojektion
  - kein allgemeines Query-Builder-Framework
  - keine Mehrspaltensortierung, sofern die Fachliste sie nicht bereits unterstützt
  - keine Vereinheitlichung aller Pagination-Oberflächen außerhalb der bisher unvollständigen Governance- und DSR-Listen
  - keine sprachabhängige Sortierung übersetzter Typ- oder Statuswerte im Backend

## Decisions

### Sortierstrategie ist ein expliziter Tabellenvertrag

`StudioDataTable` erhält eine diskriminierte Sortierkonfiguration mit den Modi `disabled`, `client` und `external`.

- `disabled` erlaubt keine sortierbaren Spalten.
- `client` darf nur verwendet werden, wenn `data` die vollständige, durch die aktuellen Filter definierte Menge enthält. Die Tabelle darf dann ihr eigenes Sortiermodell anwenden.
- `external` verlangt genau einen kontrollierten Sortierzustand und einen Change-Handler. Die Tabelle rendert zugängliche Sortierköpfe, verwendet für die Zeilen aber ausschließlich das Core-Row-Model und verändert deren Reihenfolge nicht. Die aktive Spalte wechselt ausschließlich zwischen `asc` und `desc`; ein dritter, optisch unsortierter Zustand ist nicht zulässig.

Alle bestehenden Aufrufer deklarieren den Modus ausdrücklich. Dadurch bleibt die Entscheidung bei künftigen Tabellen im Code-Review sichtbar; ein stiller Default auf clientseitige Sortierung ist nicht zulässig. Die diskriminierte Prop-Union schließt State oder Handler im falschen Modus soweit möglich typseitig aus. Laufzeitinvarianten und Tests sichern Kombinationen mit widersprüchlich markierten Spalten zusätzlich ab.

### Mobile Sortierung verwendet denselben kontrollierten Zustand

In der kompakten Kartenansicht sind Tabellenköpfe nicht sichtbar. Sortierbare Tabellen erhalten deshalb oberhalb der Karten eine zugängliche Auswahl des Sortierfelds und eine separate Richtungsschaltfläche. Sortierbare Spalten deklarieren dafür ein Textlabel; beliebige React-Header werden nicht in Text umgedeutet. Externe Tabellen verwenden exakt denselben Zustand und Change-Handler wie die Desktop-Köpfe. Clientseitige Tabellen dürfen zusätzlich ihren bisherigen Zustand „keine Sortierung“ anbieten. Die vorhandenen A–Z-/Z–A-Symbole bleiben bestehen; `aria-sort` beziehungsweise die zugänglichen Feld- und Richtungslabels liefern die Semantik.

### Fachlicher Ablauf ist immer Filterung vor Sortierung vor Pagination

Der vollständige Ablauf lautet:

1. Tenant-, Berechtigungs- und Sichtbarkeitsumfang bestimmen.
2. Aktuelle Such- und Fachfilter anwenden.
3. Die verbleibende Gesamtmenge anhand eines erlaubten Sortierfelds sortieren.
4. Fehlende Werte unabhängig von der Richtung ans Ende stellen.
5. Bei gleichen Fachwerten immer die eindeutige Zeilen-ID aufsteigend als letzten Tie-Breaker anwenden.
6. Erst danach Offset beziehungsweise Seitenschnitt berechnen.

Die Sortierung darf in SQL, in einem serverseitigen Read-Model oder bei vollständig lokal vorliegenden Daten im Browser stattfinden. Entscheidend ist nicht der Ausführungsort, sondern dass dort die vollständige gefilterte Menge vorliegt.

### Serverseitige Sortierparameter bleiben fachlich allowlisted

Inhalts-, Organisations-, Governance- und DSR-Endpunkte erhalten ausschließlich typsichere beziehungsweise explizit validierte Sortierfelder und die Richtungen `asc` oder `desc`. SQL-Sortierung verwendet fest zugeordnete Fragmente statt ungeprüfter Parameterinterpolation. In-Memory-Read-Models verwenden feldspezifische Comparatoren. Direkte Requests mit unbekanntem Feld oder unbekannter Richtung werden mit `400 invalid_request` abgewiesen; es gibt keinen stillen Wechsel auf ein anderes Feld.

Die UI normalisiert ungültige URL-Sortierwerte vor dem Request auf den dokumentierten Default und zeigt diesen aktiv an. Jede Sortierung endet fest mit `ID asc`. Bei fachlich zusammengeführten Falllisten bildet die kanonische Zeilenidentität Typ und Quell-ID eindeutig ab. Dadurch verschieben gleichwertige Zeilen bei unverändertem Datenstand ihre Seite nicht zufällig.

### Fehlende Werte bleiben sichtbar und fachlich fehlend

Ein optionales Sortierfeld verwendet niemals ein anderes Fachfeld als Ersatz. Fehlende Werte stehen bei `asc` und `desc` immer am Ende. Eine sortierbare Zelle zeigt denselben Wert, nach dem sortiert wird, oder die lokalisierte Kennzeichnung „Nicht verfügbar“. Deshalb entfallen insbesondere `resolvedAt` als Anzeige- und Sortierersatz für Governance-`updatedAt` sowie `createdAt` als Anzeige- und Sortierersatz für DSR-`completedAt`.

### Textsortierung ist deployment-stabil statt sprachabhängig

Serverseitige Textsortierung verwendet normalisierte Vergleichswerte und die locale-neutrale PostgreSQL-Collation `C`; In-Memory-Pfade bilden dieselbe stabile Ordnung feldspezifisch nach. Dadurch hängt die Reihenfolge nicht von Betriebssystem-, Datenbank- oder Browser-Locale ab. Übersetzte Typ- oder Statuslabels werden nicht über ihre technischen Werte scheinbar alphabetisch sortiert. Wenn keine locale-neutrale fachliche Ordnung der sichtbaren Werte besteht, bietet die Tabelle für die Spalte keine Sortieraktion an.

### Sortierwechsel beginnt auf Seite eins

Ein Sortier-, Filter- oder Seitengrößenwechsel aktualisiert den kontrollierten Query-State und setzt `page` atomar auf `1`. URL-gesteuerte Listen behalten unbekannte Search-Params. Hook-gesteuerte IAM-Listen behalten ihre bestehende State-Ownership und führen durch diesen Change keinen neuen Routervertrag ein.

### Paginierte Benutzerlisten verlieren vorläufig irreführende Sortieraktionen

Tenant- und Plattform-Benutzerlisten setzen sich im führenden Pfad aus paginierten Keycloak-Listen, lokalen Mappings, Rolleninformationen und Credential-Diagnosen zusammen. Die angebotenen Spalten `displayName`, `email`, `role`, `status`, `keycloak` und `lastLoginAt` sind nicht vollständig durch eine globale Provider-Sortierung abgedeckt.

Ein vollständiger Keycloak-Scan samt Rollenprojektion bei jedem Sortierwechsel würde Laufzeit, Providerlast und Fehlerfläche erheblich erhöhen. Die vorhandene lokale Datenbank enthält zudem nicht zwingend alle noch nicht gemappten Keycloak-Benutzer. Deshalb werden die Sortieraktionen entfernt, bis eine vollständige, skalierbare Benutzerprojektion einen korrekten Vertrag ermöglicht. Die bestehende führende Reihenfolge der Benutzerquelle bleibt unverändert.

### Betroffene Listen verwenden den kleinstmöglichen korrekten Pfad

- Inhaltsliste: `title`, `createdAt`, `updatedAt` und `publishedAt` durch beide serverseitigen Listenpfade führen; Default `updatedAt desc`; Typ- und Statussortierung entfernen; Tabelle auf `external` umstellen.
- Organisationsliste: Default `displayName asc`; `displayName`, `parentDisplayName`, `childCount`, `membershipCount` und `isActive` mit validierten Parametern vor `LIMIT/OFFSET` sortieren; Typ-Sortierung und Hierarchieeinrückung entfernen.
- Governance- und DSR-Listen: vollständige gefilterte Read-Model-Menge vor `paginate*Items` sortieren; Default jeweils `createdAt desc`; Gesamtzahl und Seitenzustand in der UI auswerten; Seitengröße 25 als Default und 25, 50 sowie 100 zur Auswahl anbieten.
- Waste-Fraktionen: vorhandene Vollbestands-Sortierung vor `createPagedItems` behalten; Tabelle auf `external` umstellen und bei Sortierwechsel Seite eins setzen.
- Tenant- und Plattform-Benutzerliste: Sortiermodus `disabled`, bis eine spätere Projektion globale Sortierung unterstützt.

Unpaginierte Tabellen bleiben im Modus `client`, sofern sie Sortierung anbieten, und im Modus `disabled`, wenn keine Spalte sortierbar ist.

## Tests

- `studio-ui-react`: `external` verändert die Reihenfolge der empfangenen Seite nicht; Desktop- und Mobilsteuerung teilen Zustand und Callback; der externe Zweierzyklus sowie ungültige Modus-/Spaltenkombinationen sind abgesichert.
- Organisations-Read-Model: gefilterte, über mindestens zwei Seiten verteilte Datensätze werden pro erlaubtem Feld in beide Richtungen vor `LIMIT/OFFSET` sortiert; Nullwerte stehen zuletzt und Gleichstände enden mit `ID asc`.
- Governance und DSR: Tests mit absichtlich verschachtelten und fehlenden Zeitwerten beweisen, dass Seite eins und zwei aus einer einzigen global sortierten Menge entstehen; UI-Tests decken Gesamtzahl, Navigation und 25/50/100 ab.
- Inhaltsliste: Repository- und Projektionspfad decken `createdAt` und `publishedAt` ab; UI-Tests beweisen `updatedAt desc` als sichtbaren Default, fehlende Veröffentlichungsdaten zuletzt, entfernte Typ-/Statusaktionen und keine lokale Umsortierung.
- Waste-Fraktionen: Test beweist `Statusfilter → Sortierung → Pagination`, Nullwerte zuletzt, `ID asc` und den Seitenreset.
- Benutzerlisten: UI-Tests beweisen, dass paginierte Tenant- und Plattformergebnisse keine irreführenden Sortieraktionen anbieten.
- API und Handler: unbekannte Sortierfelder und Richtungen ergeben `400 invalid_request`; UI-Normalisierung verhindert solche Requests aus ungültigen URLs.

## Risks / Trade-offs

- Das explizite Modus-Property berührt alle `StudioDataTable`-Aufrufer. → Mechanische Migration je Aufrufer, gezielte Komponententests und Type-Gates verhindern stilles Fehlverhalten.
- Locale-neutrale Collation ist weniger wörterbuchartig als eine sprachabhängige Ordnung. → Die feste `C`-Collation priorisiert reproduzierbare Ergebnisse über Umgebungen hinweg; sprachabhängig angezeigte Typen und Statuswerte sind nicht sortierbar.
- Neue Sortierparameter können SQL-Injection-Risiken erzeugen. → ausschließlich feste Feldzuordnungen und validierte Richtungen, keine rohe Parameterinterpolation.
- Gleichzeitige Datenänderungen können auch bei stabiler Sortierung Offset-Seiten verschieben. → eindeutiger Tie-Breaker reduziert nichtdeterministische Verschiebungen; Cursor-Pagination bleibt außerhalb dieses Changes.
- Entfernte Typ-, Status- und Benutzersortierungen reduzieren vorläufig Funktionalität. → sichtbare Falschfunktion wird nicht konserviert; locale-aware Sortierung oder eine vollständige Benutzerprojektion bleiben eigene Architektur-Changes.
- Aktive Changes können dieselben Tabellenpfade berühren. → bestehende fachliche Verträge wiederverwenden und die Änderung blockweise mit explizitem Staging umsetzen.

## Migration Plan

1. `StudioDataTable`-Sortiervertrag ergänzen und alle Aufrufer explizit klassifizieren.
2. Inhaltsvertrag um `createdAt` und `publishedAt` ergänzen, ungeeignete Typ-/Statusaktionen entfernen und Inhalts- sowie Waste-Pfade auf `external` umstellen.
3. Organisationssortierung durch API, Handler und SQL-Read-Model führen.
4. Governance- und DSR-Sortierung sowie die fehlende Pagination implementieren.
5. Irreführende Sortierung aus beiden paginierten Benutzeransichten entfernen.
6. Fachliche und komponentennahe Regressionstests sowie arc42-Dokumentation aktualisieren.
7. Betroffene Nx-, Server-Runtime-, Type-, Lint- und PR-Gates ausführen.

Die Blöcke sind unabhängig reviewbar. Ein Rollback erfolgt pro Liste; Datenmigrationen sind nicht erforderlich.

## Open Questions

Keine. Das Design wurde fachlich freigegeben. Eine spätere global sortierbare Benutzerliste oder sprachabhängige Sortierung übersetzter Labels benötigt jeweils einen eigenen Vorschlag.
