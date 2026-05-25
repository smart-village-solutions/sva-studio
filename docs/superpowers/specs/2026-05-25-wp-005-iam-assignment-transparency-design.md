# WP-005 Abschlussdesign: IAM-Zuweisungen und Vererbungs-Transparenz

Stand: `2026-05-25`

## Kontext

`WP-005` ist im aktuellen Code funktional weit fortgeschritten: Rollen, Gruppen, Keycloak-bezogene Rollenpflege, Organisationsvererbung und Geo-Vererbung sind technisch vorhanden. Für einen belastbaren Abschluss bestehen jedoch zwei gekoppelte Schwächen:

1. Die Admin-UI zeigt Quellen und Status von Berechtigungen, aber nicht durchgehend den fachlichen Wirkmechanismus von Vererbung und Restriktion.
2. Der bestehende Bearbeitungspfad für Benutzer-Rollen und Benutzer-Gruppen ersetzt Zuordnungen formularartig und kann dabei fachliche Assignment-Metadaten wie `valid_from`, `valid_to` und `origin` still verlieren.

Der Abschluss soll mindestens abnahmefähig sein, aber bewusst in Richtung eines fachlich sauberen Endzustands gehen.

## Ziele

- `WP-005` technisch so abschließen, dass die Abnahmekriterien zu Rollen, Gruppen, Vererbungen und Transparenz belastbar erfüllt werden.
- Den Schreibpfad für Benutzer-Rollen und Benutzer-Gruppen so stabilisieren, dass bestehende Zuweisungen nicht mehr unnötig destruktiv überschrieben werden.
- Die Admin-UI so erweitern, dass direkte, gruppenbasierte, organisationsvererbte und geo-vererbte Wirkpfade nachvollziehbar sichtbar sind.
- Die normierten Konflikt- und Randfälle als automatisierte Tests und als referenzierbares Abnahmeartefakt absichern.

## Nicht-Ziele

- Keine neue generische IAM-Subdomäne mit vollständig neuem API- oder Screen-Konzept.
- Kein allgemeiner Umbau aller IAM-Schreibpfade außerhalb von `WP-005`.
- Keine Neudefinition des Keycloak-Sync-Modells.
- Kein vollständiger Produktumbau der Rollen-, Gruppen- oder Benutzerverwaltung.

## Problemzuschnitt

### 1. Transparenzlücke

Im aktuellen User-Detailpfad werden Permission-Trace-Einträge mit Quelle, Status, Rolle, Gruppe, Scope und Organisation dargestellt. Für die Abnahme reicht das nur teilweise aus, weil der fachliche Wirkmechanismus nicht explizit transportiert wird:

- vererbt von übergeordneter Organisation
- vererbt von übergeordneter Geo-Einheit
- durch untergeordnete Restriktion blockiert
- unwirksam wegen deaktivierter Gruppe oder Gültigkeitsfenster

Die Engine kennt Teile dieser Information bereits konzeptionell, der Admin-Read-Pfad stellt sie aber nicht normiert bereit.

### 2. Zuweisungslücke

Im aktuellen User-Bearbeitungspfad werden Rollen- und Gruppenzuweisungen als Listen von `roleIds` und `groupIds` gespeichert. Serverseitig werden bestehende Zuweisungen dafür gelöscht und neu angelegt. Dadurch werden bei fachlich identischen Zuordnungen Metadaten nicht erhalten, sondern implizit neu erzeugt.

Das ist für `WP-005` problematisch, weil Gruppenmitgliedschaften und Rollenzuweisungen fachlich nicht nur aus der Ziel-ID bestehen, sondern auch aus Herkunft, Gültigkeitsfenster und Änderungsbedeutung.

## Architekturentscheidung

Der Abschluss erfolgt nicht über einen kompletten Rebuild, sondern über einen gezielten Ausbau der bestehenden Pfade in fünf Bausteinen:

1. kanonischer diff-basierter Assignment-Write-Pfad
2. kleine lokale Persistenzhärtung, falls für Assignment-Metadaten erforderlich
3. erweiterter Transparency-Contract für den User-Detailpfad
4. gezielte UI-Neustrukturierung mit klarer Zuständigkeit zwischen User- und Gruppenansicht
5. normierte Test- und Abnahmeschicht

Diese Entscheidung hält den Eingriff klein genug für `WP-005`, korrigiert aber die aktuelle fachliche Fragilität an der Ursache.

## Lösungsdesign

### 1. Assignment-Write-Pfad

Für Benutzer-Rollen und Benutzer-Gruppen wird ein kanonischer Serverpfad eingeführt, der Soll- und Ist-Zustand vergleicht und daraus einen Änderungsplan ableitet.

Prinzipien:

