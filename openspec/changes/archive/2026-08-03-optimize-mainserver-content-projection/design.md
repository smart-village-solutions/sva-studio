## Context

`GET /api/v1/iam/contents` liest Mainserver-Inhalte aus `iam.content_list_projection`. Der Hintergrund-Refresh lädt die Typen seitenweise und persistiert jede Seite sofort. Trotzdem gilt ein Typ ohne vorherigen erfolgreichen Vollsnapshot bis zur letzten Seite als nicht lesbar. Ein Fehler auf einer späteren Seite macht dadurch auch bereits erfolgreich materialisierte Zeilen für den Benutzer unzugänglich.

Die bestehenden Mainserver-List-Adapter verwenden dieselben umfangreichen GraphQL-Fragmente wie Fachlisten und Detailansichten. Besonders News laden verschachtelte Content-Blöcke, Medien, Adressen, Kategorien, DataProvider-Details, Settings, Ankündigungen und Like-Informationen, obwohl die kanonische Inhaltsliste nur ein kompaktes Projektionsmodell benötigt.

## Goals / Non-Goals

### Goals

- Die erste erfolgreich persistierte Seite eines Typs sofort lesbar machen.
- Teilständigkeit und laufende Vervollständigung ehrlich in API und UI darstellen.
- Bereits persistierte Seiten bei späteren Fehlern erhalten und weiter anzeigen.
- Inhalte aller unterstützten Mainserver-Typen auch ohne fachliches Veröffentlichungsdatum projizieren.
- Upstream-Payload und sequenzielle Request-Anzahl deutlich reduzieren.
- Interaktive Aktualisierung nach der neuesten Seite abschließen und historische Reconciliation entkoppeln.
- Vollständige Fachadapter für Editor-, Detail- und Plugin-Funktionen bewahren.

### Non-Goals

- Kein Wechsel der Mainserver-Quelle oder des GraphQL-Transports.
- Keine parallele Persistenz nach `iam.contents`.
- Keine Aufweichung von Autorisierung, Scope-Isolation oder Credential-Auflösung.
- Keine Erfindung fachlicher Veröffentlichungszeitpunkte.
- Keine vollständige Parallelisierung aller Seiten ohne nachgewiesene Mainserver-Kapazität.

## Decisions

### Decision: Partielle Snapshots sind ein expliziter lesbarer Zustand

Nach erfolgreicher Persistenz der ersten nichtleeren Seite gilt ein Typ als lesbar, auch wenn der Vollrefresh noch läuft. `iam.content_list_projection_sync_state` wird additiv um eine explizite Zustandsmaschine erweitert:

- `empty`,
- `partial_running`,
- `partial_failed`,
- `complete_fresh`,
- `complete_refreshing`,
- `complete_failed`.

Der persistierte Zustand enthält zusätzlich mindestens `refresh_run_id`, `refresh_phase` (`hot` oder `reconciliation`), `completed_page`, `available_count`, `is_total_final`, den letzten sicheren Page-Fehler sowie die Zeitpunkte des letzten vollständigen Snapshots. Die Migration ist Bestandteil dieses Changes; eine Ableitung allein aus `last_started_at` und `last_succeeded_at` ist nicht ausreichend.

Die Listenroute darf partielle Zeilen ausliefern. `pagination.total` bleibt aus Kompatibilitätsgründen die exakte Anzahl der aktuell autorisiert verfügbaren lokalen Treffer. Additive Metadaten liefern `availableCount`, `totalCount` nur bei vollständigem Snapshot, `isTotalFinal` und pro Mainserver-Typ den Snapshot-Zustand. Die UI verwendet bei `isTotalFinal = false` `pagination.total` ausschließlich zur Navigation zwischen bereits materialisierten lokalen Seiten. Sie weist keine endgültige Gesamtseitenzahl aus, bietet keine Navigation über den lokalen Umfang hinaus an und zeigt einen lokalisierten Hinweis auf den laufenden oder fehlgeschlagenen Aufbau.

Bei gemischten Inhaltstypen ist die Gesamtantwort partiell, sobald mindestens ein angefragter Mainserver-Typ partiell ist; die typbezogenen Zustände bleiben separat erhalten. Ein expliziter Typfilter bewertet nur den angefragten Typ. Während eines partiellen newest-first-Snapshots sind globale Sortierungen und Filter nur auf der lokal verfügbaren Menge garantiert und werden in den Metadaten als vorläufig gekennzeichnet.

Ein leerer erster Mainserver-Response darf erst dann als vollständiger leerer Snapshot gelten, wenn der Upstream belastbar `hasNextPage = false` meldet.

### Decision: Vollständigkeit wird erst beim Finalisieren zugesichert

