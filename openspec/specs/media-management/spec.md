# media-management Specification

## Purpose

TBD - created by archiving change add-media-management. Update Purpose after archive.
## Requirements
### Requirement: Medienmanagement als hostseitige Capability

Das System SHALL Medienmanagement als zentrale hostseitige Capability und nicht als isoliertes Fachplugin bereitstellen.

#### Scenario: Medienfunktion wird systemweit bereitgestellt

- **WHEN** das Studio Medien hochlädt, verwaltet oder ausliefert
- **THEN** erfolgt dies über eine zentrale Host-Capability mit gemeinsamem Domänenvertrag
- **AND** Fachmodule konsumieren diese Capability über definierte Referenzen oder Extension Points
- **AND** es entsteht keine konkurrierende Plugin-Eigenimplementierung für Storage, Varianten oder Sicherheitsgrenzen

### Requirement: Hostseitiger Admin-Einstieg für Medienmanagement

Das System SHALL Medienmanagement mit einem kanonischen hostseitigen Einstieg unter `/admin/media` materialisieren und bei Bedarf spezialisierte Medien-Workflows unterhalb dieses Bereichs oder als hostseitig gesteuerte Overlay-Workflows bereitstellen.

#### Scenario: Medienbibliothek wird über hosteigene Admin-Route geöffnet

- **WHEN** ein berechtigter Benutzer die Medienbibliothek öffnet
- **THEN** erfolgt der Einstieg über eine hostmaterialisierte Route `/admin/media`
- **AND** Navigation, Guards, Search-Params und Standardaktionen folgen dem hostseitigen Admin-Ressourcenvertrag
- **AND** es entsteht kein separater, konkurrierender Medien-Haupteinstieg außerhalb des Admin-Bereichs

#### Scenario: Spezialisierter Medien-Workflow benötigt eigene Oberfläche

- **WHEN** Fokuspunkt-Bearbeitung, Zuschnitt, Variantenanalyse oder Usage-Impact eine spezialisierte Oberfläche benötigen
- **THEN** darf das System dafür hosteigene Unterrouten unter `/admin/media/...` bereitstellen
- **AND** diese Unterrouten bleiben an denselben Host-, Guard- und Berechtigungsvertrag gebunden
- **AND** sie umgehen nicht die zentrale Medien-Capability

#### Scenario: Content-Editor startet bestehenden hostseitigen Medien-Overlay-Flow

- **WHEN** ein ausreichend berechtigter Benutzer in einem Content-Editor Bibliotheksauswahl oder Upload startet
- **THEN** verwendet das System den bestehenden hostseitig gesteuerten Medien-Overlay-Flow statt eines plugin-eigenen Upload- oder Bibliotheksdialogs
- **AND** verwendet der Overlay-Flow denselben kanonischen Upload-Intake wie die Medienverwaltung
- **AND** bleibt der Abschluss kontextabhängig an den aufrufenden Editor gebunden

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

### Requirement: Migrationspfad für bestehende URL-basierte Medienfelder

Das System SHALL für bestehende URL-basierte Medienfelder in Host-Plugins einen expliziten Bridge- und Migrationspfad auf hostseitige Medienreferenzen bereitstellen.

#### Scenario: Bestehendes Fachmodul nutzt noch URL-basierte Medienfelder

- **WHEN** ein bestehendes Modul wie News, Events oder POI Medien noch über `sourceUrl`, `imageUrl` oder analoge URL-Felder verwaltet
- **THEN** definiert das System einen kontrollierten Übergangspfad zur hostseitigen `MediaAsset`-/`MediaReference`-Nutzung
- **AND** der Altbestand bleibt während der Migration funktional
- **AND** URL-basierte Felder gelten nicht als langfristiger Zielvertrag

#### Scenario: Plugin wechselt vom URL-Feld auf den Media-Picker

- **WHEN** ein Plugin oder Host-Modul auf den hostseitigen Media-Picker umgestellt wird
- **THEN** werden neue oder geänderte Medienbeziehungen über hostseitige Medienreferenzen gespeichert
- **AND** der Plugin-Vertrag erhält keine direkten Storage-Artefakte
- **AND** bestehende Inhalte können kontrolliert übernommen oder migriert werden

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

