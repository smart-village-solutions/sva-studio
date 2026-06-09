# Waste-Mainserver-Sync-Job Design

## Kontext

Im Waste-Management-Plugin sollen Fraktionsänderungen nicht nur lokal im Studio gespeichert werden, sondern zusätzlich ein für die App relevantes JSON-Artefakt `wasteTypes` auf den hinterlegten Mainserver schreiben. Dieses JSON soll aus dem bestehenden Fraktionsbestand generiert werden und weiterhin abwärtskompatibel bleiben, indem bestehende Basiseigenschaften erhalten und um zusätzliche Felder ergänzt werden.

Die Synchronisation darf lokale Fraktionsänderungen nicht blockieren. Ein Fehler beim Mainserver-Update soll deshalb den Fraktionsspeicherpfad nicht rückabwickeln. Gleichzeitig muss es einen nachvollziehbaren und erneut ausführbaren technischen Pfad für die Synchronisation geben.

## Ziele

- Fraktionsänderungen triggern immer eine Synchronisation des vollständigen `wasteTypes`-Artefakts.
- Die Synchronisation ist vom CRUD-Pfad entkoppelt und läuft als eigener Waste-Job.
- Ein fehlgeschlagener Mainserver-Sync macht lokale Fraktionsänderungen nicht rückgängig.
- Nutzer können den Sync gezielt erneut anstoßen.
- Die Lösung bleibt auf den konkreten Fall `wasteTypes` fokussiert und generalisiert nicht vorzeitig.

## Nicht-Ziele

- Kein generischer plattformweiter Static-Content-Sync für beliebige Plugins.
- Kein Ausbau des internen Fraktionsfachmodells.
- Keine Delta-Synchronisation einzelner Fraktionen; exportiert wird immer der vollständige Zielzustand.
- Kein transaktionales Zwei-Phasen-Commit zwischen Waste-Datenbank und Mainserver.

## Bestehender Stand

- Fraktionen werden heute direkt über die Waste-Master-Data-Submissions gespeichert.
- Das Waste-Plugin verfügt bereits über eine bestehende Job-/History-Infrastruktur in den Datentools.
- Die Mainserver-Integration besitzt bereits OAuth-, GraphQL- und Fehlerbehandlungsbausteine.
- Das App-JSON soll auf dem bestehenden Kürzel als Key basieren; das zugrunde liegende Fraktionsmodell bleibt unverändert.

## Bewertete Ansätze

### Ansatz A: Direkter Mainserver-Sync im Fraktions-Save

Nach erfolgreichem Fraktionsspeichern würde direkt die Mainserver-Mutation ausgeführt.

Vorteile:
- wenig zusätzliche Infrastruktur
- unmittelbare Rückmeldung im Save-Flow

Nachteile:
- stärkere Kopplung zwischen CRUD und externer Systemintegration
- Retry müsste im UI separat nachgebildet werden
- schlechtere technische Nachvollziehbarkeit in bestehender Job-History

### Ansatz B: Dedizierter Waste-Job `waste-management.sync-waste-types`

Nach jeder relevanten Fraktionsänderung wird ein spezifischer Job eingeplant, der das vollständige `wasteTypes`-JSON erzeugt und auf den Mainserver schreibt.

Vorteile:
- entkoppelt den lokalen Speicherpfad vom externen Sync
- nutzt vorhandene Waste-Job-Infrastruktur
- natürlicher Retry-Pfad über denselben Jobtyp
- gute Sichtbarkeit über History/Job-Details

Nachteile:
- zusätzlicher technischer Pfad im Plugin
- Erfolg des lokalen Speicherns und Erfolg des externen Syncs fallen zeitlich auseinander

### Ansatz C: Generischer Static-Content-Sync-Job

Ein allgemeiner Jobtyp würde beliebige Mainserver-Static-Contents synchronisieren.

Vorteile:
- perspektivisch wiederverwendbar

Nachteile:
- aktuell unnötige Vorab-Generaliserung
- mehr Abstraktion ohne konkreten zweiten Anwendungsfall

## Entscheidung

Es wird Ansatz B umgesetzt: ein dedizierter Jobtyp `waste-management.sync-waste-types`.