Jede Seite wird weiterhin transaktional upserted. Der Löschabgleich für nicht mehr vorhandene Quellzeilen und die Markierung als vollständig erfolgen ausschließlich nach dem erfolgreichen letzten Page-Load. Bei einem späteren Fehler bleiben bereits persistierte Seiten erhalten; der vorherige Vollsnapshot wird nicht destruktiv bereinigt.

### Decision: Persistierte Refresh-Generationen verhindern veraltete Finalisierung

Jeder Hot-Refresh beziehungsweise jede Reconciliation erhält pro account- und credential-isoliertem Projektions-Scope eine persistierte `refresh_run_id`. Nur die im Sync-State aktuell führende Run-ID darf innerhalb derselben Transaktion Page-Zeilen upserten, Fortschritt schreiben, einen Snapshot finalisieren oder einen destruktiven Löschabgleich ausführen. Ein überholter Lauf beendet sich ohne weitere Daten-, Zustands- oder Löschwirkung.

Ein gezieltes Mutation-Upsert oder ein Identity-Delete invalidiert eine bereits laufende Reconciliation-Generation desselben Scopes vor der lokalen Änderung. Dadurch kann ein älterer, vor der Mutation gestarteter Vollscan die gezielte Änderung weder überschreiben noch beim Finalisieren löschen. Prozesslokale Promise-Deduplizierung bleibt eine Optimierung, ist aber keine Correctness-Grenze zwischen Replikaten.

### Decision: Veröffentlichungsdaten sind projektionsweit optional

`publicationDate`, `publishedAt` sowie in anderen Typen semantisch entsprechende Felder sind keine Voraussetzung für die Listenprojektion. Fehlen sie, persistiert der Host `published_at = NULL` und liefert `publishedAt` nicht aus. `createdAt` und `updatedAt` werden aus ihren jeweiligen Quellfeldern normalisiert; ein Veröffentlichungsdatum darf nicht als fachlich erfundener Ersatz erzeugt werden.

Fehlen auch technisch notwendige Zeitpunkte des gemeinsamen Modells, verwendet der jeweilige Adapter nur einen zentral dokumentierten technischen Fallback oder erweitert den Projektionsvertrag kontrolliert. Diese Entscheidung muss typübergreifend konsistent und durch Tests belegt sein.

### Decision: Eigene schlanke Projektionsadapter statt verkleinerter Fachadapter

Für News, Events, POIs, Generic Items einschließlich FAQs und Surveys werden typisierte Projection-List-Operationen eingeführt. Ihre GraphQL-Selections enthalten ausschließlich Felder, die für folgende Zwecke benötigt werden:

- stabile Quellidentität und Inhaltstyp,
- Titel beziehungsweise definierter Titel-Fallback,
- Erstellungs-, Änderungs- und optionale Veröffentlichungszeitpunkte,
- erforderlicher Status beziehungsweise Sichtbarkeit,
- Deduplizierung und Projektions-Scope,
- minimale DataProvider-/Credential-Metadaten,
- sichere Diagnose eines unbrauchbaren Datensatzes.

Fachliche Detail-Payload ist kein Bestandteil der Inhaltsübersicht und wird im Projection-List-Pfad nicht geladen. Solange `payload_json` im gemeinsamen Tabellenvertrag nicht nullable ist, persistiert der Mainserver-Projektionspfad dort ausschließlich ein kompatibles leeres Objekt. Die Inhaltsübersicht erhält daraus keine Payload-Spalte.

Die Selection-Allowlist ist verbindlich:

| Inhaltstyp | Erlaubte Mainserver-Felder |
| --- | --- |
| News | `id`, `title`, `author`, `createdAt`, `updatedAt`, `publicationDate`, `publishedAt`, `visible`, `dataProvider { id name }` |
| Events | `id`, `title`, `createdAt`, `updatedAt`, `visible`, `dataProvider { id name }` |
| POIs | `id`, `name`, `createdAt`, `updatedAt`, `active`, `visible`, `dataProvider { id name }` |
| Generic Items/FAQs | `id`, `title`, `genericType`, `author`, `createdAt`, `updatedAt`, `publicationDate`, `publishedAt`, `visible`, `dataProvider { id name }` |
| Surveys | `id`, `title`, `status`, `createdAt`, `updatedAt`, `publishedAt`, `archivedAt`, `visible`, `dataProvider { id name }` |

Inhaltstyp und Credential-/Projektions-Scope werden aus dem aufrufenden typisierten Adapter und dem bereits autorisierten Host-Kontext abgeleitet; dafür werden keine fachlichen Detailfelder geladen. Titel fallen bei leerem oder fehlendem Titelfeld deterministisch auf die stabile Quell-ID zurück.

Die bestehenden vollständigen List-/Detail-Dokumente bleiben für Fachlisten, Editoren und Mutationen erhalten. Tests prüfen die Projektions-Selection als Allowlist, damit neue Detailfelder nicht unbeabsichtigt in den Vollscan gelangen.