- Bestehende Zuordnungen bleiben erhalten, wenn sie fachlich identisch sind.
- Neue Zuordnungen werden nur bei echtem Delta angelegt.
- Entfernte Zuordnungen werden gezielt entfernt oder fachlich beendet.
- Gruppen- und Rollenmetadaten werden nicht implizit verworfen.

Fachlich identisch bedeutet:

- gleiche referenzierte Rolle oder Gruppe
- gleiche fachlich relevante Assignment-Metadaten
- keine Änderung des fachlichen Gültigkeitszustands

Der bestehende formularartige Lösch-/Neuaufbaupfad wird durch diesen diff-basierten Pfad ersetzt oder intern auf ihn umgeleitet.

### 2. Persistenzhärtung

Falls die bestehende Tabellenstruktur für den diff-basierten Pfad nicht ausreicht, sind kleine lokale DB-/Persistenzänderungen zulässig. Der Eingriff bleibt auf Rollen- und Gruppenzuweisungen begrenzt.

Zulässige Änderungen:

- Ergänzung oder Präzisierung von Assignment-Metadaten
- eindeutige technische Regeln für fachlich identische Zuordnungen
- lokale Migrationsanpassung für konsistente Änderbarkeit

Nicht zulässig:

- neue generische IAM-Historisierung
- neues vollständiges Event-Sourcing-Modell
- globale Schema-Reorganisation

### 3. Transparency-Contract

Der User-Detailvertrag wird um explizite Transparenzfelder erweitert. Ziel ist nicht nur die Anzeige der Quelle, sondern die Anzeige der fachlichen Wirkung.

Zusätzliche Informationsarten:

- direkte Zuweisung
- wirksam über Gruppenpfad
- organisationsvererbt von `organizationId`
- geo-vererbt von `geoUnitId`
- blockiert durch Restriktion
- unwirksam wegen deaktivierter Gruppe
- unwirksam wegen zukünftigem oder abgelaufenem Gültigkeitsfenster

Der Vertrag soll so strukturiert sein, dass die UI keine fachliche Interpretation aus freien `scope`-Feldern erraten muss, sondern benannte semantische Hinweise erhält.

### 4. UI-Zuschnitt

Die UI darf sich sichtbar verändern, wenn das der fachlichen Klarheit dient.

#### User-Detail

Das User-Detail wird zum Transparenzzentrum für `WP-005`.

Die Ansicht trennt klar:

- direkte Rollen- und Gruppenzuweisungen
- effektive Rechte
- vererbte Wirkpfade
- unwirksame oder blockierte Pfade mit Grund

Die Darstellung soll erkennbar machen:

- woher ein Recht kommt
- warum es wirksam ist
- warum es nicht wirksam ist
- ob eine Wirkung aus Organisation, Gruppe oder Geo-Hierarchie stammt

#### User-Assignments

Die Pflege von Rollen und Gruppen im User-Pfad wird semantisch verbessert:

- bestehende Assignment-Metadaten werden nicht still zerstört
- bestehende Herkunft und Gültigkeit werden sichtbar gemacht
- Änderungen wirken gezielt statt pauschal ersetzend

Der User-Pfad muss nicht die vollständige Feinpflege aller Zeitfenster bieten, darf aber bestehende Informationen nicht mehr unabsichtlich verlieren.

#### Group-Detail

Die Gruppenansicht bleibt der operative Pflegepfad für Membership-Feinheiten wie `valid_from` und `valid_until`.

Wenn zusätzliche UI-Arbeit nötig wird, wird sie primär dort eingebaut und nicht dupliziert zwischen Gruppen- und Benutzeransicht.

#### Role-Detail

Die Rollenansicht bleibt auf Permission-Katalog, Zuweisungen und Sync-Zustand fokussiert. Vererbungsdiagnostik ist nicht ihre primäre Verantwortung.

### 5. Test- und Abnahmeschicht

Der Abschluss von `WP-005` verlangt vier Testebenen:

#### Core-/Unit-Tests

- direkte Rolle plus Gruppenrolle als Mehrfachherkunft
- deaktivierte Gruppe
- zukünftige Mitgliedschaft
- abgelaufene Mitgliedschaft
- Organisationsvererbung
- Geo Parent-Allow mit Child-Deny
- instanzfremde oder unbekannte Geo-/Gruppendaten

#### Server-Tests

- diff-basierte Assignment-Planung
- Erhalt vorhandener `valid_from`, `valid_to`, `origin` bei fachlich identischem Zustand
- gezielte Entfernung oder Neuanlage nur bei echtem Delta
- strukturierter Transparenzvertrag mit Vererbungs- und Restriktionshinweisen

#### UI-Tests

