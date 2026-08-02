## 1. Verträge und Tests vorbereiten

- [x] 1.1 Reproduktionstests ergänzen, die News sowie jeden weiteren Mainserver-Inhaltstyp ohne Veröffentlichungsdatum erfolgreich mappen und projizieren.
- [x] 1.2 Tests für einen erstmaligen Refresh ergänzen, der Seite 1 persistiert und bereits vor Abschluss weiterer Seiten einen lesbaren partiellen Snapshot liefert.
- [x] 1.3 Tests ergänzen, die nach einem Fehler auf einer späteren Seite bereits persistierte Zeilen lesbar erhalten und den Snapshot als partiell fehlgeschlagen kennzeichnen.
- [x] 1.4 Selection-Allowlist- und Request-Anzahl-Tests für alle Projection-List-Operationen definieren.
- [x] 1.5 Vertragstests für Hot-Refresh, Browser-Revalidierung und den nicht paginierbaren Survey-Sonderfall ergänzen.
- [x] 1.6 Konkurrenztests ergänzen, in denen ein überholter Lauf weder finalisiert noch löscht und ein gezieltes Mutation-Update eine ältere Reconciliation-Generation invalidiert.
- [x] 1.7 Tests ergänzen, die einzelne Datensätze ohne Quell-ID ausschließen und zählen, während valide Datensätze derselben und folgender Seiten verarbeitet werden.

## 2. Schlanke Mainserver-Projektionsadapter

- [x] 2.1 Einen gemeinsamen typisierten Projection-List-Vertrag in `@sva/sva-mainserver` definieren, ohne vollständige Fachadapter zu ersetzen.
- [x] 2.2 Schlanke Projection-List-GraphQL-Dokumente und Mapper für News, Events, POIs, Generic Items/FAQs und Surveys implementieren.
- [x] 2.3 Die im Design festgelegte Feld-Allowlist exakt umsetzen, keine fachliche Detail-Payload selektieren und für den nicht-nullbaren `payload_json`-Vertrag ausschließlich ein leeres Objekt persistieren.
- [x] 2.4 Fachliche Veröffentlichungsdaten in allen Projektionsmappern optional behandeln und fehlende Werte als `undefined` beziehungsweise `NULL` normalisieren.
- [x] 2.5 Notwendige technische Fallbacks für fehlende Erstellungs-/Änderungszeitpunkte zentral und typübergreifend dokumentieren und testen.
- [x] 2.6 GraphQL-Dokumente gegen `packages/sva-mainserver/src/generated/schema.snapshot.json` validieren und vollständige Fachlisten-/Detailadapter unverändert absichern.

## 3. Progressive Persistenz und partielle Lesbarkeit

- [x] 3.1 Sync-State-Modell additiv um `empty`, `partial_running`, `partial_failed`, `complete_fresh`, `complete_refreshing` und `complete_failed` sowie Run-ID, Phase, Fortschritt, Zähler und Finalitätskennzeichen erweitern.
- [x] 3.2 Die erste erfolgreich persistierte Seite unmittelbar für `GET /api/v1/iam/contents` lesbar machen.
- [x] 3.3 Sicherstellen, dass spätere Page-Fehler weder bereits persistierte Seiten noch einen vorhandenen vollständigen Snapshot löschen.
- [x] 3.4 Löschabgleich und endgültige Gesamtzahl ausschließlich nach erfolgreicher letzter Seite und atomarer Bestätigung der weiterhin führenden `refresh_run_id` ausführen.
- [x] 3.5 Leere erste Seiten nur bei bestätigtem `hasNextPage = false` als vollständigen leeren Snapshot markieren.
- [x] 3.6 Gezielte Mutation-Upserts und Identity-Deletes so ausführen, dass sie eine ältere Reconciliation-Generation desselben Scopes vor der lokalen Änderung invalidieren.
- [x] 3.7 Up-/Down-Migration sowie `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` aktualisieren.

## 4. API, UI und Performance

