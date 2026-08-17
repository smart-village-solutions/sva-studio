## Context

Tenantlokale Autorisierung wird normativ aus vollständig qualifizierten Permissions und deren Scopes abgeleitet. `roleLevel` ist laut ADR-046 keine normative Quelle neuer Autorisierungsentscheidungen, wird derzeit aber noch als interne Schutzgrenze für Rollenzuweisungen und die Verwaltung höher eingestufter Zielkonten ausgewertet. Ein vollständiger Rückbau benötigt daher einen eigenen IAM-Migrationschange.

Die Rollen-UI verlangt aktuell dennoch die manuelle Eingabe dieses internen Zahlenwerts und eines technischen Rollenschlüssels. Gleichzeitig sind `content.publish` und `content.changeStatus` bereits getrennte positive Rechte, während der optionale News-Push noch zusammen mit einer normalen News-Create- oder Update-Mutation verarbeitet wird.

Der bestehende gemeinsame Save-Feedback-Vertrag bleibt maßgeblich. Dieser Change ergänzt ausschließlich den rollenbezogenen Dirty-State und führt keine zweite Feedback-Komponente ein.

## Goals / Non-Goals

### Goals

- Rollen ohne Kenntnis interner Schlüssel oder numerischer Hierarchiefelder anlegen können
- Bestehende Sicherheits- und Kompatibilitätswirkung von `roleLevel` unverändert erhalten
- Nur tatsächlich geänderte Rollenmetadaten oder Rechte speicherbar machen
- Rechte und Scopes fachlich verständlich darstellen
- Push-Benachrichtigungen durch ein eigenes positives Recht absichern
- Publish-, Sichtbarkeits- und Push-Rechte getrennt prüfbar halten

### Non-Goals

- Rollen- oder Gruppenvorlagen
- Entfernung oder fachliche Neudefinition von `roleLevel`
- Plugin-spezifische Publish-Permissions
- Änderung des Allow-only-Modells
- Neuentwicklung einer allgemeinen Formular- oder Feedback-Infrastruktur

## Decisions

### 1. `roleLevel` bleibt intern und verschwindet aus der normalen Rollen-UI

Die Rollenliste sowie Create- und Edit-Formulare zeigen und bearbeiten `roleLevel` nicht mehr. Das Feld bleibt in persistierten Bestandsdaten, internen Read-Models, Auditdaten und bestehenden serverseitigen Schutzprüfungen erhalten.

Die Studio-Rollenanlage sendet keinen frei gewählten Wert mehr. Fehlt `roleLevel` im kompatiblen Create-Vertrag, setzt der Server für eine neue Custom-Rolle `0`. Bei Updates ohne `roleLevel` bleibt der gespeicherte Wert unverändert. Technisch verwaltete Sonderrollen behalten ihre durch Seed, Provisioning oder Reconcile gesetzten Werte.

Bestehende API-Kompatibilität für explizite Legacy-Aufrufer wird in diesem Change nicht entfernt. Eine spätere Entfernung oder Ersetzung des Feldes benötigt einen separaten Change mit eigener Delegations- und Migrationsanalyse.

Fehlertexte dürfen keine Kenntnis einer unsichtbaren Zahl verlangen. Eine abgelehnte Zuweisung oder Zielkontenmutation wird als geschützte Verwaltungsgrenze erklärt.

### 2. Der Server erzeugt den unveränderlichen technischen Rollenschlüssel

Der Anzeigename ist die einzige notwendige Namenseingabe. Der Server erzeugt bei der Anlage einen normalisierten Schlüssel:

1. trimmen und Unicode-normalisieren,
2. deutsche Umlaute fachlich stabil transliterieren (`ä → ae`, `ö → oe`, `ü → ue`, `ß → ss`) und übrige kombinierende diakritische Zeichen entfernen,
3. in Kleinbuchstaben überführen,
4. nicht alphanumerische Folgen durch `_` ersetzen,
5. führende und folgende `_` entfernen,
6. bei leerem Ergebnis `rolle` verwenden und bei weniger als drei Zeichen mit `rolle_` auf einen gültigen Basisschlüssel erweitern,
7. auf die bestehende maximale Schlüssellänge begrenzen.