### Requirement: Bild-Fokuspunkt und Zuschnitt

Das System SHALL für Bilder einen Fokuspunkt und definierte Zuschnitte speichern und bei der Variantengenerierung berücksichtigen können.

#### Scenario: Redaktion setzt einen Fokuspunkt

- **WHEN** ein Redakteur für ein Bild einen Fokuspunkt setzt
- **THEN** speichert das System den Fokuspunkt als strukturierte Bildmetadaten
- **AND** automatische Zuschnitte und responsive Varianten berücksichtigen diesen Fokuspunkt
- **AND** Inhalte speichern weiterhin nur Medienreferenzen und keine technischen Crop-Koordinaten als führenden Vertrag

#### Scenario: Redaktion setzt einen Zuschnitt für eine Nutzung

- **WHEN** ein Redakteur für eine Bildnutzung einen Zuschnitt festlegt
- **THEN** speichert das System den Zuschnitt als strukturierte Bearbeitungsmetadaten am Asset oder an der rollenbezogenen Medienreferenz
- **AND** daraus generierte Varianten verwenden diesen Zuschnitt
- **AND** das unveränderte Originalmedium bleibt erhalten

### Requirement: Automatische Verkleinerung übergroßer Bilder

Das System SHALL übergroße Bilder beim Processing gemäß zentral konfigurierter Maximalabmessungen verkleinern können.

#### Scenario: Upload überschreitet maximale Processing-Abmessungen

- **WHEN** ein hochgeladenes Bild die konfigurierte maximale Breite oder Höhe für auslieferbare Varianten überschreitet
- **THEN** erzeugt das System verkleinerte Varianten innerhalb der erlaubten Maximalabmessungen
- **AND** das unveränderte Original bleibt als führendes Asset erhalten, solange es die Upload- und Speicherregeln erfüllt
- **AND** ausgelieferte Standardvarianten verwenden nicht ungeprüft das übergroße Original

### Requirement: Redaktionelle und technische Metadaten

Das System SHALL technische und redaktionelle Metadaten getrennt, aber gemeinsam verwaltbar halten und globale Asset-Metadaten nicht mit contentbezogenen Verwendungsmetadaten gleichsetzen.

#### Scenario: Redaktion pflegt globale Asset-Metadaten

- **WHEN** ein Redakteur mit `media.update` ein Medium in der Medienverwaltung oder im Review bearbeitet
- **THEN** kann er mindestens Titel, Beschreibung, Alt-Text, Copyright und Lizenz am `MediaAsset` pflegen
- **AND** technische Metadaten wie MIME-Type, Größe oder Abmessungen bleiben systemseitig nachvollziehbar
- **AND** bestehende Content-Snapshots werden durch diese Änderung nicht automatisch überschrieben

#### Scenario: Review ohne globale Änderungsberechtigung

- **WHEN** ein Redakteur ein Asset mit `media.read` und `media.reference.manage`, aber ohne `media.update` überprüft
- **THEN** zeigt der Review die globalen Asset-Metadaten schreibgeschützt
- **AND** darf der Redakteur das Asset bei ansonsten erfülltem Zielvertrag übernehmen

#### Scenario: Upload im Content-Kontext erzwingt Review vor Abschluss

- **WHEN** ein Benutzer im Content-Kontext ein neues Medium hochlädt
- **THEN** wechselt der hostseitige Medien-Overlay-Flow nach erfolgreichem Upload in einen Review-Schritt
- **AND** sind globale Metadaten nur mit `media.update` editierbar
- **AND** darf der Overlay-Flow das Medium erst nach einem expliziten Abschluss in den Content-Kontext zurückgeben

### Requirement: Upload-Status mit Fehlerdetails

Das System SHALL den Upload- und Processing-Status eines Assets mit redigierten Fehlerdetails abbilden.

#### Scenario: Upload durchläuft Verarbeitung

