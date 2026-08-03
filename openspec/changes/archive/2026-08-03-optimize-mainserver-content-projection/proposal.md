# Change: Mainserver-Inhaltsprojektion beschleunigen und partiell nutzbar machen

## Why

Der erstmalige Aufbau der lokalen Inhaltsprojektion blockiert die Anzeige eines Inhaltstyps bis zum vollständigen Abruf aller Mainserver-Seiten. Bei großen Beständen entstehen dadurch minutenlange Wartezeiten. Zusätzlich bricht derzeit bereits ein einzelner Inhalt ohne `publicationDate` und `publishedAt` den gesamten Typ-Snapshot ab, obwohl die lokale Projektion ein optionales Veröffentlichungsdatum unterstützt.

Die Projektionsabfragen laden außerdem weit mehr verschachtelte Fachfelder als die Inhaltsübersicht benötigt. Bei 582 News entstehen so 24 sequenzielle GraphQL-Aufrufe mit großen Payloads, obwohl die lokale Tabelle nur ein kompaktes Listenmodell materialisiert.

## What Changes

- Bereits vollständig persistierte Seiten eines laufenden Mainserver-Refreshs werden als partieller Snapshot lesbar und in `/admin/content` angezeigt.
- API und UI kennzeichnen partielle Snapshots sowie laufende oder fehlgeschlagene Vervollständigung, ohne eine endgültige Trefferzahl oder Vollständigkeit vorzutäuschen.
- Ein Fehler auf einer späteren Seite verwirft weder bereits persistierte Zeilen noch deren Lesbarkeit.
- Fehlende fachliche Veröffentlichungszeitpunkte werden für alle projizierten Mainserver-Inhaltstypen als `NULL` beziehungsweise `undefined` normalisiert und blockieren keinen Datensatz und keinen Typ-Snapshot.
- Dedizierte, typisierte Projection-List-Adapter laden pro Inhaltstyp nur Identität, Tabellendarstellung, Zeit-/Statusfelder und minimale Quellmetadaten. Fachliche Detail-Payload wird nicht geladen; `payload_json` erhält nur ein kompatibles leeres Objekt. Bestehende vollständige Fachlisten- und Detailadapter bleiben unverändert verfügbar.
- Die Projektions-Seitengröße wird auf 100 erhöht, sofern der Mainserver-Schema- und Integrationstest diese Größe bestätigt; damit sinkt die Zahl sequenzieller Requests für 582 News von 24 auf 6.
- Ein zweistufiger Refresh trennt einen interaktiven Hot-Refresh der neuesten Seite vom nachgelagerten vollständigen Reconciliation-Lauf. Der manuelle Aktualisieren-Pfad wartet nur auf den Hot-Refresh, bevor die Liste neu gelesen wird.
- Eine persistierte, scope-isolierte Refresh-Run-ID stellt sicher, dass nur der führende Lauf Fortschritt, Vollständigkeit und destruktiven Löschabgleich schreiben darf; gezielte Mutation-Updates invalidieren ältere Reconciliation-Läufe.
- Die Inhaltsübersicht verwendet stale-while-revalidate: vorhandene vollständige oder partielle Snapshots erscheinen sofort und werden während eines laufenden Refreshs kontrolliert nachgeladen.
- Der vorhandene Session-Warm-up und In-Process-Scheduler bleiben unverändert der Hintergrundpfad für autorisierte, im laufenden Prozess registrierte Scopes.
- Vorhandene gezielte Projektionsupdates nach Studio-Mutationen werden wiederverwendet und auf noch nicht gezielt unterstützte Typen erweitert, statt einen typweiten Vollrefresh auszulösen.
- Surveys erhalten schlanke Projection-Selections und gezielte Mutation-Updates. Da der bestätigte Mainserver-Vertrag für `surveys` keine serverseitige Pagination anbietet, verspricht dieser Change für Surveys weder partielle Upstream-Seiten noch eine Request-Reduktion durch `pageSize = 100`.
- Einzelne Datensätze ohne unverzichtbare Quell-ID werden deterministisch ausgeschlossen und gezählt, ohne valide Datensätze derselben Seite oder den gesamten Typ-Snapshot zu blockieren. Diagnosen nennen Inhaltstyp, Seite und sichere Fehlerklasse ohne Payload oder PII.
- Performance- und Regressionstests sichern Feld-Allowlist, Request-Anzahl, partielle Lesbarkeit und vollständige Finalisierung ab.

