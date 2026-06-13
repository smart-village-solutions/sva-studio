# Design: Erinnerungs-Konfiguration pro Abfallfraktion

## Kontext
Im Waste-Management sollen Abfallfraktionen eine fachliche Konfiguration für spätere Abhol-Erinnerungen erhalten. Die eigentliche Zustellung von Push-, E-Mail- oder Kalender-Benachrichtigungen wird an anderer Stelle umgesetzt. Dieser Change schafft ausschließlich den administrativen Vertrag, mit dem pro Fraktion steuerbar ist, ob keine, eine oder zwei Erinnerungen angeboten werden und welche Maximalwerte sowie Kanäle dafür gelten.

Die Konfiguration soll direkt an der Abfallfraktion hängen, nicht in globalen Waste-Einstellungen. Dadurch bleibt die spätere Nutzeroberfläche fachnah: Bürger wählen ihre Erinnerungspräferenzen immer im Rahmen einer konkreten Fraktion, und die Host-Fassade kann die fachliche Freigabe ohne zusätzlichen Join auf eine getrennte Reminder-Entität lesen.

## Ziele
- Abfallfraktionen um eine typsichere Reminder-Konfiguration erweitern.
- Die Konfiguration konsistent in Core-Typen, Repository, Host-Fassade, Static Content und Plugin-UI abbilden.
- Serverseitig nur gültige Kombinationen persistieren und inkonsistente Eingaben normalisieren.
- Die UI so aufbauen, dass die spätere Zustelllogik dieselben kanalbezogenen Slot-IDs ohne Datenmigration verwenden kann.

## Nicht-Ziele
- Keine eigentliche Zustelllogik für Push, E-Mail oder Kalender.
- Keine nutzerbezogenen Vorlaufzeiten oder Opt-ins.
- Keine Reihenfolgenvalidierung zwischen erster und zweiter Erinnerung.
- Keine globale Reminder-Konfiguration außerhalb der Abfallfraktion.

## Entscheidungen

### 1. `reminder_config` ist die fachlich führende Persistenz an `waste_fractions`
Die Reminder-Konfiguration wird als JSONB-Struktur direkt an der Fraktion gespeichert. Das JSON-Schema folgt dem vorgegebenen Fachmodell:
- `channels.push|email|calendar`
- optionale Channel-Blöcke `push`, `email`, `calendar`
- je Channel eine `slots`-Liste mit `id`, `max_lead_days` und `default_lead_days`

Eine separate relationale Slot-Tabelle wäre fachlich ebenfalls tragfähig, würde für den aktuellen Scope aber zusätzliche Join- und Migrationskomplexität erzeugen. Eine reine Mehrspaltenlösung an `waste_fractions` würde das Zielmodell unnötig hart an die aktuelle Slot-Anzahl koppeln.

### 2. Zählmodell statt freier Anzahl
Die Anzahl möglicher Erinnerungen wird als Enum `none | once | twice` modelliert. Das ist für UI, API-Schema und Persistenz klarer als eine freie numerische Anzahl und verhindert ungültige Werte außerhalb des fachlichen Scopes.

### 3. Kanalfreigaben gelten global pro Fraktion, Slots aber kanalbezogen
Push, E-Mail und Kalender werden weiterhin global pro Fraktion aktiviert. Zusätzlich erhält jeder aktivierte Channel einen eigenen Slot-Block. Dadurch bleibt die globale Freigabe explizit, während gleichzeitig kanalabhängige Lead-Day-Grenzen und UI-Defaults möglich werden.

### 4. Server normalisiert nicht relevante Channel- und Slot-Daten
Die Host-Fassade behandelt den Request tolerant, persistiert aber nur den kanonischen Zustand:
- bei `none`: keine Channel-Blöcke, alle Kanäle `false`
- bei `once`: pro aktivem Channel genau ein Slot
- bei `twice`: pro aktivem Channel genau zwei Slots

Damit bleiben spätere Altlasten oder manuelle Requests ohne inkonsistente Daten im System, obwohl das JSON-Schema flexibler ist als das bisherige Flachmodell.