Bei einer Kollision wird innerhalb derselben Instanz deterministisch der kleinste freie numerische Suffix `_2`, `_3` usw. verwendet. Der Basisschlüssel wird dabei soweit gekürzt, dass Schlüssel und Suffix gemeinsam die maximale Länge einhalten. Unique-Constraint und Transaktion bleiben die letztgültige Konkurrenzsicherung; ein konkurrierender Konflikt wird begrenzt erneut aufgelöst. Der bestehende Idempotency-Key-Vertrag stellt sicher, dass dieselbe Anfrage nicht mehrere Rollen erzeugt.

Der erzeugte Schlüssel ist nach der Anlage unveränderlich. Er wird in der Detailansicht nur unter „Technische Details“ lesbar angezeigt und ist kein zweiter fachlicher Name. Für die bestehende API-Kompatibilität darf ein autorisierter Legacy-Client vorerst weiterhin einen expliziten Schlüssel mitsenden; der Server normalisiert diesen nicht neu, sondern wendet die vorhandene Validierung und Eindeutigkeitsprüfung an. Die Studio-UI bietet diesen Pfad nicht an.

### 3. Dirty-State ergänzt den bestehenden Save-Feedback-Vertrag

Allgemeine Rollendaten und Rollenrechte behalten getrennte Speicheraktionen. Jede Teilfläche vergleicht ihren normalisierten aktuellen Entwurf mit dem zuletzt serverseitig bestätigten Zustand.

- Ohne fachliche Änderung ist die jeweilige Speicheraktion deaktiviert.
- Während eines Requests gilt weiterhin der gemeinsame `saving`-Zustand.
- Nach Erfolg wird der bestätigte Serverzustand zur neuen Vergleichsbasis; der Button zeigt transient `Gespeichert` und bleibt fachlich deaktiviert.
- Eine neue Änderung beendet den Erfolgszustand sofort und aktiviert die Aktion wieder.
- Nach Fehler bleibt der Entwurf dirty und erneut speicherbar.
- Reine Sortierungsunterschiede in Permission-Zuordnungen gelten nicht als Änderung.

Die Rollenanlage ist nur bei gültigem, nicht leerem Anzeigenamen absendbar. Nach erfolgreicher Anlage bleibt die bestehende Navigation auf die Detailroute mit transientem Save-Feedback erhalten.

### 4. Rechte und Scopes werden fachlich erklärt, nicht neu modelliert

Die Rollenrechte-Ansicht verwendet lokalisierte Bezeichnungen und kurze Beschreibungen für Bereich, Aktion und Scope. `own`, `organization` und `all` werden nicht per technischer String-Humanisierung angezeigt, sondern fachlich erklärt. Technische Permission-IDs bleiben in einer einklappbaren Detailansicht verfügbar.

`content.publish` und `content.changeStatus` bleiben eigenständige Allow-Grants. Die Oberfläche erklärt:

- `content.publish`: einen Inhalt veröffentlichen beziehungsweise erstmals sichtbar machen,
- `content.changeStatus`: sonstige unterstützte Sichtbarkeits- oder Statuswechsel, soweit keine speziellere Lifecycle-Permission greift.

Die serverseitige Autorisierung bleibt führend. Eine verständlichere UI führt keine alternative Permission-Auflösung ein.

### 5. Push-Versand verlangt zusätzlich `news.pushNotification`

Das News-Modul registriert `news.pushNotification` im eigenen Namespace und im kanonischen Modul-Permission-Katalog. Das Recht wird über denselben IAM- und Modulaktivierungsvertrag materialisiert wie andere News-Permissions.

Wenn eine Create- oder Update-Anfrage `pushNotification = true` enthält, muss der Server kumulativ prüfen:

- die zur Basismutation passende News-Permission (`news.create` oder `news.update`),
- `news.pushNotification`,
- und nur dann `content.publish`, wenn dieselbe Mutation tatsächlich einen Veröffentlichungs- oder Sichtbarkeitsübergang auslöst.

Fehlt `news.pushNotification`, wird die Mutation vor dem Mainserver-Aufruf fail-closed abgelehnt. Die UI blendet die Push-Option ohne das Recht aus oder stellt sie nicht ausführbar dar; diese UI-Grenze ersetzt nicht die Serverprüfung.

Bestehende Custom-Rollen werden nicht automatisch erweitert. `system_admin` erhält das Recht ausschließlich über den bereits bestehenden Vertrag, nach dem aktive tenantlokale Permissions vollständig an diese geschützte Rolle gebunden werden.

## Data Flow

### Rollenanlage

