## ADDED Requirements

### Requirement: Mehrsprachige globale Medienmetadaten

Das System SHALL Titel, Beschreibung und globalen Alt-Text eines Medien-Assets je unterstützter Instanzsprache speichern und über eine deterministische Fallback-Regel auflösen können.

#### Scenario: Redaktion pflegt sprachbezogene Asset-Metadaten

- **WHEN** ein berechtigter Benutzer globale Metadaten eines Assets in einer unterstützten Instanzsprache pflegt
- **THEN** speichert das System Titel, Beschreibung und globalen Alt-Text sprachbezogen
- **AND** Copyright, Lizenz und technische Metadaten bleiben von dieser Lokalisierung unberührt
- **AND** verwendungsspezifische Metadaten einer `MediaReference` werden nicht überschrieben

#### Scenario: Angeforderte Sprache fehlt

- **WHEN** für ein Asset kein Wert in der angeforderten Sprache vorhanden ist
- **THEN** löst das System den Wert anhand der konfigurierten Fallback-Reihenfolge der Instanz auf
- **AND** liefert es neben dem Wert die tatsächlich verwendete Sprache
- **AND** kann die UI den Fallback für den Benutzer erkennbar darstellen

### Requirement: Getrennte Medienorganisation über Ordner, Tags und Kategorien

Das System SHALL Assets instanzlokal über optionale hierarchische Ordner, normalisierte Tags und kontrollierte Kategorien organisieren können.

#### Scenario: Redaktion organisiert ein Asset

- **WHEN** ein berechtigter Benutzer die redaktionelle Einordnung eines Assets ändert
- **THEN** kann er das Asset optional genau einem Ordner sowie mehreren Tags und Kategorien zuordnen
- **AND** Tags werden instanzlokal normalisiert
- **AND** Kategorien werden gegen die kontrollierte Wertemenge der Instanz validiert
- **AND** Asset-Identität und bestehende Medienreferenzen bleiben stabil

#### Scenario: Medien werden anhand der Organisation gesucht

- **WHEN** ein berechtigter Benutzer die Medienbibliothek nach Ordner, Tags oder Kategorien filtert
- **THEN** wendet das System die Filter serverseitig innerhalb der aktiven Instanz an
- **AND** kombiniert es die Filter mit der bestehenden Berechtigungs- und Mandantengrenze
- **AND** die redaktionelle Einordnung erweitert keine Zugriffsrechte

#### Scenario: Taxonomiewert wird geändert oder entfernt

- **WHEN** ein Ordner, Tag oder eine Kategorie umbenannt, verschoben oder entfernt wird
- **THEN** migriert oder entfernt das System betroffene Zuordnungen kontrolliert
- **AND** bestehende Asset- und Referenzidentitäten bleiben unverändert
- **AND** instanzfremde Zuordnungen werden nicht verändert

### Requirement: Instanzlokale Hash-basierte Duplikaterkennung

Das System SHALL validierte Uploads anhand eines kryptografisch geeigneten Hashes des tatsächlichen Dateiinhalts auf instanzlokale Duplikate prüfen.

#### Scenario: Upload entspricht einem sichtbaren vorhandenen Asset

- **WHEN** der Inhalts-Hash eines validierten Uploads einem vorhandenen Asset derselben Instanz entspricht
- **AND** der Benutzer dieses Asset lesen darf
- **THEN** bietet das System kontrolliert Wiederverwendung, ausdrücklich bestätigte Duplikatanlage oder Abbruch an
- **AND** erzeugt die Wiederverwendung kein zweites Storage-Objekt
- **AND** prüft der Server die gewählte Entscheidung gegen die bestehenden Medienberechtigungen

#### Scenario: Hash-Treffer darf nicht offengelegt werden

- **WHEN** ein übereinstimmender Hash nur in einer anderen Instanz oder an einem für den Benutzer nicht sichtbaren Asset existiert
- **THEN** legt das System weder Existenz noch Metadaten des Treffers offen
- **AND** gibt es keine rohen Inhalts-Hashes an den Client aus

### Requirement: Sicherer Originalaustausch mit stabiler Asset-Identität

Das System SHALL das Original eines Assets über einen versionierten, fail-closed Übergang austauschen können, ohne bestehende Medienreferenzen zu brechen.

#### Scenario: Neue Originalversion wird erfolgreich aktiviert

- **WHEN** ein berechtigter Benutzer das Original eines Assets ersetzt
- **AND** die neue Version Validierung, Malware-Prüfung und erforderliche Variantenverarbeitung erfolgreich abschließt
- **THEN** aktiviert das System die neue Originalversion atomar
- **AND** `MediaAsset`-ID, `MediaReference`-IDs und fachliche Rollen bleiben stabil
- **AND** Varianten werden aus der neuen Originalversion erzeugt und erhalten cache-sichere technische Identitäten

#### Scenario: Neue Originalversion kann nicht freigegeben werden

- **WHEN** Validierung, Malware-Prüfung oder erforderliche Variantenverarbeitung einer neuen Originalversion fehlschlägt
- **THEN** bleibt die bisher aktive Originalversion führend und nutzbar
- **AND** die fehlerhafte Version wird nicht an bestehende Referenzen ausgeliefert
- **AND** der Benutzer erhält einen redigierten, nachvollziehbaren Status

### Requirement: Retention und Quota-Abrechnung von Originalversionen