- [x] 4.1 Listen- und Refresh-Metadaten additiv um `availableCount`, nur bei Vollständigkeit gesetztes `totalCount`, `isTotalFinal`, typbezogene Snapshot-Zustände, laufende Vervollständigung, Invalid-Zähler und letzten Page-Fehler erweitern.
- [x] 4.2 `/admin/content` so anpassen, dass partielle Zeilen sofort erscheinen und ein lokalisierter, barrierefrei wahrnehmbarer Aufbau- oder Fehlerhinweis angezeigt wird.
- [x] 4.3 Bei partiellen Snapshots keine endgültige Seitenzahl und keine Navigation auf noch nicht materialisierte Seiten anbieten; globale Sortierung und Filterung als auf die verfügbare lokale Menge begrenzt kennzeichnen.
- [x] 4.4 Die Projektions-Seitengröße nach erfolgreichem Vertragsnachweis auf 100 erhöhen und die erwartete Request-Anzahl testen.
- [x] 4.5 Surveys ausdrücklich vom `pageSize = 100`-/Partial-Page-Vertrag ausnehmen und ihren einzelnen vollständigen Upstream-Abruf testen.
- [x] 4.6 Strukturierte Logs und Metriken um Typ, Seite, Seitengröße, partielle Zeilenanzahl, übersprungene ungültige Datensätze, Dauer und sichere Fehlerklasse ergänzen.
- [x] 4.7 Den manuellen Refresh in eine priorisierte Hot-Phase und eine entkoppelte vollständige Reconciliation teilen; die API-Antwort darf nur auf die Hot-Phase warten.
- [x] 4.8 Die Inhaltsübersicht nach dem Anzeigen vorhandener oder partieller Daten begrenzt und mit Backoff revalidieren, ohne Auswahl, Fokus oder Tabellenzustand zurückzusetzen.

## 5. Gezielte Aktualitätspfade

- [x] 5.1 Die vorhandenen gezielten Mutation-Projection-Loader wiederverwenden, für Surveys vervollständigen und sicherstellen, dass eine erfolgreiche Schreibantwort nicht auf einen anschließenden Vollrefresh warten muss.
- [x] 5.2 Den bestehenden Session-Warm-up und In-Process-Scheduler unverändert weiterverwenden; keine persistierte Scope-Registry ohne belegten serverseitigen Delegationsvertrag einführen.
- [x] 5.3 Durch Regressionstests absichern, dass Offset-Pagination nicht als Delta-Sync verwendet und ohne authentisierten Mainserver-Ereignisvertrag kein Event-Ingress exponiert wird.

## 6. Verifikation und Dokumentation

- [x] 6.1 Betroffene Unit- und Type-Tests nach jedem Änderungsblock über die passenden Nx-Targets ausführen.
- [x] 6.2 Für `packages/sva-mainserver` früh `pnpm check:server-runtime` ausführen.
- [x] 6.3 Integrations- und Regressionstests für vollständige und partielle Refreshs, den Survey-Sonderfall und große Bestände ausführen.
- [x] 6.4 Einen messbaren Vorher-/Nachher-Nachweis für Zeit bis zur ersten sichtbaren aktuellen Zeile, Payload-Größe, Page-Requests und Gesamtdauer dokumentieren.
- [x] 6.5 Arc42-Abschnitte `05-building-block-view.md`, `06-runtime-view.md` und `08-cross-cutting-concepts.md` aktualisieren.
- [x] 6.6 Relevante Betriebs- und Entwicklungsdokumentation auf Deutsch aktualisieren.
- [x] 6.7 Kleinsten relevanten finalen Gate-Pfad ausführen; vor PR nach Möglichkeit `pnpm test:pr` verwenden.
- [x] 6.8 Den Runtime-Rollback testen: neue Läufe stoppen, vollständige Reconciliation mit bisherigem Adapter abschließen, partielle Lesbarkeit deaktivieren und additive Sync-State-Spalten beibehalten.