## Impact

- Affected specs: `content-management`, `sva-mainserver-integration`
- Affected code:
  - `packages/sva-mainserver/src/generated/*`
  - `packages/sva-mainserver/src/server/service-internals/*`
  - `packages/sva-mainserver/src/server/service.ts`
  - `apps/sva-studio-react/src/lib/iam-content-list-mainserver.ts`
  - `apps/sva-studio-react/src/lib/iam-content-list-projection.server.ts`
  - `apps/sva-studio-react/src/lib/mainserver-projection-refresh-coordinator.server.ts`
  - `apps/sva-studio-react/src/hooks/use-contents.ts`
  - `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
  - `packages/data/migrations/*`
  - `docs/development/studio-db-schema-final.sql`
  - `docs/development/studio-db-schema.md`
- Affected database contracts: bestehende Tabellen `iam.content_list_projection` und `iam.content_list_projection_sync_state`; eine additive Migration erweitert den Sync-State um expliziten Snapshot-Zustand, Refresh-Run-ID, Phase, Fortschritt, Zähler und Finalitätskennzeichen
- Affected arc42 sections: `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`
- Breaking changes: keine für Fachlisten-, Detail- oder Mutationsadapter; die Inhaltslisten-Metadaten werden additiv um partielle Sync-Informationen erweitert
- Related active change: Der noch aktive Change `refactor-mainserver-projection-mutation-refresh` spezifiziert für den progressiven Vollrefresh weiterhin `pageSize = 25` und eine ältere Page-Fehler-Semantik. Dieser Change ersetzt diese beiden Punkte nach seiner Freigabe; die übrigen Scope- und Mutation-Follow-up-Verträge bleiben bestehen.

## Existing Implementation Assessment

| Strategie | Stand im Code | Konsequenz für diesen Change |
| --- | --- | --- |
| Wasserstand/Delta-Sync | Nicht umsetzbar: der bestätigte Schema-Snapshot bietet für die relevanten Listen keinen stabilen Filter oder Cursor nach `(updatedAt, id)` | Nicht Bestandteil dieses Changes; Offset-Pagination wird nicht als verlustfreier Delta-Sync behandelt |
| Zweistufiger Hot-Refresh | Teilweise vorhanden: newest-first, seitenweise Persistenz und Round-Robin; manueller Refresh wartet aber auf den Vollscan | Interaktiven Abschluss nach Hot-Phase einführen und Reconciliation entkoppelt fortsetzen |
| Schlanker Projektionsindex | Nicht vorhanden | Dedizierte minimale Projection-List-Adapter einführen |
| Stale-while-revalidate | Serverseitig für vorhandene Vollsnapshots teilweise vorhanden; keine laufende UI-Nachführung | Vorhandenen Snapshot sofort rendern und kontrolliert pollen beziehungsweise per Signal nachladen |
| Hintergrund-Warm-up | Session-Warm-up und In-Process-Scheduler für registrierte Scopes vorhanden; kein belegter serverseitiger Delegationsvertrag für spätere credential-isolierte Worker-Läufe | Bestehenden Pfad unverändert wiederverwenden; kein persistierter Registry-/Lease-Worker in diesem Change |
| Gezielte Mutation-Upserts | Für News, Events, POIs, Generic Items und FAQs vorhanden; Surveys nutzen noch Vollrefresh | Bestehenden Pfad absichern, Survey-Support ergänzen und interaktive Mutation nicht durch Vollscan blockieren |
| Mainserver-Änderungsereignisse | Nicht umsetzbar: der Schema-Snapshot hat keinen Subscription-Type und es existiert kein authentisierter Webhook- oder Message-Bus-Vertrag | Nicht Bestandteil dieses Changes; periodische Reconciliation bleibt das Sicherheitsnetz für externe Änderungen |
| Survey-Pagination | Der bestätigte `surveys`-Vertrag bietet `ids`, Statusfilter und Sortierung, aber weder `limit`/`skip` noch Cursor-Pagination | Schlanke Selection und gezielte Updates umsetzen; der Upstream-Listenabruf bleibt ein einzelner Vollabruf ohne partielle Upstream-Seiten |