### 5. Slot-IDs werden persistent stabil geführt
Die spätere Geräte-Persistenz für nutzerbezogene Reminder-Einstellungen braucht einen stabilen Identifikator pro fachlichem Slot. Deshalb erzeugt die Migration deterministische IDs im Format `<fraction-id>:<channel>:first|second`, und Folgeänderungen behandeln bestehende IDs als persistenten Bestandteil der Daten.

### 6. Keine Ordnungsregel zwischen erster und zweiter Erinnerung
Die Maximalwerte bleiben unabhängig. Eine Regel wie "erste Erinnerung muss größer als zweite Erinnerung sein" wird bewusst nicht eingeführt. Nutzer konfigurieren später ihre konkreten Vorlaufzeiten selbst innerhalb dieser Grenzen.

### 7. Das bisherige Flachmodell wird in die JSON-Source-of-Truth backfilled
Bestehende Spalten `reminder_count`, `first_reminder_max_lead_days`, `second_reminder_max_lead_days` und `reminder_channel_*` bleiben zunächst als Migrationsquelle erhalten. Beim Schema-Upgrade wird daraus deterministisch `reminder_config` aufgebaut. Für migrierte Bestandsdaten wird `default_lead_days` konservativ auf `1` gesetzt, solange bislang kein eigener Default persistiert wurde.

## UI-Entwurf
In der Fraktionen-Listenansicht wird die Reminder-Konfiguration bewusst nicht als zusätzliche Tabellenspalte, Badge-Gruppe oder Inline-Aktion gezeigt. Die bestehende Tabellenansicht bleibt auf die bisherigen Kerninformationen der Fraktion fokussiert.

Im Fraktionsdialog entsteht stattdessen ein eigener vierter Block "Erinnerungen". Er folgt auf die bestehenden drei Blöcke des Create-/Edit-Views und bündelt die neue Fachkonfiguration vollständig an einer Stelle. Der Block enthält:
- Auswahl `Keine`, `Eine Erinnerung`, `Zwei Erinnerungen`
- drei globale Kanal-Switches für Push, E-Mail und Kalender
- pro aktiviertem Channel einen eigenen Bereich mit einem oder zwei Slots
- je Slot Felder für `max_lead_days` und `default_lead_days`

Nicht relevante Felder werden bei `none` oder `once` deaktiviert oder ausgeblendet, damit der Dialog den kanonischen Serverzustand bereits andeutet. Slot-IDs werden im UI nicht als editierbare Felder gezeigt; sie sind technische Persistenzanker. Die Listenansicht erhält bewusst keine verdichtete Reminder-Darstellung, um die Tabelle nicht mit einer Konfiguration zu überladen, die primär im Detaildialog gepflegt wird.

## Risiken und Gegenmaßnahmen
- Risiko: spätere Zustelllogik interpretiert Channel-Blöcke oder Slot-Defaults anders als die Admin-UI.
  Gegenmaßnahme: Das JSON-Schema und die Feldsemantik werden im Spec ausdrücklich als fachlicher Vertrag beschrieben.
- Risiko: inkonsistente Requests aus Tests oder manuellen Clients.
  Gegenmaßnahme: Zod-Schema plus serverseitige Normalisierung.
- Risiko: Bestandsdaten verlieren durch die Migration die Referenz für spätere Geräte-Settings.
  Gegenmaßnahme: deterministische Slot-ID-Erzeugung und persistente Weiterverwendung dieser IDs.
- Risiko: bestehende Seed- oder Importdaten kennen nur das Flachmodell.
  Gegenmaßnahme: Backfill in `reminder_config` und Übergangsnormalisierung an der Host-Fassade.

## Teststrategie
- Core-/Typ-Tests für den erweiterten Fraktionsvertrag und den Static-Content-Builder.
- Repository-Tests für `reminder_config` im Read-/Write-Mapping und den Backfill-Pfad.
- App-Server-Tests für Waste-Schema-Migration und Host-seitige Normalisierung.
- Auth-Runtime-Tests für Validierung und Normalisierung.
- Plugin-Tests für Fraktionsdialog, Input-Mapping und kanalbezogenen Reminder-Abschnitt.
