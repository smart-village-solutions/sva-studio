# Readiness des Waste-Cutovers für `bb-prignitz` vom 9. August 2026

## Ergebnis

Der produktive Offline-Cutover ist derzeit **No-Go**. Produktion läuft unverändert; Studio-App, Public-Waste-App, Worker und Datenbanken wurden durch diesen Audit nicht gestoppt oder mutiert.

Die Datenmigration selbst ist klein und technisch erprobt. Blockierend sind der fehlende vollständig getestete Wartungs- und Transferpfad sowie ein Fehler in der Quellbindung der Backup-Workflows.

## Bestätigter Zustand

| Bereich | Nachweis | Bewertung |
| --- | --- | --- |
| Supabase-Quelle | PostgreSQL 17.6, 13 `waste_*`-Tabellen, 7.494 Zeilen | bereit |
| Quellclient | `pg_dump` und `pg_restore` 17.10 | bereit |
| Quellsitzungen | keine aktive Fremdsitzung bei der Read-only-Prüfung | bereit, vor finalem Dump erneut prüfen |
| Quellarchiv | frisches Custom-Archiv mit 414.502 Byte; `pg_restore --list` erfolgreich | bereit |
| Zielregistrierung | `bb-prignitz`, Status `ready`, Generation 2, Datenbank `sva_w_bb_prignitz_4fc528d5be47_db` | bereit |
| Zielschema | 19 Waste-Tabellen, 0 Zeilen | bereit, vor Import erneut prüfen |
| Zielspeicher | rund 326 GB frei | bereit |
| Staging-Backup | Studio- und Waste-Backup einschließlich Objektprüfung erfolgreich, Run `31307071023` | bereit |
| Production-Backup | noch kein erfolgreicher vollständiger Run | blockiert |
| Studio-Runtime | App, Provisionierer, PostgreSQL und Redis laufen | unverändert |
| Public-Waste-Runtime | `web-waste-calendar` läuft mit einer Replik | unverändert |

## Ursachen der fehlgeschlagenen Production-Backup-Drills

1. Backup-Auftraggeber und Agent verwendeten zunächst unterschiedliche HMAC-Kanonisierung.
2. Der Production-Workflow übergab dem Paritätsprüfer keine vollständige Image-Referenz.
3. Der Paritätsprüfer akzeptierte nur eine Agent-Evidenzdatei, obwohl ein vollständiger Lauf getrennte Studio- und Waste-Evidenz erzeugt.
4. Staging- und Production-Backup-Workflow wechselten den gesamten Arbeitsbaum auf den historischen Commit des unveränderlichen Anwendungsimages. Dadurch wurden später gemergte Operator-Fixes nicht ausgeführt.

Die Punkte 1 bis 3 sind auf `main` korrigiert. Punkt 4 wird als gemeinsamer Workflow-Fix vorbereitet: Operator-Logik stammt aus dem aktuellen geprüften Workflow-Commit; die unveränderliche Image-Revision wird weiterhin über Image-Contract, Commit-Existenz und Main-Ancestry validiert.

## Blockierende Lücken des eigentlichen Cutovers

### Public-Waste-Stopp und -Restart

Für den Studio-Stack existiert im kontrollierten Restore-Workflow ein getestetes Muster, das App und Provisionierer auf null Replikate setzt und PostgreSQL weiterlaufen lässt. Für `web-waste-calendar` existiert nur der Release-/Rollback-Pfad über ein Image-Tag. Ein geschützter, reversibler Stop-/Restart-Vertrag mit Zustandsprüfung ist nicht implementiert.

Damit ist OpenSpec-Aufgabe 3.3 noch nicht erfüllt und wurde wieder geöffnet.

### Ausführbarer Zielzugang

Das Einmalskript verlangt einen libpq-Service mit der tenantgebundenen Migrationsrolle. Deren Passwort wird bei der Provisionierung zufällig erzeugt, für Schemaaufbau verwendet und anschließend nicht gespeichert. In der verschlüsselten Interface-Konfiguration werden nur Studio- und Public-Runtime-Verbindungen persistiert.

Der zentrale Backup-Agent besitzt zwar PostgreSQL-18-Tools, Netzwerkzugriff und die eingeschränkte Waste-Provisioniererrolle, bietet aber keinen signierten Einmalimport. Lokal ist nur der Supabase-Quellzugang vorhanden; die Ziel-Datenbank ist nicht direkt exponiert. Der dokumentierte `TARGET_PGSERVICE` kann daher derzeit nicht regelkonform hergestellt werden.

### Atomare Orchestrierung und Rückfall

Es gibt keinen ausführbaren Ablauf, der gemeinsam und fail-closed:

1. Studio- und Public-Waste-Schreiber stoppt,
2. Job- und Session-Drain bestätigt,
3. den finalen Dump unverändert sichert,
4. den Data-only-Import mit einer geschützten Zielrolle ausführt,
5. Tabellen-, Rechte- und Fach-Smokes prüft,
6. beide Runtimes nur bei Erfolg wieder startet und
7. bei Fehlern die Runtimes gestoppt hält beziehungsweise kontrolliert auf die unveränderte Quelle zurückführt.

## Go-Gates vor dem nächsten Cutover-Versuch

- [ ] Backup-Workflows verwenden aktuelle Operator-Logik bei weiterhin exakter Image-Bindung.
- [ ] Ein vollständiger Production-Backup-Drill bestätigt Studio- und Waste-Objekte.
- [ ] Geschützter Public-Waste-Stop und -Restart sind implementiert und in einer nichtproduktiven Probe verifiziert.
- [ ] Der Import läuft über einen geschützten, nicht offengelegten Zielzugang; kein Passwort erscheint in Argumenten, Logs oder Evidenz.
- [ ] Der Importpfad wurde mit einem realistischen Quellartefakt gegen eine isolierte Ziel-Datenbank ausgeführt.
- [ ] Job- und Session-Drain für Studio, Quelle und Ziel sind Teil desselben fail-closed Ablaufs.
- [ ] Studio-Read/Write-, Public-Read/Reminder- und Backup-/Restore-Smokes sind ausführbar festgelegt.
- [ ] Der Rückfall vor der ersten freigegebenen Zielschreiboperation ist praktisch ausführbar.

## Nächste technische Entscheidung

Empfohlen wird ein einmaliger, signierter Import über den vorhandenen zentralen Backup-Agenten. Der Agent besitzt bereits die richtigen PostgreSQL-Tools, internen Netzwerkzugriff, S3-Anbindung, OIDC-Workflowbindung und die geschützte Waste-Provisioniererrolle. Der Import soll ein vorab hochgeladenes, prüfsummengebundenes Data-only-Artefakt verwenden und im Ziel auf die tenantbezogene Owner-Rolle wechseln. Eine neue dauerhafte Runtime oder das Offenlegen eines Migrator-Passworts ist dafür nicht erforderlich.

Vor dieser Erweiterung muss geklärt und getestet werden, wie das lokal erzeugte Quellartefakt ohne neue langlebige Credentials in den geschützten S3-Pfad gelangt. Bis dahin bleibt der Cutover No-Go.