### Decision: Größere Seiten reduzieren Roundtrips

Der Projektionspfad verwendet nach erfolgreicher Vertragsprüfung `pageSize = 100`. Bei 582 News reduziert das die erwartete Zahl sequenzieller Page-Loads von 24 auf 6. Die Round-Robin-Fairness zwischen Inhaltstypen bleibt erhalten. Eine kleinere Größe bleibt als dokumentierter Fallback zulässig, wenn ein Mainserver die größere Seite nachweislich nicht unterstützt; die Entscheidung darf nicht still pro Request wechseln.

### Decision: Hot-Refresh und Reconciliation haben getrennte Abschlussbedingungen

Der interaktive Pfad lädt newest-first die erste Projektionsseite aller angefragten sichtbaren Typen, persistiert sie und liefert danach den Status `hot_refresh_completed` beziehungsweise einen typbezogenen Partialfehler zurück. Die UI liest unmittelbar erneut aus der lokalen Projektion. Weitere Seiten laufen mit niedrigerer Priorität als deduplizierte Reconciliation weiter.

Der Hot-Refresh darf einen bereits laufenden kompatiblen Refresh übernehmen. Er darf aber nicht mehrere Minuten auf historische Seiten warten. Der Reconciliation-Status bleibt über Metadaten beobachtbar.

### Decision: Stale-while-revalidate gilt auch im Browser

Die UI rendert vorhandene autorisierte Projektionszeilen sofort. Während `isSyncRunning`, `isPartial` oder `isStale` aktiv ist, lädt sie die lokale Listenquelle in einem begrenzten Intervall mit Backoff erneut oder reagiert auf ein hostseitiges Abschluss-/Fortschrittssignal. Zeilen werden anhand stabiler IDs aktualisiert, ohne Auswahl, Fokus oder Scrollposition unnötig zu verlieren.

Ein Refreshfehler ersetzt vorhandene Zeilen nicht durch einen Vollseitenfehler. Die UI zeigt Stand, Partialität und Fehler als lokalisierten Statushinweis.

### Decision: Warm-up bleibt an den vorhandenen autorisierten Laufzeitkontext gebunden

Der vorhandene Refresh nach Session-Aufbau und der In-Process-Scheduler für registrierte Scopes bleiben bestehen. Dieser Change persistiert keine Scope-Aktivität und führt keinen replikaübergreifenden Worker ein, weil kein belegter serverseitiger Delegationsvertrag zur späteren Wiederherstellung des account- und credential-isolierten Mainserver-Kontexts existiert.

### Decision: Gezielte Mutation-Updates bleiben der schnellste Schreibpfad

Der vorhandene Targeted-Refresh für News, Events, POIs, Generic Items und FAQs wird beibehalten. Surveys und spätere Typen erhalten denselben Detail-Upsert-/Identity-Delete-Vertrag, sofern ein typed Detailadapter existiert. Ein erfolgreicher Mainserver-Write darf nicht auf einen typweiten Vollrefresh warten; ein fehlgeschlagenes Follow-up bleibt nicht-destruktiv und wird durch Reconciliation geheilt.

### Decision: Surveys bleiben ein nicht paginierbarer Sonderfall

Der bestätigte Mainserver-Schema-Snapshot bietet für `surveys` Filter und Sortierung, aber weder `limit`/`skip` noch einen Cursor. Der schlanke Survey-Projection-Adapter reduziert daher die GraphQL-Selection, lädt upstream aber weiterhin den vollständigen Survey-Bestand in einem Request und paginiert nur lokal. Partielle Upstream-Seiten, Round-Robin-Fortschritt und die Request-Reduktion durch `pageSize = 100` gelten ausschließlich für News, Events, POIs und Generic Items einschließlich FAQs.

Der vorhandene typed Survey-Detailabruf über `surveys(ids: ...)` reicht für gezielte Upserts nach Studio-Mutationen aus und wird dafür wiederverwendet.

### Decision: Nicht belegte Mainserver-Verträge werden nicht implementiert

Der bestätigte Schema-Snapshot besitzt keinen Subscription-Type und die bestehende Integration keinen authentisierten Webhook- oder Message-Bus-Vertrag. Der Change führt deshalb keinen Ereignis-Port ein. Ebenso wird kein Delta-Wasserstand implementiert, weil keine relevante Liste einen stabilen Filter oder Cursor nach `(updatedAt, id)` anbietet. Externe Änderungen und Löschungen werden weiterhin durch vollständige Reconciliation erkannt; Offset-Pagination wird nicht als verlustfreier Delta-Sync behandelt.

### Decision: Einzelne unbrauchbare Datensätze blockieren keine valide Seite

