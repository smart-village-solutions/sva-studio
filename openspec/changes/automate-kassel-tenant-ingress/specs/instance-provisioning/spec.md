## ADDED Requirements

### Requirement: Kasseler Instanzanlage besitzt einen führenden terminalen Elternlauf

Das System SHALL für jede Kasseler Instanzanlage genau einen fachlich führenden,
persistenten Elternlauf pro Instanz, Create-Operation und Idempotency-Key führen.
Der Elternlauf SHALL den angenommenen Vorgang in place bis zu einem terminalen
Ergebnis fortschreiben und SHALL jeden nichtterminalen Zustand unabhängig von
einer geöffneten UI persistent ausführbar halten.

#### Scenario: Eine Kasseler Instanzanlage wird angenommen

- **WHEN** eine berechtigte Person einen gültigen Kasseler Tenant anlegt
- **THEN** persistiert das System Instanz, Elternlauf und einen ausführbaren Startzustand ohne verlorenes Wake-up
- **AND** gibt es eine Run-ID für die Beobachtung zurück
- **AND** stellt es die Annahme weder fachlich noch in der Control Plane als abgeschlossene Anlage dar

#### Scenario: Der Elternlauf schreitet durch Teilstufen fort

- **WHEN** Registry, Keycloak, Lifecycle, Ingress oder öffentliche Postconditions bearbeitet werden
- **THEN** wird derselbe Elternlauf mit aktueller Stufe, Wake-up-/Lease-Zustand und redigierter Evidenz fortgeschrieben
- **AND** bleiben spezialisierte Kindläufe über explizite Korrelation getrennt diagnostizierbar
- **AND** erzeugt eine Teilstufe keinen konkurrierenden fachlichen Create-Lauf

#### Scenario: Die UI wird während der Provisionierung geschlossen

- **WHEN** die anlegende Person die Seite schließt oder die Statusabfrage unterbrochen wird
- **THEN** setzt der eigenständige Kasseler Provisioner den persistenten Lauf ohne Browserbeteiligung fort
- **AND** kann die Control Plane nach erneutem Öffnen denselben Run- und Stufenzustand anzeigen

#### Scenario: Eine nichtterminale Stufe verliert ihren Worker

- **WHEN** ein Provisioner nach dem Claim oder zwischen zwei Stufen endet
- **THEN** wird der Lauf nach Ablauf seines gültigen Lease erneut claimbar
- **AND** setzt ein neuer Worker am ersten nicht nachgewiesenen Schritt fort
- **AND** endet der Lauf spätestens an seiner Deadline erfolgreich oder terminal `failed`

### Requirement: Kasseler Instanzanlage umfasst externe und modulabhängige Readiness

Das System SHALL eine Kasseler Instanzanlage erst als erfolgreich abgeschlossen
ausweisen, wenn Registry, Keycloak, externer Ingress, öffentliches TLS,
Studio-Login und die Readiness aller effektiv aktiven Module zum aktuellen
Sollzustand nachweislich betriebsbereit sind.

#### Scenario: Kasseler Instanz wird vollständig erfolgreich angelegt

- **WHEN** alle internen Provisioning-Stufen und alle vor Aktivierung prüfbaren Postconditions erfolgreich sind
- **THEN** setzt das System die Instanz kontrolliert auf `active`
- **AND** prüft es den Studio-Login über den öffentlichen Tenant-Host mit erwartetem Realm und hostgleicher Callback-Konfiguration
- **AND** prüft es die aktuellen Readiness-Verträge aller effektiv aktiven Module
- **AND** markiert es erst danach den Elternlauf terminal als erfolgreich
- **AND** zeigt die Control Plane erst diesen terminalen Zustand als abgeschlossene Anlage an

#### Scenario: SSF ist für den Tenant effektiv aktiv

