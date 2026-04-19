## ADDED Requirements
### Requirement: Medienmanagement als hostseitige Capability

Das System SHALL Medienmanagement als zentrale hostseitige Capability und nicht als isoliertes Fachplugin bereitstellen.

#### Scenario: Medienfunktion wird systemweit bereitgestellt

- **WHEN** das Studio Medien hochlädt, verwaltet oder ausliefert
- **THEN** erfolgt dies über eine zentrale Host-Capability mit gemeinsamem Domänenvertrag
- **AND** Fachmodule konsumieren diese Capability über definierte Referenzen oder Extension Points
- **AND** es entsteht keine konkurrierende Plugin-Eigenimplementierung für Storage, Varianten oder Sicherheitsgrenzen

### Requirement: Trennung von Originalmedium, Varianten und Nutzung

Das System SHALL Originalmedium, technische Varianten und fachliche Nutzung getrennt modellieren.

#### Scenario: Originalmedium bleibt führend erhalten

- **WHEN** ein Medium hochgeladen und später in mehreren Kontexten verwendet wird
- **THEN** bleibt das Originalmedium als führendes Asset erhalten
- **AND** technische Varianten werden davon abgeleitet
- **AND** Fachobjekte referenzieren das Asset statt einer konkreten Variantendatei

### Requirement: Kanonisches Medienmodell

Das System SHALL ein kanonisches Medienmodell mit `MediaAsset`, `MediaVariant` und `MediaReference` bereitstellen.

#### Scenario: Asset, Variante und Referenz sind getrennt identifizierbar

- **WHEN** ein Medium gespeichert und in einem Fachobjekt verwendet wird
- **THEN** existiert ein identifizierbares `MediaAsset` für das Original
- **AND** abgeleitete Dateien werden als `MediaVariant` modelliert
- **AND** die Nutzung durch Inhalte oder Konfigurationen wird als `MediaReference` gespeichert

### Requirement: Referenzbasierte fachliche Nutzung über Rollen

Das System SHALL Medien über fachliche Rollen statt über rohe Dateipfade anbinden.

#### Scenario: Inhalt referenziert ein Medien-Asset in einer fachlichen Rolle

- **WHEN** ein Inhalt ein Teaserbild oder ein Headerbild nutzt
- **THEN** speichert das System eine Referenz auf ein `MediaAsset`
- **AND** die Referenz enthält eine fachliche Rolle wie `teaser_image` oder `header_image`
- **AND** die konkrete technische Ausprägung wird nicht im Content-Modell fest verdrahtet

### Requirement: Zentrale Preset- und Variantensteuerung

Das System SHALL Varianten und Nutzungsklassen zentral konfigurieren können.

#### Scenario: Preset wird zentral angepasst

- **WHEN** ein Team eine Nutzungsklasse wie `thumbnail` oder `hero` technisch anpasst
- **THEN** erfolgt die Anpassung zentral
- **AND** bestehende Inhalte oder Referenzen bleiben fachlich unverändert
- **AND** es sind keine manuellen Content-Migrationen nur wegen geänderter Bildgrößen erforderlich

### Requirement: Hybride Variantengenerierung

Das System SHALL häufige Varianten direkt und seltene Varianten bei Bedarf generieren können.

#### Scenario: Upload erzeugt häufige Varianten sofort

- **WHEN** ein neues Bild hochgeladen wird
- **THEN** darf das System definierte häufige Varianten unmittelbar erzeugen
- **AND** kennzeichnet es weitere Varianten als später ableitbar

#### Scenario: Seltene Variante wird bei Bedarf erzeugt

- **WHEN** eine noch nicht vorhandene, erlaubte Variante erstmals benötigt wird
- **THEN** darf das System diese Variante bedarfsgesteuert erzeugen
- **AND** der ursprüngliche Asset-Vertrag bleibt unverändert

### Requirement: Redaktionelle und technische Metadaten

Das System SHALL technische und redaktionelle Metadaten getrennt, aber gemeinsam verwaltbar halten.

#### Scenario: Redaktion pflegt Metadaten

