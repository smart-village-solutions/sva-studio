## ADDED Requirements
### Requirement: Lizenz- und Copyright-Pflichtfelder

Das System SHALL Lizenz- und Copyright-Pflichtfelder je Medientyp oder Instanz konfigurieren und validieren können.

#### Scenario: Pflichtfelder hängen von Medientyp oder Instanz ab

- **WHEN** ein Asset angelegt oder zur Nutzung freigegeben wird
- **THEN** validiert das System Lizenz- und Copyright-Pflichtfelder anhand der aktiven Instanz- und Medientyp-Konfiguration
- **AND** Assets mit fehlenden Pflichtfeldern werden nicht als vollständig nutzbar markiert

### Requirement: Mehrsprachige Medienmetadaten

Das System SHALL redaktionelle Medienmetadaten pro unterstützter Sprache speichern können.

#### Scenario: Metadaten sind mehrsprachig pflegbar

- **WHEN** eine Instanz mehrere Sprachen unterstützt
- **THEN** kann das System redaktionelle Metadaten wie Titel, Beschreibung und Alt-Text sprachbezogen speichern
- **AND** ein fehlender Sprachwert fällt nachvollziehbar auf den konfigurierten Fallback zurück

### Requirement: Medienorganisation über Ordner, Tags und Kategorien

Das System SHALL Medien über Ordner, Tags und Kategorien organisieren können.

#### Scenario: Redaktion organisiert Medien

- **WHEN** ein Redakteur Medien pflegt
- **THEN** kann er ein Asset einem Ordner zuordnen und Tags oder Kategorien setzen
- **AND** Ordner, Tags und Kategorien unterstützen Suche und Filterung
- **AND** diese Einordnung ersetzt keine Berechtigungs- oder Mandantengrenzen

### Requirement: Hash-basierte Duplikaterkennung

Das System SHALL Uploads anhand eines Inhalts-Hashes auf Duplikate prüfen.

#### Scenario: Upload entspricht vorhandenem Asset

- **WHEN** ein Benutzer eine Datei hochlädt, deren Hash bereits in derselben Instanz existiert
- **THEN** erkennt das System das Duplikat vor oder während der Asset-Anlage
- **AND** gibt eine kontrollierte Entscheidung zurück, ob das vorhandene Asset wiederverwendet, der Upload blockiert oder ein bewusstes Duplikat angelegt wird
- **AND** instanzfremde Duplikate werden nicht offengelegt

### Requirement: Upload-Replace mit Referenzerhalt

Das System SHALL das Original eines Assets kontrolliert ersetzen können, ohne bestehende Medienreferenzen zu brechen.

#### Scenario: Original wird ersetzt

- **WHEN** ein berechtigter Benutzer ein Asset durch ein neues Original ersetzt
- **THEN** bleiben bestehende `MediaReference`-IDs und fachliche Rollen stabil
- **AND** technische Varianten werden neu erzeugt oder als veraltet markiert
- **AND** Usage-Impact, Audit und Löschschutz berücksichtigen das Replace-Ergebnis

### Requirement: Malware-Scan für Uploads

Das System SHALL Uploads über ein Malware-Scan-Gate prüfen können.

#### Scenario: Malware-Scan blockiert gefährliche Datei

- **WHEN** ein Upload durch den Malware-Scan als gefährlich oder nicht prüfbar eingestuft wird
- **THEN** markiert das System den Upload als `blocked` oder `failed`
- **AND** das Asset wird nicht als nutzbar freigegeben
- **AND** Benutzer erhalten redigierte Fehlerdetails ohne Scanner-Interna oder Storage-Secrets

### Requirement: Rollen- und instanzbezogene Upload-Limits

Das System SHALL Rate-Limits und Größenlimits pro Rolle und Instanz erzwingen können.

#### Scenario: Upload überschreitet Rollenlimit

- **WHEN** ein Benutzer ein für seine Rolle oder Instanz geltendes Rate- oder Größenlimit überschreitet
- **THEN** lehnt das System den Upload oder die Upload-Initialisierung mit einem eindeutigen Fehler ab
- **AND** der Fehler legt keine instanzfremden Grenzwerte oder Nutzungsdaten offen

### Requirement: Quota-Warnungen

Das System SHALL Speicherkontingentwarnungen vor der harten Kontingentgrenze auslösen können.

#### Scenario: Kontingentwarnung wird vor harter Grenze ausgelöst

- **WHEN** die Speichernutzung einer Instanz eine konfigurierte Warnschwelle erreicht
- **THEN** zeigt das System berechtigten Benutzern eine Quota-Warnung an
- **AND** Uploads bleiben bis zur harten Grenze nach den übrigen Regeln möglich
