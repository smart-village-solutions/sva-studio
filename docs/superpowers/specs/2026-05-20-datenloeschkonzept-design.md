# Design: Datenlöschkonzept für tenantbezogene Accounts

## Kontext

Das Studio benötigt ein tenantweites, automatisiertes Löschkonzept für Tenant-Accounts. Ziel ist es, inaktive Accounts nach klaren Regeln stufenweise zu behandeln, ohne Root- oder Plattform-Admins ohne Tenant-Scope in dieses Modell einzubeziehen.

Bereits vorhanden sind im IAM-Schema Soft-Delete-/DSR-nahe Felder auf `iam.accounts`, Audit-Logs in `iam.activity_logs`, bestehende DSR-/Governance-Logik sowie das tab-basierte Transparenz-Cockpit unter `/admin/iam`. Noch nicht vorhanden sind jedoch tenantbezogene Löschregeln für Inaktivität, ein passender Admin-Tab, ein Nutzer-Override für die Inhaltsbehandlung und ein sauberer fachlicher Zustandsautomat für diesen Lebenszyklus.

## Ziele

- Tenantweite Regeln für die automatische Behandlung inaktiver Tenant-Accounts
- Drei getrennt konfigurierbare Fristen relativ zu einem Referenzzeitpunkt:
  - Deaktivierung
  - Pseudonymisierung
  - Löschung
- Default-Werte für neue oder nicht konfigurierte Tenants
- Eine tenantweite Default-Strategie für die Behandlung eigener Inhalte
- Ein einfacher Nutzer-Override für die Behandlung der eigenen Inhalte
- Transparente Anzeige der tenantweiten Regeln im Bereich `Mein Konto`
- Bearbeitung der Regeln ausschließlich durch berechtigte Tenant-Admins
- Erhalt von Referenzintegrität und Auditierbarkeit durch Soft-Delete statt physischer Entfernung

## Nicht-Ziele

- Keine Regeln für Root-/Plattform-Admins ohne Tenant-Scope
- Kein neues Aktivitäts-Tracking-System für den ersten Wurf
- Keine physische Hard-Delete-Kaskade für Accounts oder Inhalte im ersten Wurf
- Keine per-Inhalt- oder per-Inhaltstyp-Overrides durch Nutzer
- Kein vollumfänglicher Ausbau auf alle tenantbezogenen Inhalte außerhalb von `iam.contents` im ersten Schritt
- Keine endgültige Feldliste für jede Pseudonymisierungsstufe in diesem Dokument

## Bewertete Ansätze

### Ansatz A: Erweiterung der bestehenden DSR-/Retention-Logik ohne eigenes Regelmodul

Die Inaktivitätslogik wird direkt in bestehende DSR- und Retention-Strukturen eingehängt.

Vorteile:

- weniger neue Tabellen und UI-Flächen
- niedrigerer initialer Modellierungsaufwand

Nachteile:

- vermischt antragsgetriebene Betroffenenrechte mit regelbasierter Inaktivitätsverwaltung
- fachlich schwerer zu erklären
- erhöht das Risiko unklarer Zuständigkeiten und Seiteneffekte

### Ansatz B: Eigenes tenantbezogenes Löschregel-Modul im IAM

Inaktivitätsregeln, Inhaltsstrategie, Nutzer-Override und Statusübergänge werden als eigener fachlicher Baustein im IAM modelliert und nur an bestehende Account-/Content-/Audit-Strukturen angedockt.

Vorteile:

- klare fachliche Trennung
- gute Erweiterbarkeit für UI, Jobs und Tests
- verständlicher Tenant-Scope
- saubere Basis für spätere Erweiterungen auf weitere Inhaltsdomänen

Nachteile:

- neue Persistenzobjekte
- neuer Admin-Tab
- zusätzlicher Integrationsaufwand in Routing und Governance

### Ansatz C: Reine Audit-Auswertung ohne persistiertes Regel- oder Statusmodell

Der periodische Lauf rekonstruiert Inaktivität und Behandlung ausschließlich aus Audits und bestehenden Accountfeldern.

Vorteile:

- wenig neue Schreibpfade

Nachteile:

- schlechter erklärbar
- höhere Laufzeit- und Query-Komplexität
- schwächere Nachvollziehbarkeit im UI
- riskanter bei späterer Erweiterung

## Entscheidung

Es wird Ansatz B umgesetzt: ein eigenes tenantbezogenes Löschregel-Modul im IAM.

Die Produktregel lautet:

> Jeder Tenant definiert drei Fristen relativ zu `zuletzt eingeloggt` sowie eine Default-Strategie für die Behandlung eigener Inhalte. Nutzer dürfen diese Inhaltsstrategie einmalig für ihre eigenen Inhalte überschreiben. Die automatische Verarbeitung endet nicht in einer physischen Löschung, sondern in einem finalen Soft-Delete-Zustand mit harter Pseudonymisierung bzw. Leerung personenbezogener Felder.