1. Administrator:in gibt Anzeigename und optionale Beschreibung ein.
2. Der Client sendet keinen selbst erzeugten technischen Schlüssel und kein UI-gesteuertes `roleLevel`.
3. Der Server validiert den Anzeigenamen, erzeugt den instanzweit eindeutigen Schlüssel und setzt den internen Standardwert.
4. Persistenz und gegebenenfalls technischer Sync laufen über den bestehenden idempotenten Rollen-Workflow.
5. Die Antwort liefert die gespeicherte Rolle; die UI navigiert auf deren Detailroute.

### News-Mutation mit Push

1. Die UI bietet Push nur bei hostaufgelöstem `news.pushNotification` an.
2. Der Server erkennt `pushNotification = true` als zusätzliche autorisierbare Operation.
3. Basis-, Push- und gegebenenfalls Publish-Prüfung werden vor dem Mainserver-Aufruf abgeschlossen.
4. Erst danach wird der bestehende Provider-/Mainserver-Mutationspfad ausgeführt und auditiert.

## Error Handling

- Ein ungültiger oder leerer Anzeigename liefert einen strukturierten `invalid_request`-Fehler.
- Ein nach begrenzter Konkurrenzauflösung nicht erzeugbarer Schlüssel liefert einen strukturierten Konflikt; es wird keine teilweise Rolle angelegt.
- Eine geschützte Rollen- oder Zielkontenmutation verwendet verständliche, lokalisierbare Denial-Texte ohne numerische Levelangabe.
- Fehlendes `news.pushNotification` liefert einen strukturierten Permission-Denial mit `required_permissions` und startet keinen Mainserver-Aufruf.
- Speicherfehler bleiben gemäß bestehendem Save-Feedback-Vertrag persistent und wiederholbar; Dirty-State geht nicht verloren.

## Accessibility and Security

- Verborgene technische Details sind per Tastatur erreichbar und über `aria-expanded`/`aria-controls` angebunden.
- Scope-Erklärungen sind nicht ausschließlich über Farbe oder Tooltip verfügbar.
- Disabled-, Saving- und Saved-Zustände bleiben programmatisch erkennbar und verwenden die gemeinsame Live-Region.
- Technische Schlüssel werden ausschließlich serverseitig erzeugt und instanzweit eindeutig persistiert.
- Push-, Publish- und Basismutationsrechte werden serverseitig unabhängig geprüft; UI-Sichtbarkeit ist keine Sicherheitsgrenze.
- Neue Logs und Auditdaten enthalten keine zusätzlichen personenbezogenen Inhalte.

## Migration Plan

1. API-Vertrag für fehlendes `roleLevel` und serverseitige Rollenschlüsselerzeugung abwärtskompatibel erweitern.
2. Rollen-UI auf Anzeigename, technische Detailansicht und Dirty-State umstellen.
3. `news.pushNotification` in Katalog, Moduldefinitionen, Reconcile und `system_admin`-Vollzugriffsvertrag aufnehmen.
4. News-UI und Mainserver-Route gemeinsam auf die zusätzliche Prüfung umstellen, damit kein ungeschütztes Übergangsfenster entsteht.
5. Bestehende Custom-Rollen unverändert lassen; Administrator:innen vergeben das neue Recht bewusst.

Ein Rollback entfernt die UI-Nutzung und die neue Push-Option, lässt bereits materialisierte Permission-Definitionen jedoch als wirkungslose, nicht zugewiesene Katalogeinträge bestehen. Bereits versendete Push-Benachrichtigungen sind nicht rückrollbar.

## Risks / Trade-offs

- **Verborgene Hierarchielogik bleibt technische Schuld:** Die UI wird einfacher, die interne Level-Prüfung bleibt jedoch bestehen. → Arc42-Risiko fortschreiben und Rückbau nicht als erledigt markieren.
- **Automatische Schlüssel können ungewohnt aussehen:** Transliteration und Suffixregeln sind deshalb deterministisch und getestet; der fachliche Anzeigename bleibt führend.
- **Bestehende Redaktionen verlieren Push-Funktion, bis das neue Recht vergeben wurde:** Das ist eine beabsichtigte Least-Privilege-Migration. `system_admin` bleibt über den Vollzugriffsvertrag handlungsfähig.
- **Dirty-State kann durch uneinheitliche Normalisierung falsch auslösen:** Vergleichslogik normalisiert Strings, Permission-Reihenfolge und Scopes an einer gemeinsamen, framework-agnostischen Stelle.

## Open Questions

Keine. Rollen-/Gruppenvorlagen und der vollständige `roleLevel`-Rückbau sind ausdrücklich nicht Bestandteil dieses Changes.
