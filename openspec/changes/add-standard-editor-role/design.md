## Bestehende Lösung und Abgrenzung

Die neue Fähigkeit fehlt im automatischen Mandantenlebenszyklus; unmittelbare Verbraucher sind neue und bestehende Mandanten sowie deren Modulabgleich. Der begrenzte MCP-Change `add-editor-role-baseline` ist bereits umgesetzt und hat einen anderen Auslöser sowie ein engeres Rechteprofil; er wird nicht nachträglich erweitert oder als zweiter automatischer Anlagepfad verwendet.

Kanonische Permission-Kataloge und bestehende Scope-Auswertung erweitern, keine parallele Profilverwaltung oder pauschale Freigabe aller Modul-Actions einführen. `standard_editor` ist eine tenantlokale Studio-Rolle mit stabilem technischem Schlüssel und übersetzbarer Anzeige, keine geschützte technische Keycloak-Rolle. `system_admin`, `editor`, individuelle Rollen und deren Mitgliedschaften bleiben erhalten.

## Rechte und Ressourcen

| Bereich | Gewährte Fähigkeit | Grenze |
| --- | --- | --- |
| Inhalte | Lesen, Suchen, Vorschau, Erstellen | Verfügbares Inhaltsmodul; Erstellen nur für eigenen persönlichen oder berechtigten Organisationsprincipal |
| Inhalt bearbeiten | Metadaten, Payload, Löschen | Organisationsinhaber entspricht aktiver eigener Organisation ODER persönlicher Inhaber entspricht aktuellem Account |
| Veröffentlichung | Veröffentlichen, Zurückziehen, zeitliche Planung, Archivieren, Wiederherstellen | Dieselbe Ownership-Grenze |
| Nachvollziehbarkeit | Historie lesen | Dieselbe Ownership-Grenze; keine Revisionsverwaltung |
| Push | Fachlich unterstützte Push-Nachrichten versenden | Dasselbe Inhaltsobjekt und dieselbe Ownership-Grenze; kein freier administrativer Broadcast |
| Medien | Lesen, Erstellen/Upload, Bearbeiten, Referenzen verwalten, Löschen | Mandantenweit |
| Kategorien | Lesen, Erstellen, Bearbeiten, Zuordnen, Löschen | Mandantenweit |
| Navigation | Benötigte Modulübersichten und Redaktionszugänge | Keine zusätzlichen Verwaltungsbefugnisse |

Core-Actions wie `content.read`, `content.create`, `content.updateMetadata`, `content.updatePayload`, `content.changeStatus`, `content.publish`, `content.archive`, `content.restore`, `content.readHistory` und `content.delete` mit den konkreten Actions aller verfügbaren Inhaltsmodule zusammenführen. Beispielsweise gehört `news.pushNotification` dazu. Vor Implementierung die tatsächlichen Modulverträge vollständig inventarisieren; Modulnamen rechtfertigen keine Freigabe von Konfigurations-/Admin-Actions.

Für Datensätze bildet der bestehende Scope `organization` bereits die Vereinigungsmenge aus Organisations- und persönlichem Eigentum ab. Rollenbesitz ersetzt keine Organisationsmitgliedschaft. Persönliche Inhalte bleiben beim Organisationswechsel erreichbar; ohne aktive Organisation gilt `own`. Fremde Mandanten und ownerlose oder nicht eindeutig auflösbare Inhalte erhalten daraus keine Schreibbefugnis. Listen, Detailansichten, direkte APIs, Statuswechsel und Push müssen dieselbe serverseitige Grenze anwenden. Mainserver-Kompatibilität oder breitere Credentials dürfen sie nicht aushebeln; vorhandene exakte Ownership-Prüfungen verwenden, keinen globalen Resolvermodus ändern.

Medien/Kategorien haben keine Organisationsgrenze. Vorhandene Lösch-/Referenzregeln weiterverwenden; referenzierte Ressourcen nicht mit beschädigten Inhaltsverweisen entfernen.