- **WHEN** ein Redakteur ein Medium im Studio bearbeitet
- **THEN** kann er mindestens Titel, Beschreibung, Alt-Text, Copyright, Lizenz und Tags pflegen
- **AND** technische Metadaten wie MIME-Type, Größe oder Abmessungen bleiben systemseitig nachvollziehbar

### Requirement: Nutzungstransparenz vor Löschung

Das System SHALL vor potenziell destruktiven Medienoperationen die aktuelle Verwendung des Assets nachvollziehbar machen.

#### Scenario: Löschentscheidung prüft aktive Referenzen

- **WHEN** ein Benutzer ein Asset löschen oder ersetzen will
- **THEN** zeigt das System, in welchen Objekten und Rollen das Asset aktuell verwendet wird
- **AND** eine Löschung mit aktiven, nicht explizit aufgelösten Referenzen wird fail-closed behandelt oder kontrolliert blockiert

### Requirement: Mandantenfähige Storage- und Auslieferungsgrenze

Das System SHALL Medien mandantenfähig speichern und öffentliche von geschützten Auslieferungspfaden trennen.

#### Scenario: Geschütztes Medium wird nicht wie ein öffentliches Asset ausgeliefert

- **WHEN** ein Medium als nicht öffentlich markiert ist
- **THEN** liefert das System es nur über einen kontrollierten Zugriffspfad wie signierte URLs oder gleichwertige Freigabemechanismen aus
- **AND** öffentliche Pfade oder Caches exponieren dieses Medium nicht unbegrenzt

#### Scenario: Medien verschiedener Instanzen bleiben getrennt

- **WHEN** Medien verschiedener Instanzen gespeichert oder abgefragt werden
- **THEN** erzwingt das System eine Mandantentrennung im Speicher- und Metadatenmodell
- **AND** organisations- oder instanzfremde Medien werden nicht offengelegt

### Requirement: Erweiterbarer Medientypenpfad

Das System SHALL den Vertrag so definieren, dass nachgelagerte Erweiterungen für weitere Medientypen möglich bleiben.

#### Scenario: Erster Schnitt beschränkt sich auf Bilder

- **WHEN** das System in einer ersten Iteration nur Bilder vollständig unterstützt
- **THEN** bleibt der Medienvertrag trotzdem offen für spätere Typen wie PDF, Audio oder Video
- **AND** der erste Schnitt zwingt keine Breaking Changes nur zur Erweiterung des Medientypenspektrums

### Requirement: Serverseitige Upload-Validierung

Das System SHALL jeden Datei-Upload serverseitig anhand des tatsächlichen Dateiinhalts validieren.

#### Scenario: Upload mit ungültigem oder nicht erlaubtem Medientyp wird abgelehnt

- **WHEN** ein Client eine Datei hochlädt
- **THEN** prüft das System den tatsächlichen Dateiinhalt gegen eine Allowlist erlaubter Medientypen (z. B. über Magic-Bytes oder äquivalente Inhaltsprüfung)
- **AND** der vom Client gesetzte `Content-Type`-Header wird nicht als vertrauenswürdig behandelt
- **AND** eine Datei, deren Inhalt nicht dem deklarierten oder erlaubten Medientyp entspricht, wird abgelehnt

#### Scenario: Upload über der konfigurierbaren Maximalgröße wird abgelehnt

- **WHEN** ein Client eine Datei hochlädt, die die systemseitig konfigurierte maximale Dateigröße überschreitet
- **THEN** lehnt das System den Upload mit einem klaren Fehlercode ab
- **AND** es werden keine Teile der Datei persistent gespeichert

### Requirement: Instanz-Speicherkontingent

Das System SHALL den genutzten Speicher pro Instanz gegen ein konfigurierbares Kontingent prüfen.

#### Scenario: Upload wird bei Kontingentüberschreitung abgelehnt

- **WHEN** ein Upload das verbleibende Speicherkontingent der Instanz überschreiten würde
- **THEN** lehnt das System den Upload mit einem eindeutigen Fehler ab
- **AND** es werden keine Teile der Datei persistent gespeichert
- **AND** bestehende Assets der Instanz bleiben unberührt