Das System SHALL inaktive und fehlgeschlagene Originalversionen nach instanzbezogenen Retention-Regeln bereinigen und ihre gespeicherten Bytes bis zur bestätigten physischen Löschung konsistent auf die harte Speicherquote anrechnen.

#### Scenario: Erfolgreicher Replace startet die Retention der Altversion

- **WHEN** eine neue Originalversion erfolgreich aktiviert wird
- **THEN** markiert das System die zuvor aktive Originalversion als inaktiv und nicht mehr auslieferbar
- **AND** berechnet es aus der zum Übergangszeitpunkt gültigen instanzbezogenen Retention-Regel einen unveränderlichen Bereinigungszeitpunkt
- **AND** bleiben die Altversion und ihre ausschließlich daraus abgeleiteten Varianten bis zur bestätigten physischen Löschung vollständig quotenwirksam

#### Scenario: Inaktive Altversion erreicht ihren Bereinigungszeitpunkt

- **WHEN** eine abgelöste Originalversion ihren beim Replace berechneten Bereinigungszeitpunkt erreicht
- **AND** keine dokumentierte Aufbewahrungssperre besteht
- **THEN** entfernt ein idempotenter Cleanup die Altversion und ihre ausschließlich daraus abgeleiteten Varianten
- **AND** die aktive Originalversion, Asset-Identität und Medienreferenzen bleiben unverändert

#### Scenario: Fehlgeschlagene Version erreicht ihren Bereinigungszeitpunkt

- **WHEN** eine niemals aktivierte Originalversion ihren aus der Fehler-Retention berechneten Bereinigungszeitpunkt erreicht
- **AND** keine dokumentierte Aufbewahrungssperre besteht
- **THEN** entfernt ein idempotenter Cleanup die Originalversion und ihre ausschließlich daraus abgeleiteten Varianten
- **AND** bestehende aktive Versionen, Asset-Identität und Medienreferenzen bleiben unverändert

#### Scenario: Physische Bereinigung wird bestätigt

- **WHEN** Originalversion und zugehörige Varianten nach Ablauf der Retention physisch vollständig gelöscht wurden
- **THEN** reduziert das System die serverseitig ermittelte Speichernutzung atomar und höchstens einmal um die bestätigten gespeicherten Bytes
- **AND** nachfolgende Cleanup-Wiederholungen verändern die Nutzung nicht erneut

#### Scenario: Physische Bereinigung schlägt fehl

- **WHEN** die Löschung einer inaktiven oder fehlgeschlagenen Version nicht vollständig bestätigt werden kann
- **THEN** bleiben ihre gespeicherten Bytes vollständig quotenwirksam
- **AND** wird die Bereinigung über den kanonischen Medienjob-Vertrag erneut versucht
- **AND** führt dieser Governance-Pfad keine eigene Queue-, Retry- oder Dead-Letter-Infrastruktur ein

### Requirement: Malware-Prüfung als Freigabe-Gate

Das System SHALL neue Originaldateien über einen produktneutralen Malware-Scanner-Port prüfen und nur nach einem Ergebnis `clean` zur Nutzung freigeben.

#### Scenario: Scan bestätigt eine unauffällige Datei

- **WHEN** der Malware-Scanner für eine validierte Originaldatei das Ergebnis `clean` liefert
- **THEN** darf das System den weiteren Freigabe- oder Aktivierungspfad fortsetzen
- **AND** die Freigabe bleibt zusätzlich von den übrigen Validierungs- und Processing-Regeln abhängig

#### Scenario: Datei ist gefährlich oder nicht verlässlich geprüft

- **WHEN** der Scan `infected`, `scan_failed`, `unavailable` oder `unknown` ergibt
- **THEN** bleibt das neue Asset oder die neue Originalversion fail-closed und nicht referenzierbar
- **AND** eine Replace-Operation lässt die bisher aktive Version unverändert
- **AND** Benutzer erhalten keine Scanner-Interna, Storage-Secrets oder sensitiven Dateidetails

#### Scenario: Scan wird asynchron ausgeführt

- **WHEN** ein Malware-Scan außerhalb des synchronen Upload-Pfads ausgeführt wird
- **THEN** verwendet er den kanonischen Medienjob-Vertrag aus `add-media-async-processing`
- **AND** dieser Governance-Pfad führt keine eigene Queue-, Retry- oder Dead-Letter-Infrastruktur ein

### Requirement: Instanzbezogene Quota-Frühwarnung

Das System SHALL berechtigte Benutzer anhand konfigurierbarer instanzbezogener Warnschwellen vor dem Erreichen der bestehenden harten Speicherquote informieren.

#### Scenario: Speichernutzung erreicht eine Warnschwelle

- **WHEN** die serverseitig ermittelte Speichernutzung einer Instanz eine konfigurierte Warnschwelle erreicht
- **THEN** zeigt das System berechtigten Benutzern Warnstufe, aktuelle Nutzung und harte Grenze an
- **AND** Uploads bleiben bis zur autoritativen harten Grenze nach den übrigen Regeln möglich
- **AND** der Client kann Nutzungswert oder Warnstatus nicht als Entscheidungsquelle vorgeben

#### Scenario: Benutzer darf Quota-Daten nicht sehen

- **WHEN** ein Benutzer ohne ausreichende Berechtigung einen Medien- oder Upload-Kontext öffnet
- **THEN** werden ihm weder Quota-Warnung noch interne Nutzungs- und Grenzwerte offengelegt
- **AND** die serverseitige Durchsetzung der harten Quote bleibt unverändert aktiv