- **WHEN** ein Upload validiert, verarbeitet, abgelehnt oder blockiert wird
- **THEN** aktualisiert das System einen Status wie `validated`, `processed`, `failed` oder `blocked`
- **AND** Fehlerdetails sind für berechtigte Benutzer nachvollziehbar
- **AND** technische Secrets, Storage-Artefakte und PII werden in Fehlerdetails nicht offengelegt

### Requirement: Nutzungstransparenz vor Löschung

Das System SHALL vor potenziell destruktiven Medienoperationen die aktuelle Verwendung des Assets nachvollziehbar machen.

#### Scenario: Löschentscheidung prüft aktive Referenzen

- **WHEN** ein Benutzer ein Asset löschen oder archivieren will
- **THEN** zeigt das System, in welchen Objekten und Rollen das Asset aktuell verwendet wird
- **AND** eine Löschung mit aktiven, nicht explizit aufgelösten Referenzen wird fail-closed behandelt oder kontrolliert blockiert

#### Scenario: Usage-Impact wird vor Änderung angezeigt

- **WHEN** ein Benutzer Metadaten, Sichtbarkeit, Zuschnitt, Archivierung oder Löschung eines Assets vorbereitet
- **THEN** zeigt das System die betroffenen Inhalte, Fachobjekte, Rollen und Anzahl der Nutzungen an
- **AND** sicherheitsrelevante oder instanzfremde Nutzungen werden nur entsprechend der Berechtigungen offengelegt

### Requirement: Mandantenfähige Storage- und Auslieferungsgrenze

Das System SHALL Medien mandantenfähig in MinIO als S3-kompatiblem Objektspeicher speichern und öffentliche von geschützten Auslieferungspfaden trennen.

#### Scenario: Geschütztes Medium wird nicht wie ein öffentliches Asset ausgeliefert

- **WHEN** ein Medium als nicht öffentlich markiert ist
- **THEN** liefert das System es nur über einen kontrollierten Zugriffspfad wie signierte URLs oder gleichwertige Freigabemechanismen aus
- **AND** öffentliche Pfade oder Caches exponieren dieses Medium nicht unbegrenzt

#### Scenario: Medien verschiedener Instanzen bleiben getrennt

- **WHEN** Medien verschiedener Instanzen gespeichert oder abgefragt werden
- **THEN** erzwingt das System eine Mandantentrennung im Speicher- und Metadatenmodell
- **AND** organisations- oder instanzfremde Medien werden nicht offengelegt

#### Scenario: MinIO-Speicherartefakte bleiben technische Details

- **WHEN** ein Asset oder eine Variante fachlich referenziert wird
- **THEN** verwenden Fachobjekte stabile Medienreferenzen statt MinIO-Bucket-Namen, Object-Keys oder presigned URLs
- **AND** technische MinIO-Artefakte wie Bucket, Object-Key, ETag, Content-Type und Content-Length bleiben im hostseitigen Storage- und Metadatenmodell gekapselt

#### Scenario: Upload-Schnittstelle ist MinIO-kompatibel

- **WHEN** ein Client einen Upload initialisiert
- **THEN** stellt das System einen kontrollierten MinIO-kompatiblen Upload-Pfad bereit, z. B. über eine kurzlebige signierte URL oder einen serverseitig validierenden Proxy
- **AND** der Upload-Pfad bindet die erwartete Instanz, erlaubte Medienklasse, maximale Größe und erlaubten Content-Type serverseitig
- **AND** der Abschluss des Uploads verifiziert Objektmetadaten aus MinIO, bevor ein `MediaAsset` als nutzbar markiert wird

#### Scenario: Storage-Adapter kapselt das S3-kompatible SDK

- **WHEN** der Host mit MinIO kommuniziert
- **THEN** erfolgt die Kommunikation über einen eigenen Storage-Adapter mit internem Port
- **AND** der Adapter nutzt ein etabliertes S3-kompatibles SDK statt selbst implementierter S3-Protokollsignierung
- **AND** Fachlogik, Content-Modelle, Plugins und UI importieren keine MinIO- oder S3-SDK-Typen

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

