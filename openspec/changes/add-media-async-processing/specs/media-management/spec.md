## MODIFIED Requirements

### Requirement: Hybride Variantengenerierung

Das System SHALL vorhandene Standard-Bildvarianten über die bestehende Studio-Job-Fähigkeit außerhalb des Upload-Requests erzeugen und seltene Varianten weiterhin bei Bedarf generieren können. Neu hochgeladene Medien SHALL erst nach erfolgreicher Validierung und vollständiger Standard-Variantenverarbeitung nutzbar sein.

#### Scenario: Upload-Abschluss nimmt einen Verarbeitungsauftrag an

- **WHEN** eine Datei übertragen wurde und der berechtigte Client den Upload abschließt
- **THEN** bestätigt das System die Annahme erst nach dauerhafter Einplanung des Studio-Jobs
- **AND** der Job führt die vorhandene Inhaltsvalidierung, Metadatenextraktion und Standard-Variantengenerierung aus
- **AND** bis zum erfolgreichen Abschluss bleibt das Medium für neue Referenzen und fachliche Auslieferung gesperrt
- **AND** ein Einplanungsfehler wird dem Client als Fehler gemeldet

#### Scenario: Upload und Content-Speichern warten auf Fertigstellung

- **WHEN** ein angenommener Medienjob noch nicht erfolgreich abgeschlossen ist
- **THEN** zeigen die bestehenden Upload-Ansichten die laufende Verarbeitung an
- **AND** UI und SDK prüfen den Zustand über begrenzte Statusabfragen am vorhandenen Asset-Lesepfad
- **AND** erst bei `ready` bestätigen sie den erfolgreichen Upload und lösen die reguläre Delivery-URL auf
- **AND** ein zugehöriger Content-Speichervorgang persistiert Inhalt und Referenzen erst danach
- **AND** ein Timeout oder endgültiger Verarbeitungsfehler bestätigt keinen Upload-Erfolg

#### Scenario: Wartezeit beim Bibliotheksupload überschritten

- **WHEN** die Wartezeit der Oberfläche für einen angenommenen Bibliotheksupload überschritten wird
- **THEN** läuft der Medienjob weiter, ohne einen zweiten Auftrag zu starten
- **AND** bleibt das Medium als „in Verarbeitung“ sichtbar, bis es fertiggestellt oder fehlgeschlagen ist
- **AND** bleibt sein aktueller Zustand über den vorhandenen Asset-Lesepfad abrufbar

#### Scenario: Wartezeit beim Content-Speichern überschritten

- **WHEN** die Wartezeit für die Medienverarbeitung eines Content-Speicherversuchs überschritten wird
- **THEN** endet dieser Versuch vor der Content-Persistenz mit einer verständlichen Fehlermeldung und erhaltenen Formulareingaben
- **AND** werden seine provisorischen Uploads über den bestehenden Abbruch-/Recovery-Pfad bereinigt
- **AND** bleiben bestehende Bibliotheksmedien und Referenzen unverändert
- **AND** erfolgt keine automatische Wiederaufnahme dieses Speichervorgangs

#### Scenario: Seltene Variante wird bei Bedarf erzeugt

- **WHEN** eine noch nicht vorhandene, erlaubte Variante erstmals benötigt wird
- **THEN** darf das System diese Variante bedarfsgesteuert erzeugen
- **AND** der ursprüngliche Asset-Vertrag bleibt unverändert

## ADDED Requirements

### Requirement: Medienverarbeitung verwendet vorhandene Studio-Jobs und Schutzmechanismen

Das System SHALL Medienverarbeitung als hosteigenen Job auf der vorhandenen Studio-Job-Fähigkeit ausführen und deren Status, Wiederholungsversuche und Betriebsdiagnostik verwenden. Bestehende Mandanten-, Claim-, Quoten- und Bereinigungsregeln SHALL erhalten bleiben.

#### Scenario: Wiederholung bleibt idempotent

- **WHEN** ein Upload-Abschluss wiederholt oder ein Medienjob technisch erneut ausgeführt wird
- **THEN** entsteht kein zweiter aktiver Verarbeitungsauftrag für denselben Upload
- **AND** werden Asset und Varianten höchstens einmal veröffentlicht und Speicherbytes höchstens einmal gebucht
- **AND** darf ein überholter Claim keine fremden Varianten veröffentlichen oder entfernen

#### Scenario: Fehler verwenden den vorhandenen Job-Lifecycle

- **WHEN** die Medienverarbeitung fehlschlägt
- **THEN** verwendet das System die vorhandene Unterscheidung zwischen technischen Wiederholungsversuchen und endgültigem Fehlschlag
- **AND** bleibt das neue Medium bis zur erfolgreichen Verarbeitung unreferenzierbar und nicht fachlich auslieferbar
- **AND** werden terminale Jobs nur über den bestehenden expliziten Wiederanstoß erneut ausgeführt
- **AND** bleiben Fehlerangaben redigiert und über die vorhandene Job-Diagnostik nachvollziehbar

#### Scenario: Finalisierung erhält Quote und Abbruchschutz

- **WHEN** ein Job seine Varianten veröffentlichen will
- **THEN** prüft die Finalisierung weiterhin den gültigen Upload-Claim und die harte Speicherquote vor `ready`
- **AND** verhindert ein inzwischen abgebrochener provisorischer Content-Speichervorgang die Veröffentlichung
- **AND** bleiben bei Ablehnung die bestehenden Bereinigungspfade wirksam, ohne fremde Assets oder Referenzen zu verändern