## Fachliches Modell

### Geltungsbereich

- Das Konzept gilt nur für Tenant-Accounts im Tenant-Scope.
- Root-/Plattform-Admins ohne Tenant-Scope sind explizit ausgenommen und bleiben vorerst manuell verwaltet.
- Die Regeln gelten tenantweit für alle Tenant-Accounts, unabhängig davon, ob ein Account normale Nutzer- oder Tenant-Admin-Rechte besitzt.

### Referenzzeitpunkt

Für den ersten Wurf ist der Referenzzeitpunkt immer `zuletzt eingeloggt`.

- Es wird keine neue Aktivitätserkennung entwickelt.
- Falls noch kein direkt persistierter Login-Zeitpunkt verfügbar ist, darf dieser aus bereits vorhandenen Login-Audits oder bestehenden Login-Projektionen abgeleitet werden.
- Ein neues Telemetrie- oder Aktivitäts-Tracking-System ist ausdrücklich nicht Teil dieses Vorhabens.

### Fristenmodell

Die drei Fristen sind absolute Schwellwerte relativ zum selben Referenzzeitpunkt, nicht inkrementelle Zusatzfristen.

Beispiel für Defaults:

- Deaktivierung nach 90 Tagen
- Pseudonymisierung nach 180 Tagen
- Löschung nach 365 Tagen

Ein Tenant kann diese Werte anpassen. Die Default-Annahme für den ersten Entwurf ist `90 / 180 / 365`.

### Account-Zustände

Der fachliche Lebenszyklus eines Tenant-Accounts besteht aus vier Zuständen:

- `active`
- `deactivated`
- `pseudonymized`
- `deleted`

Dabei gilt:

- `deactivated` ist ein gesperrter Zwischenzustand mit separatem Reaktivierungsprozess
- `pseudonymized` entfernt oder ersetzt direkte PII-Felder, erhält aber den Datensatz für Referenzen und Nachweise
- `deleted` ist kein physischer Hard-Delete, sondern ein finaler Tombstone-Soft-Delete-Zustand

### Reaktivierung

- Deaktivierung wird nicht durch einen erneuten Login automatisch aufgehoben.
- Ein deaktivierter Account benötigt einen separaten Reaktivierungsprozess.
- Solange keine Reaktivierung erfolgt, laufen spätere automatische Stufen weiter.

## Inhaltsmodell

### Tenantweite Default-Strategie

Jeder Tenant definiert genau eine Default-Strategie für die Behandlung eigener Inhalte eines Accounts:

- `beibehalten`
- `bei Deaktivierung mitbehandeln`
- `bei Pseudonymisierung mitbehandeln`
- `bei Löschung mitbehandeln`

### Nutzer-Override

- Jeder Nutzer kann genau eine eigene Inhaltsstrategie für seine eigenen Inhalte setzen.
- Der Override gilt pauschal für alle eigenen Inhalte dieses Accounts.
- Es gibt keine Overrides pro Inhaltstyp oder pro einzelnem Inhalt.
- Die Möglichkeit zur Überschreibung hängt nicht an einem speziellen Admin-Recht und ist für Nutzer standardmäßig verfügbar.

### Scope der Inhaltsbehandlung

Der erste Wurf gilt ausschließlich für Inhalte, die heute über `iam.contents` modelliert sind.

- Weitere tenantbezogene Inhaltsdomänen bleiben bewusst außerhalb des ersten Scopes.
- Das Modell soll so ausgelegt werden, dass eine spätere Erweiterung möglich bleibt.

### Effekt auf Inhalte

Wenn Inhalte mitbehandelt werden, folgt der Inhalt derselben gewählten Stufe wie der Account.

Das bedeutet im ersten Wurf:

- bei Deaktivierung: inhaltlicher Deaktivierungszustand
- bei Pseudonymisierung: inhaltliche Pseudonymisierung
- bei Löschung: inhaltlicher Lösch-Tombstone

Auch hier gilt im ersten Schritt: keine physische Entfernung, sondern zustandsbasierte Behandlung mit stabilen Platzhaltern wie `Pseudonymisiert` oder `Gelöscht`, sofern Autorenangaben sichtbar bleiben müssen.

## Persistenzansatz

Das Detailschema wird in der Umsetzung spezifiziert. Fachlich werden mindestens folgende Bausteine benötigt:

- tenantbezogene Regeln für Fristen und Default-Inhaltsstrategie
- accountbezogener Override für die persönliche Inhaltsstrategie
- accountbezogene Status- und Zeitstempelfelder für den automatischen Lebenszyklus
- optionale Job-/Transitions-Metadaten für Nachvollziehbarkeit und Betrieb