### Requirement: Content-Uploads verwenden einen provisorischen Asset-Lebenszyklus

Das System SHALL neu hochgeladene Medien aus einem Content-Speichervorgang bis zum bestätigten Content- und Referenzabschluss als tenant- und actor-gebundene provisorische Assets führen. Provisorische Assets SHALL technisch verarbeitet und kontrolliert ausgeliefert werden können, dürfen aber vor Aktivierung nicht Teil der regulären Medienbibliothek sein.

#### Scenario: Content-Save erzeugt ein provisorisches Asset

- **WHEN** eine lokale Content-Bilddatei innerhalb eines Speichervorgangs hochgeladen und serverseitig validiert wird
- **THEN** ordnet das System das Asset genau einer Content-Media-Save-Operation, Instanz und einem Actor zu
- **AND** bleibt das Asset aus Mediathek, Suche, Picker-Ergebnissen, Pagination und regulären Gesamtzahlen ausgeschlossen
- **AND** darf nur der gebundene Operationspfad Detail, Metadaten, Delivery, Aktivierung oder Abandon ausführen

#### Scenario: Content und Referenzen werden bestätigt abgeschlossen

- **WHEN** der Mainserver-Erfolg mit stabiler Ziel-ID bestätigt ist und der gewünschte Studio-Referenzsatz gespeichert werden kann
- **THEN** ersetzt das System die Referenzen und aktiviert alle verwendeten provisorischen Assets in einer Studio-Datenbanktransaktion
- **AND** entfernt es die provisorische Operationsbindung der aktivierten Assets
- **AND** erscheinen die Assets danach genau einmal regulär in der Medienbibliothek

#### Scenario: Content-Save wird sicher verworfen

- **WHEN** eine Save-Operation vor bestätigtem Mainserver-Erfolg eindeutig fehlschlägt oder kontrolliert abgebrochen wird
- **THEN** wechselt sie idempotent in den Abandon-/Cleanup-Pfad
- **AND** entfernt dieser ausschließlich die von der Operation neu erzeugten provisorischen Assets, Varianten, Upload-Sessions und Storage-Objekte
- **AND** korrigiert er die Storage-Usage ohne bestehende Bibliotheksassets oder Referenzen zu verändern

#### Scenario: Bibliotheksupload wird bewusst gestartet

- **WHEN** ein Benutzer eine Datei im eigenständigen Medienbereich `/admin/media` hochlädt
- **THEN** verwendet das System weiterhin den unmittelbaren Bibliotheks-Asset-Lebenszyklus
- **AND** behandelt es diesen Upload nicht als provisorischen Content-Entwurf
- **AND** verändert ein Abbruch in einem späteren Content-Picker das bereits bewusst angelegte Bibliotheksasset nicht

### Requirement: Content-Media-Save-Operationen sind idempotent und wiederherstellbar

Das System SHALL den Übergang lokaler Content-Dateien zu aktiven Medienassets über einen persistenten, monotonen und idempotenten Operationsvertrag koordinieren.

#### Scenario: Ein Upload- oder Commit-Request wird wiederholt

- **WHEN** ein Client denselben Schritt mit derselben Operations- und Draft-ID nach Timeout oder verlorener Antwort wiederholt
- **THEN** liefert oder erreicht das System denselben fachlichen Zustand
- **AND** erzeugt es weder ein zweites Asset noch doppelte Referenzen oder eine doppelte Quota-Buchung

#### Scenario: Referenzabschluss wird nach Mainserver-Erfolg wiederholt

- **WHEN** eine Operation bereits `content_saved` mit Zieltyp und Ziel-ID erreicht hat, aber noch nicht committed ist
- **THEN** kann das System Reference-Replace und Asset-Aktivierung ohne erneuten Mainserver-Write wiederholen
- **AND** bleibt der vollständige gewünschte Referenzsatz dauerhaft an der Operation verfügbar

#### Scenario: Veraltete Operation ist sicher bereinigbar

