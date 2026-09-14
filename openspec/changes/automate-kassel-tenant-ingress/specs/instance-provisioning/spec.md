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

- **WHEN** alle internen Provisioning-Stufen, die aktuellen Readiness-Verträge aller effektiv aktiven Module und der öffentliche Studio-Login-Redirect erfolgreich sind
- **THEN** setzt das System Instanz und Elternlauf gemeinsam terminal auf `active`
- **AND** hat es zuvor den erwarteten Realm, die exakte Client-ID, PKCE `S256` und die hostgleiche Callback-Konfiguration bestätigt
- **AND** zeigt die Control Plane erst diesen terminalen Zustand als abgeschlossene Anlage an

#### Scenario: SSF ist für den Tenant effektiv aktiv

- **WHEN** der Elternlauf die SSF-Readiness als terminale Postcondition bewertet
- **THEN** bestätigt er die aktuellen maschinenprüfbaren SSF-Postconditions für Browserclient, Ressourcenclient, IAM-Projektion, Runtime-Tenant-Baseline und Runtime-Readiness
- **AND** bestätigt er die aktuelle IAM-Authorization-Revision gegen den Lifecycle- und Runtime-Sollzustand
- **AND** behandelt er Directory-Sichtbarkeit allein nicht als ausreichenden Erfolgsnachweis

#### Scenario: Der Kassel-Modus wird für einen Release aktiviert

- **WHEN** die Kasseler Installation mit SSF für einen Release freigegeben werden soll
- **THEN** weist der geschützte Rollout mit dedizierten Acceptance-Identitäten Directory-Auswahl, Keycloak-Login, SSF-Callback und Gateway-Akzeptanz nach
- **AND** bestätigt er dabei Tenant-, Audience-, Rollen- und Authorization-Revision
- **AND** ersetzt dieser umgebungsgebundene Nachweis weder die maschinenprüfbare Create-Readiness noch lässt sein Fehlen einen einzelnen Create-Lauf unbegrenzt nichtterminal

#### Scenario: Ein Modul ist nicht effektiv aktiv

- **WHEN** ein optionales Modul dem Tenant nicht zugewiesen oder durch seinen Lifecycle nicht wirksam ist
- **THEN** erzeugt dessen fachliche Readiness keine künstliche Blockade des Create-Laufs
- **AND** bleiben die für tatsächlich aktive Module geltenden Postconditions unverändert streng

#### Scenario: Der Prozess endet vor der terminalen Aktivierung

- **WHEN** eine Instanz `provisioning` ist und ihr Elternlauf noch nicht alle maschinenprüfbaren Postconditions bestätigt hat
- **THEN** erkennt der persistente Recovery-Mechanismus diesen Zustand unabhängig vom ursprünglichen Prozess
- **AND** führt er die fehlenden Postconditions weiter oder setzt Instanz und Elternlauf innerhalb der Fehlerfrist auf `failed`
- **AND** wird weder die Instanz noch der nichtterminale Lauf zu diesem Zeitpunkt als aktive oder abgeschlossene Anlage dargestellt

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

- **WHEN** eine berechtigte Person nach Behebung der Ursache über die sichtbare Retry-Aktion `POST /api/v1/iam/instances/:instanceId/provisioning/retry` startet
- **AND** die Anfrage einen frischen HTTP-Idempotency-Key trägt, ohne den ursprünglichen Create-Key erneut zu benötigen
- **THEN** reconciled das System jede Stufe gegen den aktuellen, zum Sollsnapshot passenden Ist-Zustand
- **AND** behält es den tenantbezogenen Sollzustand bei und bindet nur dessen technische Plugin-Verträge atomar an den aktuell geladenen Plugin-Snapshot
- **AND** startet es bei geändertem OIDC-Vertrag erneut ab Registry mit einem neuen Keycloak-Kindlauf
- **AND** bleibt es fail-closed, wenn eine bisherige OIDC-Client-ID ohne explizites Retirement aus dem aktuellen Vertrag entfernt wurde
- **AND** öffnet es den Elternlauf nicht, solange ein aktueller Lifecycle-Intent wegen eines aktiven Jobs nicht vollständig persistiert werden kann
- **AND** verwendet es bereits korrekte Artefakte weiter
- **AND** setzt es am ersten unvollständigen, veralteten oder abweichenden Schritt fort
- **AND** gibt eine wiederholte Retry-Anfrage den bereits aufgenommenen Lauf zurück, statt einen weiteren Elternlauf zu erzeugen
- **AND** lehnt es Legacy-, externe, aktive oder nicht fehlgeschlagene Läufe terminal ab, ohne ihren Zustand zu öffnen

#### Scenario: Zwei Anforderungen konkurrieren um dieselbe Instanz

- **WHEN** Create oder Retry für dieselbe Instanz und Operation gleichzeitig angefordert werden
- **THEN** akzeptiert das System höchstens einen wirksamen Elternlauf
- **AND** referenziert oder verwirft die konkurrierende Anforderung gemäß dem bestehenden Idempotenzvertrag

#### Scenario: Ein älterer Kindlauf war erfolgreich

- **WHEN** ein spezialisierter Kindlauf erfolgreich ist, aber nicht zum aktuellen Sollsnapshot des Elternlaufs gehört
- **THEN** verwendet das System diesen Erfolg nicht als aktuelle Readiness-Evidenz
- **AND** erzeugt oder erwartet es einen explizit korrelierten, kompatiblen Kindlauf
