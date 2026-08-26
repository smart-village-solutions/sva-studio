# Design: Verbleibende Medien-Governance

## Kontext

Das Medienmanagement besitzt bereits ein kanonisches Asset-/Varianten-/Referenzmodell, globale redaktionelle Basis-Metadaten, einen validierten Upload-Pfad und harte instanzbezogene Speicherquoten. Der Change erweitert diese Basis gezielt um weiterhin offene Governance-Funktionen.

Die Erweiterung besteht aus zwei fachlichen Bereichen:

- redaktionelle Auffindbarkeit und globale Mehrsprachigkeit
- Betriebssicherheit beim Anlegen, Prüfen und Austauschen von Assets

Diese Bereiche bleiben in einem Change, erhalten aber getrennte Verträge und Arbeitspakete. So entsteht keine implizite Kopplung zwischen Taxonomie und Upload-Sicherheit.

## Ziele

- globale Asset-Metadaten in unterstützten Instanzsprachen pflegbar und deterministisch lesbar machen
- Medien durch Ordner, Tags und kontrollierte Kategorien auffindbar machen
- identische Uploads innerhalb einer Instanz früh erkennen
- ein Original austauschen, ohne Asset-Identität oder bestehende Referenzen zu brechen
- ungeprüfte oder gefährliche Dateien nicht zur Nutzung freigeben
- berechtigte Benutzer rechtzeitig vor Erreichen der harten Speicherquote warnen
- sicherheits- und governance-relevante Entscheidungen revisionssicher auditieren

## Nicht-Ziele

- bestehende Felder für Copyright oder Lizenz neu modellieren
- Pflichtfeldregeln für Copyright oder Lizenz ohne abgestimmten fachlichen Anwendungsfall einführen
- harte Speicherquoten neu implementieren
- rollenbezogene Upload-Raten oder rollenabhängige Dateigrößen einführen
- eine eigene Queue-, Worker-, Retry- oder Dead-Letter-Plattform schaffen
- Zugriffsrechte aus Ordnern, Tags oder Kategorien ableiten
- globale Asset-Metadaten als Ersatz für verwendungsspezifische Angaben an `MediaReference` definieren

## Entscheidungen

### 1. Mehrsprachigkeit erweitert globale Asset-Metadaten

Titel, Beschreibung und globaler Alt-Text können je unterstützter Instanzsprache gespeichert werden. Die Instanz definiert eine Standardsprache und eine geordnete Fallback-Regel. APIs liefern neben dem aufgelösten Wert auch die tatsächlich verwendete Sprache, damit die UI einen Fallback kenntlich machen kann.

Copyright, Lizenz und technische Metadaten bleiben sprachunabhängig, solange kein konkreter fachlicher Bedarf für lokalisierte Rechteangaben beschlossen wird. Verwendungsbezogene Alternativtexte oder Bildaussagen können weiterhin an einer konkreten `MediaReference` liegen und werden nicht durch den globalen Alt-Text überschrieben.

### 2. Ordner, Tags und Kategorien haben getrennte Semantik

- Ein Asset kann optional genau einem hierarchischen Ordner zugeordnet werden.
- Tags sind instanzlokale, normalisierte redaktionelle Suchbegriffe und können mehrfach vergeben werden.
- Kategorien stammen aus einer instanzlokal kontrollierten Wertemenge und können mehrfach vergeben werden.

Alle drei Dimensionen unterstützen serverseitige Suche und Filterung. Umbenennen, Verschieben oder Entfernen verändert weder die Asset-Identität noch seine fachlichen Referenzen. Keine Dimension erweitert den sichtbaren Instanz- oder Berechtigungsscope.

### 3. Duplikaterkennung ist instanzlokal und entscheidungsorientiert

Nach erfolgreicher Inhaltsvalidierung wird ein kryptografisch geeigneter Hash des tatsächlichen Dateiinhalts gebildet. Treffer werden ausschließlich innerhalb derselben Instanz gesucht. Die API liefert eine kontrollierte Entscheidung: vorhandenes Asset wiederverwenden, Upload mit ausdrücklich bestätigtem Duplikat fortsetzen oder Upload abbrechen.

Die Wiederverwendung erzeugt kein zweites Storage-Objekt. Ein bewusst angelegtes Duplikat bleibt ein eigenständiges Asset. Welche Entscheidung zulässig ist, wird serverseitig anhand der bestehenden Medienberechtigungen geprüft; Hashes und instanzfremde Treffer werden nicht offengelegt.

### 4. Replace verwendet einen versionierten, fail-closed Übergang