- **WHEN** eine abgelaufene Operation nachweislich keinen bestätigten oder unklaren Mainserver-Erfolg besitzt
- **THEN** darf ein lease-basierter Recovery-Lauf sie exklusiv zur Bereinigung übernehmen
- **AND** verarbeitet er konkurrierende Instanzen ohne doppelte Mutation
- **AND** hinterlässt ein partieller Cleanup-Fehler einen wiederholbaren nichtterminalen Zustand

#### Scenario: Operation besitzt einen unklaren oder bestätigten Content-Ausgang

- **WHEN** eine Operation `content_saved`, `outcome_unknown` oder `reconciliation_required` ist
- **THEN** darf ein generischer Ablaufzeit-Cleanup ihre Assets nicht löschen
- **AND** benötigt sie Commit oder evidenzbasierte Reconciliation
- **AND** bleibt sie für Diagnose und Wiederaufnahme anhand sicherer IDs korrelierbar

### Requirement: Provisorischer Cleanup ist keine Benutzerlöschung

Das System SHALL das Verwerfen operationsgebundener provisorischer Assets als interne Kompensation der autorisierten Content-Save-Operation behandeln und von der Löschung aktiver Bibliotheksassets trennen.

#### Scenario: Redakteur besitzt keine Medien-Löschberechtigung

- **WHEN** ein Redakteur Content und neue Medien mit den erforderlichen Content-Rechten sowie `media.create` und `media.reference.manage` speichern darf, aber kein `media.delete` besitzt
- **THEN** darf der Host eindeutig fehlgeschlagene provisorische Assets dieser Operation trotzdem bereinigen
- **AND** darf der Redakteur dadurch keine aktiven oder fremden Assets löschen

#### Scenario: Fremder Actor oder Tenant greift auf Operation zu

- **WHEN** ein Benutzer eine provisorische Operation eines anderen Actors oder einer anderen Instanz laden, committen oder verwerfen möchte
- **THEN** lehnt der Server den Zugriff fail-closed ab
- **AND** offenbart die Antwort keine Storage-Details, signierten URLs oder fremden Dateimetadaten

#### Scenario: Provisorischer Lebenszyklus wird auditiert

- **WHEN** eine Content-Media-Save-Operation gestartet, hochgeladen, committed, verworfen oder reconciliation-pflichtig wird
- **THEN** schreibt das System einen korrelierbaren Audit-/Observability-Eintrag mit Operation, sicherem Zustand und redigiertem Fehlercode
- **AND** protokolliert es keine Binärdaten, lokalen Dateipfade, Blob-/Data-/Object-URLs, signierten Upload-URLs oder Mainserver-Payloads

### Requirement: Asset-Verwendung bleibt vom Asset-Lebenszyklus getrennt

Das System SHALL eine konkrete Content-Verwendung als Referenz auf ein eigenständiges `MediaAsset` behandeln und ihren Mainserver-kompatiblen Metadaten-Snapshot nicht als globalen Asset-Zustand interpretieren.

#### Scenario: Content übernimmt Asset-Metadaten als Startwerte

- **WHEN** ein Asset erstmals mit einem Content verknüpft wird
- **THEN** darf der Content unterstützte globale Metadaten als lokale Startwerte übernehmen
- **AND** bleiben spätere lokale Änderungen auf diese Verwendung begrenzt
- **AND** verändert eine lokale Caption- oder Alt-Text-Änderung nicht das globale Asset

#### Scenario: Content-Verwendung wird entfernt

- **WHEN** eine Content-Verwendung entfernt wird
- **THEN** wird ihre `MediaReference` beim nächsten erfolgreichen Referenz-Replace entfernt
- **AND** bleibt das Asset selbst erhalten

#### Scenario: Asset besitzt aktive Referenzen

- **WHEN** ein Benutzer ein Asset mit aktiven Content-Referenzen löschen möchte
- **THEN** greift die bestehende Nutzungstransparenz und Löschsicherung
- **AND** werden Mainserver-Snapshots nicht als Ersatz für die Studio-Referenzsicherheit behandelt

### Requirement: Cursorbasierte Medienbibliothek

