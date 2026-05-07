## MODIFIED Requirements
### Requirement: Hybride Variantengenerierung

Das System SHALL Medienvarianten außerhalb des regulären Upload-Request-Pfads asynchron verarbeiten können und dabei Upload-Annahme, Referenzierbarkeit und technische Auslieferungsbereitschaft getrennt behandeln.

#### Scenario: Upload legt Asset an und startet späteren Verarbeitungsweg

- **WHEN** ein neues Bild erfolgreich validiert und angenommen wurde
- **THEN** darf das System das `MediaAsset` und eine erste `MediaReference` bereits vor Abschluss der Variantenverarbeitung anlegen
- **AND** die reguläre Variantenverarbeitung läuft nicht mehr verpflichtend synchron im Upload-Request
- **AND** das System markiert das Asset stattdessen als noch in Verarbeitung oder fachlich gleichwertig

#### Scenario: Varianten werden nachgelagert statt im Request-Pfad erzeugt

- **WHEN** ein angenommenes Asset seine Standardvarianten noch nicht besitzt
- **THEN** erfolgt deren Erzeugung über einen nachgelagerten Verarbeitungsweg
- **AND** der ursprüngliche Upload-Vertrag bleibt auf Validierung, Annahme und Auslösen der Verarbeitung begrenzt
- **AND** das System führt keine zweite, davon unabhängige Sofort-Variantenpflicht für kleine Standardfälle als regulären Produktpfad ein

#### Scenario: Referenz bleibt trotz laufender Verarbeitung stabil

- **WHEN** Inhalte ein Asset unmittelbar nach dem Upload referenzieren
- **THEN** bleibt die fachliche `MediaReference` stabil und gültig
- **AND** die spätere Variantenverarbeitung ändert die Referenzidentität nicht
- **AND** technische Varianten bleiben weiterhin abgeleitete Artefakte des Assets

## ADDED Requirements
### Requirement: Asynchrone Medienverarbeitung nutzt die generische Studio-Job-Fähigkeit

Das System SHALL die spätere asynchrone Medienverarbeitung an die generische Studio-Job-Fähigkeit anbinden, statt dafür eine media-spezifische Job-Plattform als führenden Vertrag einzuführen.

#### Scenario: Medienverarbeitung verwendet den zentralen Studio-Job-Vertrag

- **WHEN** das Studio Variantenverarbeitung oder gleichwertige nachgelagerte Medienverarbeitung asynchron ausführt
- **THEN** nutzt diese Verarbeitung die generische Studio-Job-Fähigkeit des Studios
- **AND** Medien definieren darauf nur ihren fachlichen Jobtyp und ihre Payload
- **AND** die zentrale Job-Persistenz, das pluginübergreifende Monitoring und der grundlegende Lifecycle werden nicht als parallele Media-Sonderlösung dupliziert

#### Scenario: Erste Medienjobs übernehmen das plattformweite Statusmodell

- **WHEN** die erste Ausbaustufe der generischen Studio-Job-Fähigkeit für Medien genutzt wird
- **THEN** folgen Medienjobs mindestens dem plattformweiten Statusmodell wie `queued`, `running`, `succeeded`, `failed` und `cancelled`
- **AND** dieser Change führt kein davon abweichendes eigenes Primärstatusmodell für Jobs ein

#### Scenario: Wiederholung erfolgt auch für Medien über neuen Job

- **WHEN** eine Medienverarbeitung in der ersten Ausbaustufe fehlschlägt oder abgebrochen wurde
- **THEN** wird sie nicht als derselbe Job automatisch neu gestartet
- **AND** eine erneute Ausführung erfolgt bei Bedarf über einen neuen Job oder einen späteren plattformkonformen Wiederanstoß
- **AND** dieser Change zieht keine media-spezifische automatische Retry-Logik vor die generische Job-Fähigkeit

### Requirement: Processing-Assets bleiben sofort referenzierbar und kontrolliert auslieferbar

Das System SHALL angenommene Medienassets bereits vor vollständiger Variantenverarbeitung referenzierbar halten und deren Auslieferung bis `ready` kontrolliert degradieren können.

#### Scenario: Neues Asset ist vor `ready` bereits nutzbar

- **WHEN** ein Upload validiert und angenommen wurde, aber Standardvarianten noch verarbeitet werden
- **THEN** darf das Asset bereits in Inhalten, Konfigurationen oder Auswahldialogen referenziert werden
- **AND** die UI behandelt diesen Zustand sichtbar als laufende Verarbeitung statt als vollständig bereit

#### Scenario: Delivery nutzt Original oder Placeholder bis Varianten bereit sind

- **WHEN** eine angeforderte Variante für ein referenziertes Asset noch nicht verfügbar ist
- **THEN** darf das System kontrolliert auf das Originalmedium oder einen definierten Placeholder zurückfallen
- **AND** diese Degradation bleibt für den jeweiligen Auslieferungspfad fachlich und technisch explizit
- **AND** aus dem Fallback entsteht kein stillschweigender Dauerersatz für fehlende Varianten

#### Scenario: Kritische Auslieferungspfade dürfen Placeholder erzwingen

- **WHEN** ein Auslieferungspfad das Originalmedium aus Sicherheits-, Performance- oder Darstellungsgründen nicht verwenden darf
- **THEN** darf das System bis zur Fertigstellung der Varianten stattdessen einen Placeholder oder eine gleichwertig kontrollierte Nicht-Zielauslieferung verwenden
- **AND** der zugrunde liegende Referenzvertrag des Assets bleibt davon unberührt

### Requirement: Asset-Status und Verarbeitungsfortschritt bleiben getrennt nachvollziehbar

Das System SHALL fachliche Asset-Nutzbarkeit und technischen Verarbeitungsfortschritt getrennt, aber korrelierbar abbilden.

#### Scenario: Asset zeigt Verarbeitung und Nutzbarkeit getrennt an

- **WHEN** ein berechtigter Benutzer ein Medium im Studio betrachtet
- **THEN** kann er unterscheiden, ob das Asset bereits angenommen und referenzierbar ist
- **AND** ob die nachgelagerte Verarbeitung noch läuft, erfolgreich war oder fehlgeschlagen ist
- **AND** technische Fehlerdetails bleiben redigiert und offenbaren keine Secrets, Storage-Artefakte oder PII

#### Scenario: Verarbeitungsfehler blockiert nicht die Referenzidentität

- **WHEN** die nachgelagerte Medienverarbeitung fehlschlägt
- **THEN** bleibt die Identität des Assets und bestehender Referenzen erhalten
- **AND** das System weist den Fehlerzustand nachvollziehbar aus
- **AND** ein späterer plattformkonformer neuer Verarbeitungsjob darf an dasselbe Asset anknüpfen
