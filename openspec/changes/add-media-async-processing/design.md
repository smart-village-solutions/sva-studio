# Design: Bestehende Bildverarbeitung im Studio-Job

## Ablauf

Die bestehende Verarbeitung aus `packages/auth-runtime/src/iam-media/processing.ts` läuft über einen hosteigenen Studio-Job. Graphile Worker ist vorhanden; eine neue Infrastruktur oder ein eigener Worker-Dienst ist nicht erforderlich.

1. Der Browser überträgt die Datei wie bisher direkt an den Storage.
2. Der Upload-Abschluss plant den Job dauerhaft ein und bestätigt dessen Annahme. Das Medium ist damit noch nicht validiert oder nutzbar. Bei fehlgeschlagener Einplanung wird kein Erfolg bestätigt; ein erneuter Abschluss darf keinen zweiten aktiven Auftrag erzeugen.
3. Der Job führt die bestehende Inhaltsvalidierung, Metadatenextraktion und Standard-Variantengenerierung aus. Die vorhandene kurze Finalisierung prüft Claim und Quote vor der Veröffentlichung als `ready`.
4. UI und SDK warten über begrenzte Statusabfragen am vorhandenen Asset-Lesepfad auf `ready` oder einen Fehler. Ein Timeout bestätigt keinen Upload-Erfolg und startet keine zweite Verarbeitung; der aktuelle Zustand bleibt über denselben Lesepfad abrufbar.
5. Erst bei `ready` endet der Upload-Ablauf erfolgreich. Beim Content-Speichern folgen erst dann Delivery-Auflösung, Content-Persistenz und Referenzabschluss. Unfertige Medien bleiben für neue Verwendungen und fachliche Auslieferung gesperrt.

Der synchrone Aufruf der Variantengenerierung im Upload-Request entfällt. Die vorhandene Verarbeitungslogik wird weiterverwendet; es gibt keinen alternativen Sofortpfad für kleine Dateien.

## Zeitüberschreitung beim Warten

- **Medienbibliothek:** Nur das Warten der Oberfläche endet. Der angenommene Job läuft weiter; das Medium bleibt als „in Verarbeitung“ sichtbar, bis der vorhandene Lesepfad `ready` oder einen Fehler meldet. Es wird kein zweiter Job gestartet.
- **Content-Speichern:** Der Speicherversuch endet vor der Content-Persistenz mit einer verständlichen Fehlermeldung. Die Formulareingaben bleiben erhalten. Die provisorischen Uploads dieses Versuchs werden über den vorhandenen Abbruch-/Recovery-Pfad bereinigt; bestehende Bibliotheksmedien und Referenzen bleiben erhalten. Eine automatische Wiederaufnahme dieses Speichervorgangs wird nicht eingeführt.

Die Annahme speichert Upload-Claim, Job und Enqueue in derselben kurzen Datenbanktransaktion. Ein bei der Annahme abgelöster alter Claim bleibt mit seinem Token im Job erhalten, damit dessen Varianten ebenfalls über die vorhandene Bereinigung entfernt werden. Die Upload-Session-ID dient als stabile Job-ID; wiederholte Abschlussaufrufe lesen diesen Auftrag. Der Worker erneuert den Claim für jeden Versuch, sodass ein überholter Versuch seine Varianten weder veröffentlichen noch fremde Varianten bereinigen kann. Storage- und Bildoperationen laufen weiterhin außerhalb der Transaktion.

## Erhaltene Garantien

- Medienjobs nutzen die vorhandenen Studio-Job-Status, technischen Wiederholungsversuche und redigierten Betriebsdiagnosen. Terminale Jobs werden nur über den bestehenden expliziten Wiederanstoß erneut ausgeführt.
- Wiederholte Abschlüsse und Job-Ausführungen erzeugen keine doppelte Veröffentlichung oder Quotenbuchung. Claim-Token und claim-isolierte Varianten bleiben maßgeblich.
- Ein abgebrochener provisorischer Content-Speichervorgang darf durch einen verspäteten Job nicht aktiviert werden. Seine Bereinigung bleibt im vorhandenen Recovery-Pfad.
- Die bestehende Quotenprüfung bleibt vor `ready` verbindlich. Quotenüberschreitungen und Verarbeitungsfehler verwenden die vorhandenen Fehler- und Bereinigungspfade.

## Abgrenzung

Dieser Change baut ausschließlich den Standard-Variantenpfad um. Scan, Replace und Retention erhalten hier keine vorgezogenen Verträge oder Erweiterungspunkte. Spätere fachliche Jobs verwenden ebenfalls die vorhandene Studio-Job-Fähigkeit; sie benötigen keine zusätzliche Medienjob-Plattform. Die bestehende Regel für seltene, bedarfsgesteuerte Varianten wird nicht erweitert.