Das System SHALL registrierte Medienassets und nicht registrierte Objekte des tenantgebundenen Buckets über einen gemeinsamen, versionierten Cursor in stabiler binärer S3-Storage-Key-Reihenfolge auflisten, ohne für jede Seite den gesamten Bucket oder eine exakte Gesamtzahl zu laden. Der Cursor SHALL nur Schlüssel überspringen, deren Bereich in beiden Quellen vollständig gelesen wurde. Das Listenlimit SHALL ganzzahlig zwischen 1 und 144 liegen, passend zu den angebotenen Seitengrößen der Oberfläche.

#### Scenario: Benutzer navigiert vorwärts und zurück

- **WHEN** ein berechtigter Benutzer die Medienbibliothek öffnet oder zur nächsten Ergebnismenge navigiert
- **THEN** liefert die API höchstens das angeforderte Limit sowie `nextCursor` und `hasNextPage`
- **AND** verwaltet der Client bereits besuchte Cursor für die Rückwärtsnavigation
- **AND** Änderungen an Suche, Sichtbarkeit oder Limit beginnen wieder beim ersten Cursor

#### Scenario: Registrierte und nicht registrierte Objekte werden zusammengeführt

- **WHEN** DB und Bucket denselben Storage-Key liefern
- **THEN** erscheint genau ein Eintrag in der Medienbibliothek
- **AND** die registrierten Asset-Metadaten sind führend
- **AND** die Reihenfolge ist über wiederholte Cursor-Aufrufe stabil

#### Scenario: Ausgefilterte Objekte am Ende einer begrenzten Bucket-Seite

- **WHEN** eine begrenzte Bucket-Seite überwiegend interne Varianten enthält und ein Datenbank-Asset hinter dem letzten gescannten Bucket-Key liegt
- **THEN** gibt das System das Datenbank-Asset erst aus, nachdem der Bucket bis zu dessen Storage-Key gelesen wurde
- **AND** setzt den Cursor auf einen von beiden Quellen vollständig gelesenen Storage-Key, sodass kein Bucket-Objekt übersprungen wird

#### Scenario: Bucket-Suche bleibt begrenzt

- **WHEN** ein Benutzer nach nicht registrierten Bucket-Objekten sucht
- **THEN** verwendet das System die normalisierte Suche als Storage-Key- oder Ordnerpräfix
- **AND** scannt die Anfrage nicht verpflichtend den gesamten Bucket für beliebige Teilstringtreffer
- **AND** registrierte Assets bleiben weiterhin über ihre Metadaten suchbar

### Requirement: Synchroner Upload besitzt einen atomaren Verarbeitungs-Claim

Das System SHALL genau einen synchronen Abschluss einer Upload-Session zur Verarbeitung zulassen und wiederholte oder konkurrierende Abschlüsse deterministisch behandeln. Jeder Claim SHALL ein eindeutiges Fencing-Token erhalten und Varianten unter claim-isolierten Storage-Keys erzeugen; die Finalisierung SHALL die Session sperren und dieses Token vor Quotenbuchung und Veröffentlichung der Variantenreferenzen prüfen.

#### Scenario: Zwei Requests schließen dieselbe Session ab

- **WHEN** zwei autorisierte Requests gleichzeitig eine `pending` Upload-Session abschließen
- **THEN** darf genau ein Request die Session atomar nach `uploaded` überführen und verarbeiten
- **AND** der andere Request erhält einen eindeutigen In-Verarbeitung-Konflikt
- **AND** Speichernutzung und Asset-Anzahl werden nicht doppelt verbucht

#### Scenario: Ein abgelöster Verarbeiter beendet die Variantenerzeugung verspätet

- **WHEN** ein neuer Claim eine lange laufende Verarbeitung übernimmt
- **AND** der vorherige Verarbeiter anschließend weitere Varianten schreibt
- **THEN** überschreibt er keine Storage-Objekte des neuen Claims
- **AND** seine Finalisierung wird abgewiesen
- **AND** er entfernt ausschließlich seine eigenen unveröffentlichten Varianten

#### Scenario: Abandonment gewinnt gegen die Upload-Finalisierung