## Neue Mandanten und spätere Module

Die Standardrolle einmal im bestehenden transaktionalen Anlagepfad erzeugen, ohne Account-Zuweisungen. Wiederholungen eines fehlgeschlagenen Anlagevorgangs dürfen keine zweite Rolle erzeugen. Der laufende System-Admin-Reconcile darf diese Rolle nicht wie eine geschützte Rolle erzwingen.

Modulabgleich ergänzt bei vorhandener Standardrolle ausschließlich die redaktionellen Rechte neu verfügbarer Inhaltsmodule. Entzogene oder deaktivierte Module sind auch bei gespeicherten Grants unwirksam. Individuelle, fachfremde Grants nicht pauschal überschreiben. Bei fehlender Standardrolle erzeugt dieser Abgleich keine neue Rolle.

## Einmalige Bestandsmigration

1. Alle bestehenden Mandanten der jeweiligen Rollout-Umgebung erfassen; Plattformkontexte sind keine zusätzlichen Zielmandanten.
2. Je Mandant anhand `standard_editor` prüfen. Fehlende Rollen mit dem bestätigten Rechteprofil atomar anlegen; keine Mitglieder übernehmen oder automatisch zuweisen.
3. Vorhandene Rolle mit diesem Schlüssel nur vergleichen und unverändert lassen. Bei abweichendem Profil oder gleichnamiger anderer Rolle eine Kollision melden; keine automatische Umbenennung, Zusammenführung, zweite gleichnamige Rolle oder Rechteausweitung. Konflikt vor Abschluss des Rollouts ausdrücklich auflösen.
4. Anlage und Grants transaktional sichern; Fehler nicht als erfolgreichen Abschluss verbuchen. Bestehenden Migrationstracker für Wiederholbarkeit und Abschluss verwenden, keinen neuen Scheduler oder Restore-Mechanismus schaffen. Falls die bestehende Infrastruktur dafür nicht genügt, Entwurf vor Implementierung klären.
5. Nach Commit unabhängig je Mandant Rolle, Actions, Scopes, Löschbarkeit und fehlende automatische Mitgliedschaften zurücklesen. Abweichungen sichtbar ausweisen und keinen vollständigen Erfolg behaupten.

Nach erfolgreichem Abschluss wird die Migration nicht erneut ausgeführt. Eine später bewusst gelöschte Rolle bleibt deshalb auch nach Neustart, Modulabgleich und erneutem Rollout gelöscht. Kein automatischer Rollback darf inzwischen geänderte Rollen oder zugewiesene Mitglieder entfernen; bei Fehlern den regulären Rollout anhalten und anhand der gespeicherten Migrationsergebnisse gezielt korrigieren.

## Kritische Invarianten und geplanter Nachweis

| Invariante | Nachweis vor Merge am finalen HEAD |
| --- | --- |
| Organisation ODER persönlicher Inhaber, stets tenantlokal | Positive/negative Tests für aktive/fremde Organisation, persönliches Eigentum, fehlende Organisation, Organisationswechsel, fremden Mandanten und unklare Ownership |
| Vollständiger redaktioneller Ablauf bleibt gescopt | Parametrisierte Autorisierungsnachweise aller Inhaltsmodule einschließlich direkter API, Statuswechsel, Historie und Push; Mainserver mit breiten Credentials separat prüfen |
| Keine Wiederanlage nach Löschung | Integration: Migration/Neuanlage, Löschung, Neustart, Modulaktivierung und erneuter Rollout; Rolle bleibt abwesend |
| Bestand und Mitglieder bleiben erhalten | Mindestens zwei Testmandanten, bestehendes Profil, Schlüssel-/Namenskollision, keine automatische Zuweisung und unveränderter System-Admin |
| Migration ist vollständig oder sichtbar unvollständig | Fehler zwischen Rollenanlage und Grant, Retry, unabhängiger Readback und Vergleich der Mandantenergebnisse |
| Medien/Kategorien bleiben tenantlokal und referenzsicher | Mandantenweite CRUD-Positivfälle, Cross-Tenant-Negativfälle, Löschen referenzierter Ressourcen |