Ein Datensatz ohne stabile Quell-ID wird nicht materialisiert, als `skippedInvalidCount` im Lauf gezählt und mit Inhaltstyp, Seite und sicherer Fehlerklasse diagnostiziert; Payload, Secrets und PII werden nicht geloggt. Weitere Datensätze derselben Seite und folgende Seiten werden verarbeitet. Fehlen alle IDs einer ansonsten strukturell validen Seite, bleibt die Seite verarbeitet und der Snapshot kann mit entsprechendem Diagnosezähler vollständig werden.

Nur Transportfehler, eine nicht validierbare Page-Struktur oder fehlende Pagination-Kontrollinformationen machen die gesamte Seite fehlerhaft. Ein fehlendes optionales Veröffentlichungsdatum ist ausdrücklich kein ungültiger Datensatz.

## Alternatives considered

- Bestehende Fachlistenqueries verkleinern: verworfen, weil Plugins und Detailansichten die vollständigen Felder benötigen und dadurch funktionale Regressionen drohen.
- Nur die Seitengröße erhöhen: unzureichend, weil große verschachtelte Payloads und teure Resolver bestehen bleiben.
- Erst nach vollständigem Sync anzeigen: verworfen, weil es dem Zweck der lokalen progressiven Projektion widerspricht.
- Einen einzelnen Datensatzfehler als Page-Fehler behandeln: verworfen, weil eine fehlende Quell-ID sonst alle validen Datensätze derselben und folgender Seiten blockiert.

## Risks / Trade-offs

- Partielle Pagination kann sich während des Syncs verändern. → API kennzeichnet vorläufige Summen; die UI behauptet keine endgültige Ergebnismenge.
- Ein partieller Snapshot kann kurzzeitig nur die neuesten Inhalte enthalten. → Sortierung bleibt newest-first und die UI zeigt den Aufbauzustand sichtbar an.
- Größere Seiten können einzelne Mainserver stärker belasten. → Schema-/Integrationstest, Observability und dokumentierter Fallback.
- Browser-Polling kann zusätzliche Last erzeugen. → Nur bei aktivem Sync, Backoff, Sichtbarkeitsprüfung und sofortiges Ende nach Abschluss.
- Surveys liefern ohne serverseitige Pagination auch mit schlanker Selection den gesamten Bestand. → Kein falsches Partial-/Request-Versprechen; gezielte Mutation-Upserts und periodische Reconciliation begrenzen die interaktive Belastung.
- Unterschiedliche Minimalfelder je Typ können driften. → zentrale Projektions-DTOs, Allowlist-Tests und snapshot-basierte GraphQL-Validierung.
- Gleichzeitige Läufe können Fortschritt oder Löschabgleich veralten lassen. → Persistierte Run-ID, atomare Führungsprüfung und Invalidierung durch gezielte Mutationsupdates.

## Migration Plan

1. Projektions-DTO und typübergreifende Nullable-Zeitsemantik definieren.
2. Schlanke Projection-List-Dokumente und Adapter je Inhaltstyp ergänzen.
3. Sync-State per additiver Migration um Zustandsmaschine, Run-ID, Phase, Fortschritt, Zähler und Finalitätskennzeichen erweitern.
4. Listen-API und UI-Metadaten additiv erweitern und Browser-Revalidation aktivieren.
5. Seitengröße nach Integrationstest auf 100 anheben.
6. Vorhandene gezielte Mutationsupdates für Surveys vervollständigen und vom Vollrefresh entkoppeln.
7. Bestehende Snapshots kompatibel weiterverwenden; neue partielle Zustände entstehen erst bei folgenden Refreshs.
8. Up-/Down-Migration, `studio-db-schema-final.sql` und `studio-db-schema.md` gemeinsam aktualisieren.

Vor Implementierungsbeginn werden die überlappenden Refresh-Szenarien aus `refactor-mainserver-projection-mutation-refresh` abgeglichen. Dessen account-isolierte Scope- und gezielte Mutation-Follow-up-Verträge bleiben maßgeblich; dessen feste Seitengröße 25 und ältere Page-Fehler-Semantik werden durch diesen Change ersetzt.

Rollback: Adapterwahl, partielle Lesbarkeit und Hot-Completion erhalten getrennte serverseitige Schalter. Vor dem Abschalten werden neue Läufe gestoppt und pro betroffenem Scope genau eine vollständige Reconciliation mit dem bisherigen Adapter abgeschlossen. Erst danach wird die partielle Lesbarkeit deaktiviert, damit kein gemischter Teilsnapshot als alter Vollsnapshot erscheint. Die additiven Sync-State-Spalten bleiben während des Runtime-Rollbacks erhalten und werden erst in einer separaten, nachgelagerten Schemaänderung entfernt.

## Open Questions

- Unterstützen alle produktiven Mainserver-Varianten `pageSize = 100` mit stabiler Antwortzeit und korrektem `hasNextPage`?