- **WHEN** eine Content-Speicheroperation vor der Finalisierung eines provisorischen Uploads nach `abandon_pending` wechselt
- **THEN** veröffentlicht die Finalisierung keine Variantenreferenzen
- **AND** die claim-isolierten Varianten werden kompensierend entfernt

#### Scenario: Variantenspeicher ist vorübergehend nicht verfügbar

- **WHEN** das Schreiben einer claim-isolierten Variante vor der Finalisierung fehlschlägt
- **THEN** entfernt der Verarbeiter seine bereits geschriebenen claim-isolierten Varianten
- **AND** die Upload-Session bleibt nach Ablauf des Claims für einen erneuten Abschluss reclaimbar

#### Scenario: Validierter Abschluss wird wiederholt

- **WHEN** ein Client den Abschluss einer bereits validierten und bereiten Session wiederholt
- **THEN** antwortet das System idempotent mit dem erfolgreichen Ergebnis
- **AND** erzeugt keine weiteren Varianten oder Nutzungsbuchungen

#### Scenario: Unterbrochener Verarbeitungs-Claim wird erneut übernommen

- **GIVEN** eine Upload-Session befindet sich seit mindestens zehn Minuten unverändert im Status `uploaded`
- **AND** die ursprüngliche Upload-Session darf inzwischen abgelaufen sein
- **WHEN** ein autorisierter Client den Abschluss erneut aufruft
- **THEN** übernimmt das System den abgelaufenen Claim atomar und versucht die Verarbeitung erneut
- **AND** entfernt es vor der erneuten Verarbeitung alle Objekte unter dem Variantenpräfix des ersetzten Claims
- **AND** ein jüngerer `uploaded`-Claim bleibt exklusiv und liefert weiterhin einen In-Verarbeitung-Konflikt
- **AND** ein vom neuen Token abgelöster Verarbeiter darf weder Quotenbuchung und Datenbankfinalisierung noch Storage-Cleanup ausführen

### Requirement: Kurze und atomare Upload-Finalisierung

Das System SHALL externe Storage- und Bildverarbeitung außerhalb einer Datenbanktransaktion ausführen und den abschließenden Datenbankzustand anhand der tatsächlichen Objektgrößen atomar persistieren.

#### Scenario: Verarbeitung wird erfolgreich finalisiert

- **WHEN** Original und Varianten vollständig validiert und im Storage geschrieben wurden
- **THEN** prüft eine kurze Datenbanktransaktion das verbleibende Speicherkontingent anhand der tatsächlichen Bytes
- **AND** persistiert Speichernutzung, Varianten, bereites Asset und validierte Session gemeinsam
- **AND** ist kein externer Storage- oder Bildverarbeitungsaufruf innerhalb dieser Transaktion aktiv

#### Scenario: Tatsächliche Größe überschreitet das Kontingent

- **WHEN** die tatsächliche Original- und Variantengröße das verbleibende Kontingent überschreitet
- **THEN** wird keine teilweise erfolgreiche Datenbankfinalisierung sichtbar
- **AND** antwortet das System mit `storage_quota_exceeded`
- **AND** entfernt es Original und erzeugte Varianten bestmöglich aus dem Storage

### Requirement: Extern isolierter Tenant-Bucket

Das System SHALL den operativ garantierten Vertrag verwenden, dass jeder Tenant genau einen isolierten Bucket besitzt und ein Medienrequest keinen anderen Bucket auswählen kann.

#### Scenario: Storage-Key enthält ein tenantähnliches Präfix

- **WHEN** ein Storage-Key innerhalb des tenantgebundenen Buckets ein Präfix enthält, das wie eine andere Instanzkennung aussieht
- **THEN** wird er nicht allein anhand dieses Präfixes als fremdmandantig abgelehnt
- **AND** bleiben echte Domänenverbote wie interne Variantenpfade weiterhin wirksam
- **AND** wird Mandantentrennung durch Bucket-Auflösung und IAM-Scope erzwungen

### Requirement: Direkter Single-File-Upload aus der Medienbibliothek