- Unterscheidung direkter, vererbter und unwirksamer Rechte
- sichtbare Begründung von Restriktion oder Inaktivität
- Bearbeitung im User-Pfad zerstört bestehende Assignment-Metadaten nicht implizit

#### Abnahme-Artefakt

Es wird ein deutsches `WP-005`-Abnahmedokument unter `docs/reports/` erstellt, das die normierten Fälle referenziert und die UI-Nachweise explizit mitführt.

## Datenfluss

### Lesen

1. User-Detail lädt Benutzerstammdaten, Rollen, Gruppen und Transparenzdaten.
2. Der Server bildet aus DB-Zustand und Permission-Auflösung einen strukturierten Transparenzsatz.
3. Die UI rendert direkte Zuweisungen, wirksame Rechte und unwirksame Pfade in getrennten Blöcken.

### Schreiben

1. Die UI sendet den gewünschten Bearbeitungszustand.
2. Der Server lädt den aktuellen Ist-Zustand.
3. Ein diff-basierter Planner erzeugt gezielte Mutationen.
4. Persistenz und nachgelagerte Invalidation laufen auf Basis dieses Plans.
5. Der aktualisierte Detailzustand wird zurückgeliefert.

## Fehlerbehandlung

- Wenn Transparenzdaten wegen Schema- oder Laufzeitdrift nicht vollständig berechnet werden können, wird dies als degradierter Zustand mit strukturierter Diagnose ausgewiesen.
- Wenn eine angeforderte Änderung bestehende fachliche Assignment-Metadaten nicht sauber abbilden kann, schlägt der Schreibpfad fail-closed fehl statt stillschweigend zu überschreiben.
- Bestehende Diagnosepfade für Keycloak- oder Reconcile-Probleme bleiben erhalten und werden nicht durch `WP-005` umgebaut.

## Auswirkungen auf Codebereiche

- `packages/auth-runtime/src/iam-account-management/`
- `packages/iam-admin/src/`
- `packages/core/src/iam/`
- `apps/sva-studio-react/src/routes/admin/users/`
- `apps/sva-studio-react/src/routes/admin/groups/`
- optional lokal betroffene Migrations- und Schema-Dokumente unter `packages/data/` und `docs/development/`

## Risiken und Trade-offs

### Risiko: Scope-Ausweitung

Sobald Assignment-Logik, UI und Transparenzvertrag gemeinsam angefasst werden, besteht das Risiko eines verdeckten IAM-Teilumbaus.

Mitigation:

- nur User-/Group-/Role-Pfade mit direktem Bezug zu `WP-005`
- keine Generalisierung ohne unmittelbaren Nutzen
- Rollen-Sync-Architektur explizit außerhalb des Scopes belassen

### Risiko: UI überlädt den User-Pfad

Mehr Transparenz kann schnell in eine technisch überladene Diagnoseansicht kippen.

Mitigation:

- klare Trennung zwischen direkte Zuweisungen, wirksame Rechte und unwirksame Pfade
- Feingranularität bei Membership-Fenstern im Group-Detail konzentrieren

### Risiko: Persistenzänderung wird größer als geplant

Wenn der aktuelle Datenbestand oder Constraints den diff-basierten Pfad nicht sauber zulassen, kann eine kleine Änderung in ein größeres Schema-Thema kippen.

Mitigation:

- zuerst Planner und bestehende Tabellenregeln prüfen
- Migration nur lokal und minimal
- DB-Dokumentation und Snapshot nur bei realem Schema-Delta fortschreiben

## Erfolgsdefinition

`WP-005` gilt technisch sauber abgeschlossen, wenn folgende Aussage belastbar stimmt:

- Rollen und Gruppen können weiter verwaltet und zugewiesen werden.
- Organisations- und Geo-Vererbung bleiben korrekt wirksam.
- Die Admin-UI zeigt direkte, gruppenbasierte, organisationsvererbte und geo-vererbte Wirkpfade nachvollziehbar an.
- Inaktive oder blockierte Rechte werden mit Grund sichtbar.
- Bearbeitung von Benutzer-Rollen und Benutzer-Gruppen zerstört bestehende fachliche Assignment-Metadaten nicht mehr stillschweigend.
- Die normierten Konfliktfälle sind automatisiert abgesichert und in einem WP-005-Abnahmeartefakt referenziert.

## Umsetzungsreihenfolge

1. Transparenzvertrag und Ziel-UI final normieren
2. diff-basierten Assignment-Write-Pfad entwerfen und gegen Ist-Persistenz abgleichen
3. notwendige lokale Persistenzanpassungen entscheiden
4. Server- und Core-Pfade umsetzen
5. User- und Group-UI nachziehen
6. Testmatrix und Abnahmedokument finalisieren