Die Daten werden in der IAM-Datenbank abgelegt. Grundlage für die Schemaarbeit ist die globale Schema-Datei `docs/development/studio-db-schema-final.sql`.

## Verarbeitungslogik

Die automatische Verarbeitung läuft als periodischer Tenant-Prozess.

Pflichten des Prozesses:

- Kandidaten je Tenant anhand von `zuletzt eingeloggt` ermitteln
- Fristschwellen für Deaktivierung, Pseudonymisierung und Löschung prüfen
- Zustandsübergänge deterministisch und idempotent ausführen
- Account- und Inhaltsbehandlung konsistent koppeln
- Ergebnisse nachvollziehbar protokollieren

Für den ersten Wurf gilt:

- keine Benutzerbenachrichtigung per E-Mail oder In-App vor einer Stufe
- keine individuellen Ausnahmen pro Account
- keine neue Fachentscheidung zu `Legal Hold` in diesem Dokument

Bestehende technische Schutzmechanismen wie `iam.legal_holds` dürfen durch die spätere Umsetzung nicht umgangen oder verschlechtert werden. Eine weitergehende fachliche Regel dafür wird separat entschieden.

## UI- und Berechtigungsmodell

### Admin-Bereich

Unter `/admin/iam` wird ein neuer Tab `deletion-rules` eingeführt.

Dort werden mindestens angezeigt und je nach Rolle bearbeitet:

- Deaktivierungsfrist
- Pseudonymisierungsfrist
- Löschfrist
- Default-Inhaltsstrategie
- Default-Werte und aktuelle Tenant-Werte

Die Einführung dieses Tabs ist auch ein Routing- und Search-Param-Contract-Change, da `/admin/iam` heute nur andere Tabs kennt.

### Nutzerbereich

Im Bereich `Mein Konto` werden die tenantweit geltenden Regeln eindeutig angezeigt:

- die drei Fristen
- die tenantweite Default-Inhaltsstrategie
- die eigene, aktuell wirksame Inhaltsstrategie des Nutzers

Der Nutzer kann dort seine persönliche Inhaltsstrategie überschreiben.

### Berechtigungen

- Tenant-Admins benötigen eine eigene Tenant-Berechtigung zur Bearbeitung der Löschregeln.
- Nur berechtigte Tenant-Admins dürfen die Verwaltungsfunktionen im UI aktiv nutzen.
- Root-/Plattform-Admins ohne Tenant-Scope sind nicht Teil dieser Oberfläche.

## Seeds und Defaults

Für das Feature werden Seeds für Default-Werte benötigt.

Die Seeds müssen mindestens sicherstellen:

- ein nachvollziehbarer Default-Satz für neue oder lokale Tenants
- idempotente Aktualisierung bestehender Seed-Daten
- klare Trennung zwischen fachlichen Defaults und tenantindividuellen Anpassungen

## Test- und Qualitätsfolgen

Die spätere Umsetzung muss mindestens folgende Prüfbereiche abdecken:

- Unit-Tests für Fristauswertung und Zustandsübergänge
- Unit-Tests für Inhaltsstrategie und Nutzer-Override
- Tests für idempotente periodische Verarbeitung
- Routing-/UI-Tests für den neuen Admin-Tab
- UI-Tests für die Darstellung in `Mein Konto`
- Tests für Rechteprüfung der Tenant-Admin-Bearbeitung
- Migrations- und Seed-Tests

Bei Schemaänderungen sind außerdem die zugehörigen Datenbankdokumente und Snapshots fortzuschreiben.

## Bewusst vertagte Detailentscheidungen

Diese Punkte sind erkannt, aber nicht Teil dieses Entwurfs:

- exakte Feldliste pro Pseudonymisierungs- und Löschstufe
- endgültige Legal-Hold-Fachregel im automatischen Lebenszyklus
- Ausweitung auf weitere Inhaltsdomänen außerhalb von `iam.contents`
- Benachrichtigungsstrategien vor einer Stufe
- operative Reporting- oder Vorschauansichten für Massenbetroffenheit

## Ergebnis

Der erste Ausbauschritt liefert ein verständliches, tenantweites und technisch beherrschbares Löschkonzept:

- Fristen relativ zu `zuletzt eingeloggt`
- kein neues Aktivitäts-Tracking
- eigener Admin-Tab `deletion-rules`
- Nutzer-Override nur für die persönliche Inhaltsstrategie
- Soft-Delete statt physischer Entfernung
- Pseudonymisierung und Tombstone-Zustände für Accounts und `iam.contents`

Damit bleibt der Scope eng genug für eine umsetzbare erste Iteration, ohne die später nötigen Erweiterungen strukturell zu verbauen.