Das System SHALL im hostseitigen Einstieg `/admin/media` für berechtigte Benutzer einen direkten Upload-Flow für genau eine Datei bereitstellen, der Dateiauswahl, kontrollierten Browser-Upload und anschließende Finalisierung als zusammenhängenden Redaktionspfad führt.

#### Scenario: Benutzer startet einen direkten Upload aus der Bibliothek

- **WHEN** ein berechtigter Benutzer im hostseitigen Einstieg `/admin/media` eine einzelne Datei auswählt
- **THEN** initialisiert das System einen kontrollierten Upload-Pfad für genau diese Datei
- **AND** führt den eigentlichen Datei-Transfer an den freigegebenen MinIO-/S3-kompatiblen Zielpfad aus, ohne dem Benutzer primär technische Upload-Artefakte als Endschritt zu präsentieren
- **AND** behandelt der Flow Dateiauswahl, Upload und Finalisierung als zusammenhängende Enduser-Aktion

#### Scenario: Benutzer wird nach erfolgreichem Upload in das Asset gefuehrt

- **WHEN** der Datei-Upload erfolgreich abgeschlossen und das Medienobjekt finalisiert wurde
- **THEN** leitet das System den Benutzer direkt in die Detailansicht des neu entstandenen `MediaAsset` weiter
- **AND** zeigt nicht nur die signierte Upload-URL oder Upload-Session als primaeren Erfolgsausgang

### Requirement: Upload-first-Minimalpersistenz für neue Assets

Das System SHALL nach erfolgreichem Single-File-Upload ein neues `MediaAsset` mit Minimalmetadaten persistieren können, ohne vor dem Upload redaktionelle Pflichtmetadaten zu erzwingen.

#### Scenario: Asset wird mit Minimaldaten finalisiert

- **WHEN** eine einzelne Datei erfolgreich hochgeladen und serverseitig verifiziert wurde
- **THEN** persistiert das System mindestens `storageKey`, `fileName`, `mimeType`, `byteSize`, `visibility` und eine stabile Asset-Identität für das neue `MediaAsset`
- **AND** darf das System einen initialen Titel aus dem Dateinamen ableiten
- **AND** bleiben weitergehende redaktionelle Metadaten wie Alt-Text oder Beschreibung für spätere Pflege nachgelagert

#### Scenario: Upload wird nicht durch fehlende Metadaten blockiert

- **WHEN** ein Benutzer vor dem Upload noch keine redaktionellen Metadaten gepflegt hat
- **THEN** darf das System den Single-File-Upload trotzdem ausführen
- **AND** erzeugt nach erfolgreichem Upload ein minimal nutzbares `MediaAsset`
- **AND** verlagert die nachträgliche Metadatenpflege in den Detail-Workspace oder einen gleichwertigen Nachbearbeitungspfad

### Requirement: Getrennte Fehlerpfade für Initialisierung, Upload und Finalisierung

Das System SHALL im direkten Single-File-Upload-Flow Fehler von Upload-Initialisierung, Datei-Transfer und Asset-Finalisierung getrennt behandeln und für berechtigte Benutzer nachvollziehbar ausweisen.

#### Scenario: Initialisierung oder Finalisierung scheitert getrennt vom Datei-Upload

- **WHEN** der Upload-Pfad nicht initialisiert werden kann oder die Persistierung des `MediaAsset` nach erfolgreichem Datei-Transfer fehlschlägt
- **THEN** weist das System den jeweiligen Fehlerpfad explizit getrennt aus
- **AND** markiert den Gesamtflow nicht stillschweigend als erfolgreich
- **AND** offenbart die Fehlermeldung keine Secrets, signierten URLs oder anderen sensitiven Storage-Details

#### Scenario: Datei-Transfer scheitert vor Finalisierung

- **WHEN** der Browser-Upload an den kontrollierten Zielpfad fehlschlägt
- **THEN** finalisiert das System kein nutzbares `MediaAsset` als erfolgreichen Abschluss
- **AND** bleibt für den Benutzer sichtbar, dass der Fehler im eigentlichen Datei-Upload und nicht in der Metadatenpflege liegt