Diese Entscheidung hält den Scope bewusst eng. Sie erfüllt die Anforderungen an Entkopplung, Retry und Nachvollziehbarkeit, ohne einen generischen Exportbaukasten einzuführen, dessen zukünftige Anforderungen noch nicht belastbar bekannt sind.

## Zielbild

### 1. Trigger

Der Job wird immer nach erfolgreicher lokaler Fraktionsänderung angestoßen:

- Anlegen einer Fraktion
- Bearbeiten einer Fraktion
- Löschen einer Fraktion
- Statuswechsel aktiv/inaktiv

Der Trigger erfolgt erst nach erfolgreicher lokaler Mutation. Ein Trigger- oder Mainserver-Fehler blockiert den Abschluss der lokalen Mutation nicht.

### 2. Job-Semantik

Der Job arbeitet immer mit einem vollständigen Snapshot des aktuellen Fraktionsbestands.

Ablauf:

1. aktuellen Fraktionsbestand laden
2. Exportmodell `wasteTypes` daraus vollständig neu generieren
3. `version` deterministisch aus dem JSON-Inhalt ableiten
4. Mainserver-Mutation `createOrUpdateStaticContent` ausführen
5. strukturiertes Job-Ergebnis und technische Details zurückgeben

Wichtig:

- Es werden keine partiellen Deltas einzelner Fraktionen synchronisiert.
- Wiederholtes Ausführen desselben Jobs bleibt fachlich idempotent, weil immer der vollständige Zielzustand geschrieben wird.

### 3. Exportmodell `wasteTypes`

Das bestehende App-JSON bleibt in seiner Grundstruktur erhalten: eine Map mit Kürzeln als Keys.

Beispielhaft:

```json
{
  "BIO": {
    "label": "Biotonne auf Abruf",
    "color": "#8B4513",
    "selected_color": "#8B4513",
    "icon": "https://fileserver.smart-village.app/foobar.png",
    "id": "fraction-bio",
    "short_label": "BIO",
    "active": true,
    "description": "Nur auf Abruf",
    "container_size": null,
    "reminders": {
      "reminder_count": "none",
      "first_reminder_max_lead_days": null,
      "second_reminder_max_lead_days": null,
      "channels": {
        "push": false,
        "email": false,
        "calendar": false
      }
    },
    "translations": {
      "de": "Biotonne auf Abruf"
    }
  }
}
```

Leitlinien:

- JSON-Key basiert direkt auf dem gepflegten Kürzel und wird kanonisch in Großbuchstaben exportiert.
- Das interne Fraktionsmodell wird dafür nicht erweitert.
- Bestehende Pflichtfelder bleiben erhalten.
- Das vorhandene Erinnerungsmodell wird ergänzend als strukturierter Block `reminders` exportiert.
- Die Kanalfreigaben gelten auf Fraktionsebene und werden daher gemeinsam unter `reminders.channels` ausgegeben.

### 4. Versionierung

Die Mainserver-Mutation schreibt `version` bewusst als leeren String.

Begründung:

- Das Mainserver-Schema erwartet für diesen Anwendungsfall kein fachliches Versionskonzept.
- Der zwischen Studio und Mainserver abgestimmte Write-Pfad arbeitet mit leerem `version`-Feld.
- Retries bleiben damit kompatibel zum aktuell erwarteten Mainserver-Verhalten.

### 5. Mainserver-Aufruf

Die Jobausführung liest zuerst die vorhandene Datei-ID und schreibt das Exportartefakt anschließend mit dieser ID erneut:

```graphql
query {
  publicJsonFile(
    name: "wastetypes"
  ) {
    id
  }
}

mutation {
  createOrUpdateStaticContent(
    name: "wastetypes"
    id: "1707"
    content: "{...}"
    dataType: "json"
    version: ""
  ) {
    id
  }
}
```

Die Mainserver-Kommunikation nutzt die bestehende OAuth-/GraphQL-Infrastruktur der SVA-Mainserver-Integration. Für `wasteTypes` wird ein schlanker dedizierter Operationspfad ergänzt, statt die News-/Events-/POI-Routen zu missbrauchen.

## Architektur und Bausteine

### Waste-Plugin

- ergänzt einen neuen Jobtyp `waste-management.sync-waste-types`
- startet diesen Job nach jeder erfolgreichen Fraktionsmutation
- bietet im Fraktionskontext einen manuellen Retry-Button

