# Design: Erinnerungs-Konfiguration pro Abfallfraktion

## Kontext
Im Waste-Management sollen Abfallfraktionen eine fachliche Konfiguration für spätere Abhol-Erinnerungen erhalten. Die eigentliche Zustellung von Push-, E-Mail- oder Kalender-Benachrichtigungen wird an anderer Stelle umgesetzt. Dieser Change schafft ausschließlich den administrativen Vertrag, mit dem pro Fraktion steuerbar ist, ob keine, eine oder zwei Erinnerungen angeboten werden und welche Maximalwerte sowie Kanäle dafür gelten.

Die Konfiguration soll direkt an der Abfallfraktion hängen, nicht in globalen Waste-Einstellungen. Dadurch bleibt die spätere Nutzeroberfläche fachnah: Bürger wählen ihre Erinnerungspräferenzen immer im Rahmen einer konkreten Fraktion, und die Host-Fassade kann die fachliche Freigabe ohne zusätzlichen Join auf eine getrennte Reminder-Entität lesen.

## Ziele
- Abfallfraktionen um eine typsichere Reminder-Konfiguration erweitern.
- Die Konfiguration konsistent in Core-Typen, Repository, Host-Fassade und Plugin-UI abbilden.
- Serverseitig nur gültige Kombinationen persistieren und inkonsistente Eingaben normalisieren.
- Die UI so aufbauen, dass die spätere Zustelllogik dieselben Felder ohne Datenmigration verwenden kann.

## Nicht-Ziele
- Keine eigentliche Zustelllogik für Push, E-Mail oder Kalender.
- Keine nutzerbezogenen Vorlaufzeiten oder Opt-ins.
- Keine Reihenfolgenvalidierung zwischen erster und zweiter Erinnerung.
- Keine globale Reminder-Konfiguration außerhalb der Abfallfraktion.

## Entscheidungen

### 1. Reminder-Felder liegen direkt auf `waste_fractions`
Die Reminder-Konfiguration wird als explizite Felder im Fraktionsmodell gespeichert:
- `reminderCount`
- `firstReminderMaxLeadDays`
- `secondReminderMaxLeadDays`
- `reminderChannelPushEnabled`
- `reminderChannelEmailEnabled`
- `reminderChannelCalendarEnabled`

Eine separate Tabelle oder ein JSONB-Feld wäre für den aktuellen Scope unnötig komplex oder zu schwach typisiert. Die Struktur ist stabil und fachlich 1:1 an die Fraktion gebunden.

### 2. Zählmodell statt freier Anzahl
Die Anzahl möglicher Erinnerungen wird als Enum `none | once | twice` modelliert. Das ist für UI, API-Schema und Persistenz klarer als eine freie numerische Anzahl und verhindert ungültige Werte außerhalb des fachlichen Scopes.

### 3. Kanalfreigaben gelten global pro Fraktion
Push, E-Mail und Kalender werden nicht pro Erinnerung, sondern einmal pro Fraktion aktiviert. Die spätere Bürgerlogik darf diese Kanäle nur anbieten, wenn sie an der Fraktion freigeschaltet sind.

### 4. Server normalisiert nicht relevante Felder
Die Host-Fassade behandelt den Request tolerant, persistiert aber nur den kanonischen Zustand:
- bei `none`: beide Lead-Day-Felder `null`, alle Kanäle `false`
- bei `once`: `secondReminderMaxLeadDays` `null`
- bei `twice`: beide Lead-Day-Felder gesetzt

Damit bleiben spätere Altlasten oder manuelle Requests ohne inkonsistente Daten im System.

### 5. Keine Ordnungsregel zwischen erster und zweiter Erinnerung
Die beiden Maximalwerte bleiben unabhängig. Eine Regel wie "erste Erinnerung muss größer als zweite Erinnerung sein" wird bewusst nicht eingeführt. Nutzer konfigurieren später ihre konkreten Vorlaufzeiten selbst innerhalb dieser Grenzen.

## UI-Entwurf
In der Fraktionen-Listenansicht wird die Reminder-Konfiguration bewusst nicht als zusätzliche Tabellenspalte, Badge-Gruppe oder Inline-Aktion gezeigt. Die bestehende Tabellenansicht bleibt auf die bisherigen Kerninformationen der Fraktion fokussiert.

Im Fraktionsdialog entsteht stattdessen ein eigener vierter Block "Erinnerungen". Er folgt auf die bestehenden drei Blöcke des Create-/Edit-Views und bündelt die neue Fachkonfiguration vollständig an einer Stelle. Der Block enthält:
- Auswahl `Keine`, `Eine Erinnerung`, `Zwei Erinnerungen`
- Dropdown `1` bis `14` Tage für Erinnerung 1
- optionales Dropdown `1` bis `14` Tage für Erinnerung 2
- drei globale Kanal-Switches für Push, E-Mail und Kalender

Nicht relevante Felder werden bei `none` oder `once` deaktiviert oder ausgeblendet, damit der Dialog den kanonischen Serverzustand bereits andeutet. Die Listenansicht erhält bewusst keine verdichtete Reminder-Darstellung, um die Tabelle nicht mit einer Konfiguration zu überladen, die primär im Detaildialog gepflegt wird.

## Risiken und Gegenmaßnahmen
- Risiko: spätere Zustelllogik interpretiert die Lead-Day-Felder anders als die Admin-UI.
  Gegenmaßnahme: Die Felder werden im Spec ausdrücklich als maximale Vorlaufzeit modelliert.
- Risiko: inkonsistente Requests aus Tests oder manuellen Clients.
  Gegenmaßnahme: Zod-Schema plus serverseitige Normalisierung.
- Risiko: bestehende Seed- oder Importdaten kennen die neuen Felder nicht.
  Gegenmaßnahme: Defaults im Datenmodell und nullable Persistenz mit `none` als fachlichem Startzustand.

## Teststrategie
- Core-/Typ-Tests für den erweiterten Fraktionsvertrag.
- Repository-Tests für neue Reminder-Felder im Read-/Write-Mapping.
- Auth-Runtime-Tests für Validierung und Normalisierung.
- Plugin-Tests für Fraktionsdialog, Input-Mapping und Reminder-Abschnitt.