Ein Replace erzeugt zunächst eine neue interne Originalversion desselben `MediaAsset`. Die bisher aktive Version und alle bestehenden `MediaReference`-IDs bleiben unverändert nutzbar, bis Validierung, Malware-Prüfung und erforderliche Varianten der neuen Version erfolgreich abgeschlossen sind.

Erst danach wird die neue Version atomar aktiv. Bei Fehlern bleibt die bisherige Version führend. Veraltete Varianten werden nicht unter unveränderten technischen Cache-Identitäten weiterverwendet.

Jede Instanz besitzt verbindliche Retention-Regeln für abgelöste und fehlgeschlagene Originalversionen. Beim Übergang in einen inaktiven oder fehlgeschlagenen Zustand berechnet der Server einen unveränderlichen Bereinigungszeitpunkt. Nach dessen Ablauf entfernt ein idempotenter Cleanup die Version und alle ausschließlich daraus abgeleiteten Varianten, sofern keine dokumentierte Aufbewahrungssperre besteht. Bis die physische Löschung bestätigt ist, zählen sämtliche gespeicherten Bytes weiterhin vollständig zur harten Speicherquote; ein fehlgeschlagener Cleanup reduziert die Nutzung nicht und wird über die kanonische Processing-Infrastruktur erneut ausgeführt.

### 5. Malware-Prüfung ist ein produktneutraler Freigabevertrag

Der Medienkern spricht einen internen Scanner-Port an und kennt kein konkretes Scannerprodukt. Ein Asset oder eine neue Replace-Version wird erst nutzbar, wenn das Ergebnis `clean` vorliegt. Ergebnisse wie `infected`, `scan_failed`, `unavailable` oder `unknown` bleiben fail-closed und geben keine Scanner-Interna an Benutzer aus.

Dieser Change definiert Scan-Auftrag, Ergebnis und Freigabewirkung. Wenn der Scan asynchron ausgeführt wird, nutzt er die von `add-media-async-processing` bereitgestellte Job-, Retry- und Betriebsinfrastruktur; er führt keine parallele Orchestrierung ein.

### 6. Quota-Warnungen ergänzen, aber verändern die harte Grenze nicht

Eine Instanz kann mindestens eine Warnschwelle unterhalb ihrer harten Speicherquote konfigurieren. Bei Erreichen sehen berechtigte Benutzer die aktuelle Nutzung, die harte Grenze und die erreichte Warnstufe. Warnungen blockieren keinen Upload; die vorhandene atomare Prüfung der harten Quote bleibt autoritativ.

Warnungen werden aus der serverseitig ermittelten Nutzung abgeleitet. Clients dürfen weder Nutzungswerte noch Warnstatus als Entscheidungsquelle vorgeben.

### 7. Audit-Ereignisse bilden Entscheidungen statt sensitive Rohdaten ab

Audit-Ereignisse erfassen Aktion, Ergebnis, Instanz, pseudonymisierten Actor, Zielreferenz, Reason-Code sowie Request-/Trace-Korrelation. Auditiert werden mindestens Duplikatentscheidungen, Scan-Ergebnisse, Replace-Übergänge, Änderungen an lokalisierten Metadaten und Taxonomie sowie Quota-Warnschwellen.

Dateiinhalte, rohe Hashes, Scanner-Interna, Storage-Keys, Secrets und Klartext-PII gehören weder in Audit-Ereignisse noch in operative Logs.

## Fehler- und Übergangsverhalten

- Fehlende Übersetzungen lösen den dokumentierten Fallback aus und werden in der UI erkennbar dargestellt.
- Ungültige oder entfernte Taxonomiewerte werden serverseitig abgewiesen; bestehende Zuordnungen werden bei Taxonomieänderungen kontrolliert migriert oder entfernt.
- Ein Hash-Treffer legt nur Assets offen, die der Benutzer innerhalb derselben Instanz lesen darf.
- Scan- oder Processing-Fehler lassen neue Uploads unreferenzierbar und Replace-Vorgänge auf der bisherigen aktiven Version.
- Inaktive und fehlgeschlagene Originalversionen bleiben bis zur bestätigten physischen Löschung quotenwirksam; Cleanup-Fehler verändern die abgerechnete Nutzung nicht.
- Quota-Warnungen bleiben informativ; erst die bestehende harte Quota blockiert atomar.

## Abnahme

Die Umsetzung ist abnahmefähig, wenn die einzelnen Verträge durch Unit- und Integrationstests belegt sind, Mandantentrennung und Fail-closed-Verhalten nachgewiesen sind und die Benutzer- sowie Betriebsdokumentation den neuen Lebenszyklus beschreibt.