### Job-Handler

- lädt den aktuellen Fraktionsbestand
- mappt die Exportstruktur
- berechnet die Inhaltsversion
- ruft den Mainserver-Write-Pfad auf
- liefert ein technisches Ergebnis für History und UI

### Mainserver-Integration

- ergänzt eine fokussierte Operation zum Schreiben von `StaticContent`
- nutzt vorhandene Auth-, Config- und GraphQL-Bausteine
- kapselt Mainserver-spezifische Fehlercodes sauber

## UI-Verhalten

### Erfolgsfall

- lokale Fraktionsänderung bleibt wie bisher erfolgreich
- Job wird gestartet
- UI darf darauf hinweisen, dass die Mainserver-Synchronisation eingeplant wurde

### Fehlerfall beim Jobstart oder Joblauf

- lokale Fraktionsänderung bleibt bestehen
- Nutzer erhalten eine Warnung, dass `wasteTypes` nicht synchronisiert werden konnte
- im Fraktionsbereich steht ein Button `Erneut versuchen` zur Verfügung
- der Button startet denselben Jobtyp erneut

### Sichtbarkeit

- der Sync-Lauf erscheint zusätzlich in den Waste-Datentools bzw. der technischen History
- der Fraktionsbereich zeigt den Retry-Pfad dort an, wo die Nutzer die fachliche Änderung gerade vorgenommen haben

## Fehlerbehandlung

Fehlerklassen:

- Mainserver-Konfiguration fehlt oder ist ungültig
- Credentials fehlen
- Tokenabruf schlägt fehl
- GraphQL-Aufruf schlägt fehl
- Mainserver liefert fachlichen Fehler oder ungültige Antwort
- Exportgenerierung schlägt an Kürzelkonflikten oder ungültigen Daten fehl

Fehlergrundsätze:

- lokale Mutation bleibt erfolgreich, wenn der nachgelagerte Sync fehlschlägt
- technische Fehler werden im Job protokolliert und in der History sichtbar gemacht
- UI bekommt eine verständliche Warnmeldung plus Retry-Pfad

## Datenkonsistenz

Da der Job immer den vollständigen aktuellen Fraktionsbestand exportiert, wird die Zielrepräsentation bei jedem erfolgreichen Lauf vollständig überschrieben. Dadurch bleiben `delete` und `Statuswechsel` konsistent, ohne dass ältere Artefakte manuell bereinigt werden müssen.

## Teststrategie

### Unit-Tests

- Export-Mapping von Fraktionen zu `wasteTypes`
- Kürzelnormalisierung und Konflikterkennung
- deterministische Versionsbildung
- Job-Handler-Ergebnisse für Erfolg und Fehler

### Integrationsnahe Tests

- Jobtyp-Registrierung und Handler-Verdrahtung
- Mainserver-Operation mit gemocktem GraphQL-Client
- Trigger nach `create`, `update`, `delete` und `Statuswechsel`

### UI-Tests

- Fraktionsänderung bleibt erfolgreich trotz fehlgeschlagenem Sync
- Warnmeldung und Retry-Button werden angezeigt
- Retry stößt den Job erneut an

### History-/Operations-Tests

- neuer Jobtyp erscheint korrekt in Waste-Datentools
- Status und technische Details werden erwartbar angezeigt

## Risiken und Trade-offs

- Nutzer sehen unter Umständen kurzzeitig einen lokal aktuelleren Stand als im Mainserver-Artefakt.
  - Mitigation: klarer Retry-Pfad und technische History

- Mehrere schnelle Fraktionsänderungen können mehrere Jobs erzeugen.
  - Mitigation: vollständiger Snapshot pro Job hält das Endergebnis fachlich korrekt

- Kürzelkonflikte werden jetzt exportkritisch.
  - Mitigation: Konflikte fail-closed behandeln und im Job klar ausweisen

## Offene Umsetzungsleitlinie

Die Lösung bleibt absichtlich konkret auf `wasteTypes` fokussiert. Falls später weitere Mainserver-Artefakte aus Waste synchronisiert werden sollen, kann aus dem dedizierten Jobtyp ein allgemeineres Muster abgeleitet werden. Diese Generalisierung ist jedoch nicht Teil dieses Designs.