Fachliche Freigabe der Umsetzung, technischer Testnachweis, Rollout und fachliche Live-Abnahme werden getrennt dokumentiert.

## Umsetzung und Nachweisstand

Die Rollenanlage ist Teil desselben SQL-Statements wie der erstmalige `iam.instances`-Insert; `ON CONFLICT` auf den Mandanten erzeugt keinen zweiten Rollenauftrag. Core-/Modulabgleich ergänzen ausschließlich noch vorhandene Rollen und erhalten bestehende Grants durch `ON CONFLICT DO NOTHING`. Modulgrants verwenden den vorhandenen Ursprung `module_sync`, sodass Entzug nur diese Grants entfernt und manuelle Grants bestehen bleiben.

Migration 0116 ist eine reine Datenmigration ohne neue Tabellen, Trigger, Funktionen oder RLS-Verträge. Temporäre Arbeitstabellen leben nur bis zum Transaktionsende. Mandanten-/Rollenlocks schützen den Bestandsabgleich vor konkurrierender Anlage. Bestehende abweichende Rollen oder nicht kanonische Permission-Definitionen brechen vor Änderungen ab. Goose führt erfolgreiche Migrationen nicht bei jedem Start erneut aus; der nicht destruktive Down-Pfad erhält später angepasste Rollen und Mitgliedschaften. Eine manuell zurückgesetzte Migrationshistorie ist kein unterstützter Betriebspfad.

Die vorhandene Mainserver-Ownership-Prüfung wird für alle redaktionellen Datensatz-Actions bei direkter Mutation und Action-Projektion erzwungen; der globale Resolvermodus bleibt unverändert. Push beim News-Update steht zusätzlich in den am Ressourceninhaber geprüften Actions. Medien behalten ihren vorhandenen Referenz-Löschschutz; Kategorien verwenden den bestehenden Mainserver-Vertrag und erhalten keine neue lokale Löschlogik.

Die lokalen PostgreSQL-Tests verwenden eigens erzeugte und anschließend gelöschte Datenbanken, keine bestehende Studio- oder Live-Datenbank. Die tatsächliche Bestandsmigration, der unabhängige Live-Readback je Zielmandant und die fachliche Abnahme bleiben Teil eines gesondert autorisierten regulären Rollouts.

Hinweis zur Mandantentrennung: Die bestehende Migration 0023 deaktiviert RLS für die damaligen IAM-Basistabellen, darunter Rollen und Grants. Diese Änderung behält den vorhandenen Vertrag bei und prüft die expliziten Instanzfilter und tenantlokalen Joins mit zwei realen Testbeständen. Die lokalen Tests behaupten für diese Tabellen keinen produktiven RLS-Schutz und führen keine nebenläufige RLS-Migration ein.

## Lokale Prüfergebnisse (15.11.2026)