- **WHEN** der Elternlauf die SSF-Readiness als terminale Postcondition bewertet
- **THEN** bestätigt er den vollständigen aktuellen SSF-Vertrag für Browserclient, Ressourcenclient, IAM-Projektion, Runtime-Tenant-Baseline und Runtime-Readiness
- **AND** bestätigt er eine aktuelle und zwischen Token und Runtime übereinstimmende Authorization-Revision
- **AND** bestätigt er Directory-Auswahl, Keycloak-Login, SSF-Callback und Gateway-Akzeptanz
- **AND** behandelt er Directory-Sichtbarkeit allein nicht als ausreichenden Erfolgsnachweis

#### Scenario: Ein Modul ist nicht effektiv aktiv

- **WHEN** ein optionales Modul dem Tenant nicht zugewiesen oder durch seinen Lifecycle nicht wirksam ist
- **THEN** erzeugt dessen fachliche Readiness keine künstliche Blockade des Create-Laufs
- **AND** bleiben die für tatsächlich aktive Module geltenden Postconditions unverändert streng

#### Scenario: Der Prozess endet nach Aktivierung und vor den öffentlichen Smokes

- **WHEN** eine Instanz bereits `active` ist, ihr Elternlauf aber noch keinen terminal erfolgreichen Public-Smoke besitzt
- **THEN** erkennt der persistente Recovery-Mechanismus diesen Zustand unabhängig vom ursprünglichen Prozess
- **AND** führt er die fehlenden Postconditions weiter oder setzt Instanz und Elternlauf innerhalb der Fehlerfrist auf `failed`
- **AND** wird der nichtterminale Lauf zu keinem Zeitpunkt als abgeschlossene Anlage dargestellt

### Requirement: Kasseler Fehler und Retries konvergieren ohne destruktiven Rollback

Das System SHALL einen fachlich nicht reparierbaren Fehler oder eine
überschrittene Deadline terminal als `failed` speichern, bereits erzeugte
Artefakte erhalten und einen autorisierten Retry idempotent ab der ersten nicht
nachgewiesenen Stufe fortsetzen.

#### Scenario: Eine Provisioning-Stufe scheitert terminal

- **WHEN** eine Kasseler Provisioning-Stufe fachlich nicht reparierbar scheitert oder ihre Deadline überschreitet
- **THEN** wechseln Elternlauf und Instanz kontrolliert auf `failed`
- **AND** bleibt kein Lauf ohne persistent ausführbaren Folgepunkt nichtterminal stehen
- **AND** werden Registry-, Keycloak-, Secret-, Lifecycle- und Ingress-Artefakte nicht automatisch gelöscht
- **AND** bleiben Runtime, Directory und Module trotz erhaltener Artefakte fail-closed

#### Scenario: Ein fehlgeschlagener Lauf wird erneut ausgeführt

- **WHEN** eine berechtigte Person nach Behebung der Ursache einen Retry startet
- **THEN** reconciled das System jede Stufe gegen den aktuellen, zum Sollsnapshot passenden Ist-Zustand
- **AND** verwendet es bereits korrekte Artefakte weiter
- **AND** setzt es am ersten unvollständigen, veralteten oder abweichenden Schritt fort

#### Scenario: Zwei Anforderungen konkurrieren um dieselbe Instanz

- **WHEN** Create oder Retry für dieselbe Instanz und Operation gleichzeitig angefordert werden
- **THEN** akzeptiert das System höchstens einen wirksamen Elternlauf
- **AND** referenziert oder verwirft die konkurrierende Anforderung gemäß dem bestehenden Idempotenzvertrag

#### Scenario: Ein älterer Kindlauf war erfolgreich

- **WHEN** ein spezialisierter Kindlauf erfolgreich ist, aber nicht zum aktuellen Sollsnapshot des Elternlaufs gehört
- **THEN** verwendet das System diesen Erfolg nicht als aktuelle Readiness-Evidenz
- **AND** erzeugt oder erwartet es einen explizit korrelierten, kompatiblen Kindlauf
