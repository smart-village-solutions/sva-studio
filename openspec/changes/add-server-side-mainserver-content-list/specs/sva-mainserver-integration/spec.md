## ADDED Requirements
### Requirement: Mainserver-Inhalte sind hostseitig in die kanonische Content-Liste projiziert

Das System SHALL Mainserver-News, -Events und -POI hostseitig in das kanonische Inhaltslistenmodell fuer `GET /api/v1/iam/contents` projizieren, ohne einen Browser-Vollscan oder ein lokales Dual-Write nach `iam.contents` vorauszusetzen.

#### Scenario: News erscheinen in der kanonischen Content-Liste

- **GIVEN** eine Instanz hat lesbare Mainserver-News und keine korrespondierenden lokalen IAM-Content-Datensaetze
- **WHEN** `GET /api/v1/iam/contents` fuer sichtbare Typen aufgerufen wird
- **THEN** projiziert der Host die Mainserver-News serverseitig in das gemeinsame Inhaltslistenmodell
- **AND** die Browser-Antwort enthaelt diese Eintraege ohne lokale Browser-Aggregation

#### Scenario: Events und POI erscheinen in der kanonischen Content-Liste

- **GIVEN** eine Instanz hat lesbare Mainserver-Events oder Mainserver-POI und keine korrespondierenden lokalen IAM-Content-Datensaetze
- **WHEN** `GET /api/v1/iam/contents` fuer sichtbare Typen aufgerufen wird
- **THEN** projiziert der Host die Mainserver-Events und -POI serverseitig in das gemeinsame Inhaltslistenmodell
- **AND** die Browser-Antwort enthaelt diese Eintraege ohne lokale Browser-Aggregation

#### Scenario: Mainserver-Projektion bleibt innerhalb der Host-Grenze

- **GIVEN** die kanonische Content-Liste benoetigt Mainserver-Daten
- **WHEN** die Listenanfrage verarbeitet wird
- **THEN** die Host-Runtime laedt und projiziert die Mainserver-Daten serverseitig
- **AND** Browser-Code und Plugin-Code erhalten keinen generischen GraphQL-Zugriff und keinen direkten Server-Bypass

### Requirement: Aggregierte Mainserver-Content-Liste unterstuetzt serverseitige Query-Semantik

Das System SHALL fuer Mainserver-projizierte Inhaltstypen serverseitige Pagination, Sortierung und Filterung innerhalb der kanonischen Content-Liste bereitstellen.

#### Scenario: Aggregierte Liste respektiert sichtbare Typen

- **GIVEN** die Listenanfrage enthaelt mehrere `visibleType`-Werte
- **WHEN** der Host die kanonische Content-Liste bildet
- **THEN** beruecksichtigt er nur die fuer die Anfrage sichtbaren Mainserver- und IAM-Inhaltstypen
- **AND** nicht sichtbare Typen erscheinen nicht in der Antwort

#### Scenario: Aggregierte Liste respektiert Seite und Seitengroesse

- **GIVEN** die Listenanfrage enthaelt `page` und `pageSize`
- **WHEN** der Host die kanonische Content-Liste fuer Mainserver-Inhalte berechnet
- **THEN** liefert er nur die angeforderte Seite im gemeinsamen Listenmodell zurueck
- **AND** die Antwort enthaelt eine dazu passende Pagination-Metadatenstruktur

#### Scenario: Aggregierte Liste respektiert Sortierung und Filter

- **GIVEN** die Listenanfrage enthaelt `q`, `type`, `status`, `sortBy` oder `sortDirection`
- **WHEN** der Host die kanonische Content-Liste fuer Mainserver-Inhalte berechnet
- **THEN** wendet er diese Query-Semantik serverseitig auf die aggregierte Liste an
- **AND** der Browser muss keine lokale Nachfilterung oder Nachsortierung ueber den Gesamtbestand ausfuehren

### Requirement: Aggregierte Mainserver-Content-Liste bleibt deterministisch bei Fehlern und Rechten

Das System SHALL Fehler, Sichtbarkeit und Rechte fuer serverseitig projizierte Mainserver-Inhalte in derselben Host-Antwort deterministisch behandeln.

#### Scenario: Mainserver-Quelle schlaegt fehl

- **GIVEN** eine fuer die angefragte kanonische Content-Liste benoetigte Mainserver-Quelle kann nicht erfolgreich geladen werden
- **WHEN** der Host die Listenanfrage verarbeitet
- **THEN** beendet er die Anfrage mit einem deterministischen Fehlervertrag
- **AND** der Browser verbleibt nicht in einem unendlichen Ladezustand

#### Scenario: Lokale Leseberechtigung fehlt fuer projizierten Inhalt

- **GIVEN** ein Mainserver-Inhalt ist technisch ladbar, aber lokal nicht fuer `content.read` freigegeben
- **WHEN** der Host die kanonische Content-Liste bildet
- **THEN** wendet er die bestehende hostseitige Rechtepruefung auf den projizierten Inhalt an
- **AND** der Inhalt erscheint nicht als unautorisiert sichtbarer Eintrag in der Antwort