- Gezielte Unit-Tests: Core-Permission-Katalog; Rollen-/Modul-Repositories; IAM-Scope-Metadaten und Rollenlöschung; Mainserver-Ownership sowie News-/Push-, generische Inhalts-, Umfrage- und Kategorienverträge; Media-Service/-Autorisierung und Permission-Snapshot-Scopes. Die abschließende News-/Principal-Auswahl enthält 108 bestandene Prüfungen.
- Neun echte PostgreSQL-Integrationstests gegen den kanonischen Schema-Snapshot: zwei Bestandsmandanten, vollständige Action-/Scope-Auswahl aller elf Inhaltsmodule, keine automatische Mitgliedschaft, korrekter lokaler Sync-Status, wiederholte Anlage, bewusste Löschung, Modulabgleich, manuelle Grants, Identitäts-/Profil-/Permission-Konflikte sowie transaktionaler Fehler und Retry. Nach Commit erfolgen eigenständige SELECT-Abfragen; die Testdatenbanken und der eigens gestartete lokale PostgreSQL-Prozess sind entfernt beziehungsweise beendet.
- Type-Gates der fünf betroffenen Packages bestanden. Goose v3.26.0 validiert die Migrationsdateien; OpenSpec-Validierung mit `--strict`, Dateiplatzierung einschließlich der sieben neuen Dateien und Rollout-Dokumentationsprüfung bestanden.
- Keine neuen produktiven Packages, Services, Endpunkte, DB-Strukturen oder Scheduler. Hinzu kommen ausschließlich die Datenmigration und der echte PostgreSQL-Test als neue ausführbare Dateien; die übrige Implementierung erweitert vorhandene Pfade. Der OpenSpec-Change hält den vereinbarten neuen Lebenszyklus fest.
- Prüfungen beziehen sich auf den lokalen Arbeitsstand; kein Push, Merge, Deployment, produktiver Bestandsabgleich oder fachlicher Live-Abnahmenachweis. Die exakte finale HEAD-Evidenz und die vorgeschriebenen Reviews sind vor einem späteren Merge zu erbringen.

## Technisches Review

Das konsolidierte lokale Fachreview hat Migration, löschbaren Rollenlebenszyklus, Modulgrants, Push, Dokumentation und Testqualität geprüft. Zwei reale Befunde derselben Inhalts-Autorisierungsgrenze wurden zusammenhängend korrigiert: Core-Inhaltsaktionen müssen verfügbare Module respektieren; explizite Organisationsgrants müssen ohne aktive Organisation auf persönlichen Zugriff reduziert werden. Die Korrekturen erweitern die bestehenden Modulaktivierungs- und Permission-Loader-Pfade. Regressionstests prüfen die serverseitigen Positiv-/Negativfälle mit realer Entscheidungslogik.

PR #2205: Das initiale Complexity-Gate beanstandete Dateigrößen und eine durch unbeabsichtigte Formatierung vergrößerte Bestandsfunktion. Die Korrektur stellt unveränderte Formatierung wieder her, verwendet einen gemeinsamen identischen SQL-Join für die drei Permission-Abfragen, ordnet die Create-Abfrage dem vorhandenen SQL-Modul zu und führt Standard-Redakteur-Modulgrants durch den vorhandenen Grant-Pfad. Grenzwerte/Baselines bleiben unverändert. Gezielte Query-/Repository-Tests, neun PostgreSQL-Integrationstests, Lint und das lokale Complexity-Gate bestehen.

Modulvertragliche Ausnahmen: Gutscheine benötigen für Veröffentlichung und Zurückziehen zusätzlich `vouchers.publish` im Scope `organization`. Das Baustellenmodul unterstützt derzeit kein Löschen; `construction-sites.delete` wird daher weder bei Neuanlage noch in der Bestandsmigration gewährt. Es werden ausschließlich bereits vom jeweiligen Modul unterstützte redaktionelle Fähigkeiten vergeben.

Der abschließende maschinelle Abgleich importiert alle elf konkreten Plugin-Definitionen und vergleicht ihre redaktionellen Permissions mit Profil und Migration. Nach Ergänzung von `vouchers.publish` und Ausschluss des vom Baustellenmodul nicht unterstützten Löschens sind alle unterstützten Redaktionsfähigkeiten enthalten; Migration und Katalog weisen keine fehlenden/zusätzlichen Einträge oder Scope-Abweichungen auf. `surveys.moderate` und `surveys.export` betreffen Antwortmoderation/Ergebnisexport und bleiben außerhalb des Inhaltsprofils. Route-Gates für Veröffentlichung/Status und POI-/Medienabhängigkeiten sind geprüft.
