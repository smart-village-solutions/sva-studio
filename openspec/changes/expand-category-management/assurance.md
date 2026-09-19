# Assurance Case: expand-category-management

## Geltungsbereich und Annahmen

- Betroffene Systeme und Packages: `packages/plugin-categories`, `packages/sva-mainserver`, dünne Serveradapter in `apps/sva-studio-react`.
- Externe Abhängigkeit: SVA-Mainserver mit Vertrag aus `SVA-1753` und einer effektiven Management-Rolle für die verwendeten Credentials.
- Ausdrücklich nicht abgedeckt: Mainserver-interne Persistenzimplementierung, rekursives Löschen, Reassign, Bulk-Änderungen und globale Kategorienverwaltung.
- Vertrauensannahme: Der verifizierte Mainserver-Vertrag setzt Municipality-Scoping, atomare Saves, Zyklusprüfung, Statuskaskade und Safe-Delete wie beschrieben durch; Studio prüft seine eigene Boundary zusätzlich fail-closed.

## Lokale Prüfgrundlage am 19. September 2026

- `packages/sva-mainserver/src/server/categories-route.test.ts`: 14/14 Tests erfolgreich.
- `packages/sva-mainserver/src/server/service.test.ts`: fokussierter Test gegen automatischen Mutation-Retry erfolgreich; ein nicht betroffener Paginationstest der vollständigen Datei lief lokal in sein bestehendes Timeout.
- `packages/plugin-categories/tests/categories.api.test.ts` und `categories.pages.test.tsx`: 22/22 Tests erfolgreich.
- App-Routenadapter: vollständige betroffene Route-Testdatei mit 26/26 Tests erfolgreich; der neue Registry-ID-/Label-Fall ist enthalten.
- `plugin-categories:build`, `sva-mainserver:test:types`, `pnpm check:server-runtime`, `sva-studio-react:check:i18n`, `pnpm check:file-placement`, Complexity-Gate und strikte OpenSpec-Validierung erfolgreich.
- Diese Evidenz belegt den lokalen PR-Arbeitsstand. GitHub-Gates für den finalen Commit sowie Vertrags-, Credential- und Browserabnahme in der Zielumgebung bleiben getrennte Freigabevoraussetzungen.

## Systemgrenzen und Verbraucher

| ID     | Eintritts-/Ausführungsgrenze                      | Vorbedingung                                                      | Durchsetzung                                                                                                       | Recheck                                            | Verbraucher         |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------- |
| BND-01 | Browser → Studio-Kategorienroute                  | Authentifizierte Session, aktiver Instanz-/Organisationskontext   | Request-Parser und actionspezifische IAM-Prüfung                                                                   | Unmittelbar vor jedem Upstream-Aufruf              | `plugin-categories` |
| BND-02 | Studio → Mainserver GraphQL                       | Verifizierter Schema-Vertrag und effektive Management-Credentials | Server-only Adapter, Credential-Auflösung und Runtime-Response-Parser                                              | Bei jedem Request                                  | Kategorienroute     |
| BND-03 | Plugin-/Content-Type-Registry → Kategorieformular | Validierter Build-time-Snapshot                                   | App-Adapter projiziert `mainserverGenericTypeRegistry` in Options-Props; Plugin ergänzt nur statische Legacy-Typen | Beim Öffnen beziehungsweise Neuladen des Formulars | Datentypauswahl     |
| BND-04 | Mainserver-Mutationsergebnis → UI-Erfolg          | Erwartete Resultat-ID und leere fachliche Fehlerliste             | Payload-Parser und Ergebnisnormalisierung                                                                          | Vor Erfolgsfeedback und Listen-Reload              | Kategorienseite     |
| BND-05 | Browser-Create → Host-Idempotenz                  | Operationsgebundener `Idempotency-Key`                            | Vorhandene Reservation, Payload-Bindung, Replay und Completion                                                     | Vor jedem Create-Upstream-Aufruf                   | Kategorienroute     |

## Zustände und Übergänge

| Von                 | Ereignis                | Persistente Writes                                                                            | Externe Arbeit     | Fehlerpunkt                                   | Nachzustand/Recovery                                                        |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| Management-Snapshot | Create bestätigt        | Vorhandene Host-Idempotenz reserviert den Schlüssel; Mainserver legt eine Kategorie atomar an | `saveCategory`     | Transport-, Vertrags- oder Validierungsfehler | Terminales Ergebnis wird replayed; nichtterminaler Ausgang verlangt Re-Read |
| Management-Snapshot | Update bestätigt        | Mainserver ändert Kategorie, Kontakt, Tags und gegebenenfalls Hierarchie/Status atomar        | `saveCategory`     | Fehler vor oder in der Mutation               | Kein partieller Studio-Zustand; Re-Read nach eindeutigem Erfolg             |
| Management-Snapshot | Delete bestätigt        | Mainserver löscht nur eine ungenutzte Kategorie                                               | `deleteCategory`   | Usage-Blockade oder Transportfehler           | Kategorie bleibt sichtbar; Usage beziehungsweise Fehler wird angezeigt      |
| Veralteter Snapshot | Mutation liefert Erfolg | Mainserver-Zustand ist führend                                                                | Management-Re-Read | Reload schlägt lokal fehl                     | Mutationserfolg bleibt erhalten; Reload kann wiederholt werden              |

## Invariantenregister

### INV-01: Keine fremde Municipality-Kategorie wird offengelegt oder verändert

- Kritikalität: kritisch
- Geltungsbereich: Management-Read, Create, Update, Reparenting und Delete.
- Verletzungsszenarien: manipulierte Pfad-ID, fremde `parentId`, fremde oder globale Kategorie im Snapshot, falscher Credential-Kontext.
- Prävention: lokales IAM, organisationsgebundene Credential-Auflösung, serverseitige ID-Übernahme und Mainserver-Municipality-Scoping.
- Erkennung: deterministische `forbidden`/`not_found`-Antwort ohne fremde Namen oder Usage-Zahlen; PII-arme Logs.
- Recovery: keine lokale Mutation; Benutzer kann Kontext beziehungsweise Credentials korrigieren und erneut laden.
- Geplante direkte Evidenz:
  - Route-Tests für jede Action und fremde IDs unter `packages/sva-mainserver/src/server/categories-route.test.ts`.
  - Adapter-/Integrationstest mit fremder Kategorie und fremdem Parent.
  - Dev- oder Staging-Abnahme mit zwei getrennten Municipalities.
- Nachweisstatus: geplant
- Ausgeführte Evidenz und Ergebnis: noch offen
- Offene Nachweislücken: Zielumgebung und Management-Testcredentials müssen festgelegt werden.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

### INV-02: Inaktive Kategorien bleiben auf die Management-Sicht begrenzt

- Kritikalität: hoch
- Geltungsbereich: Kategorienroute und alle bestehenden Content-Kategorieauswahlen.
- Verletzungsszenarien: parameterloses GET verwendet versehentlich `includeInactive: true`; Cache oder Client teilt Management-Daten mit Auswahl-Consumern.
- Prävention: getrennte, explizite View-Semantik und getrennte Query-Dokumente beziehungsweise Operationen.
- Erkennung: Contract- und Consumer-Regressionstests für parameterloses GET und Management-GET.
- Recovery: Management-Sicht deaktivieren; bestehender Active-only-Pfad bleibt kompatibel.
- Geplante direkte Evidenz:
  - Service- und Route-Tests für beide Views.
  - Unit-Tests der Kategorie-Multiselects mit deaktivierten Kategorien.
- Nachweisstatus: lokal nachgewiesen
- Ausgeführte Evidenz und Ergebnis: Route-Test „loads the explicit management view without changing the active-only read“ erfolgreich; bestehender Active-only-Pfad blieb unverändert.
- Offene Nachweislücken: Zielumgebungsabnahme bleibt offen.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

### INV-03: Ein Save verliert keine nicht ausdrücklich entfernten Datentypen

- Kritikalität: hoch
- Geltungsbereich: Registry-Projektion, Formularzustand, Save-Input und Response-Mapping.
- Verletzungsszenarien: gespeicherter Typ fehlt im aktuellen Registry-Snapshot; Plugin ist deaktiviert; Legacy-ID ist unbekannt; Formreset verwirft unavailable-Werte.
- Prävention: gespeicherte Werte sind Teil des kanonischen Formzustands, bleiben sichtbar und werden bis zur expliziten Entfernung erneut gesendet.
- Erkennung: Roundtrip-Tests mit bekannten, Legacy- und unbekannten gespeicherten Werten.
- Recovery: Mutation bei unvollständigem Formzustand blockieren; Snapshot neu laden.
- Geplante direkte Evidenz:
  - API-/Formtests in `packages/plugin-categories/tests`.
  - Adaptertest, der Reihenfolge, Deduplizierung und unbekannte Werte prüft.
- Nachweisstatus: lokal teilnachgewiesen
- Ausgeführte Evidenz und Ergebnis: API-Normalisierung erhält Datentypen und Timestamps; Formularlogik erhält nicht auswählbare gespeicherte Werte; fokussierter App-Adaptertest bestätigt die Trennung von Mainserver-Wert und lokalisiertem Label.
- Offene Nachweislücken: vollständiger Roundtrip mit einem real unbekannten Mainserver-Typ in der Zielumgebung bleibt offen.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

### INV-04: Hierarchie- und Statusänderungen werden atomar und nachvollziehbar angewendet

- Kritikalität: kritisch
- Geltungsbereich: Reparenting, Root-Verschiebung und Active-Kaskade.
- Verletzungsszenarien: Selbstbezug, Nachfahre als Parent, stale Parent-Auswahl, partielle Statuskaskade, falsche Erfolgsmeldung.
- Prävention: Clientfilter als UX-Hilfe, vollständiger Save-Input, Mainserver-Transaktion und verbindliche `affectedDescendantIds`.
- Erkennung: negative Zyklus-/Tenant-Tests, Kaskaden-Roundtrip und Re-Read nach Erfolg.
- Recovery: bei fachlichem Fehler bleibt der bisherige Snapshot erhalten; bei bestätigtem Erfolg wird ausschließlich neu geladen.
- Geplante direkte Evidenz:
  - Unit- und Contract-Tests für Self-/Descendant-/Foreign-Parent.
  - Integrationstest für Statuswechsel mit mehreren Hierarchieebenen.
  - UI-Test für Kaskadenbestätigung und Ergebnisfeedback.
- Nachweisstatus: lokal teilnachgewiesen
- Ausgeführte Evidenz und Ergebnis: Komponententest für explizite Kaskadenbestätigung und Route-/Parsertests für vollständige Save-Inputs erfolgreich.
- Offene Nachweislücken: reale Mainserver-Kaskade muss in einer Zielumgebung verifiziert werden.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

### INV-05: Löschen entfernt niemals implizit Kinder oder referenzierte Daten

- Kritikalität: kritisch
- Geltungsbereich: Delete-Route, Adapter und Bestätigungsdialog.
- Verletzungsszenarien: Usage wird ignoriert, fachlicher Payloadfehler als HTTP-Erfolg behandelt, rekursiver lokaler Fallback.
- Prävention: ausschließlich `deleteCategory`, Erfolg nur mit `deletedCategoryId` und leerer Fehlerliste, kein alternativer Delete-Pfad.
- Erkennung: Tests für jede Usage-Kategorie und konkurrierend hinzugefügte Referenz.
- Recovery: Kategorie bleibt bestehen; aktuelle Usage wird angezeigt und kann nach externer Bereinigung erneut geprüft werden.
- Geplante direkte Evidenz:
  - Adapter-/Route-Tests für `CATEGORY_IN_USE`, `CATEGORY_NOT_FOUND` und Erfolg.
  - UI-Test für strukturierte Usage-Darstellung.
  - Dev-/Staging-Negativtest mit Kind und referenziertem Inhalt.
- Nachweisstatus: lokal teilnachgewiesen
- Ausgeführte Evidenz und Ergebnis: API- und Komponententests erhalten und zeigen alle strukturierten Usage-Zahlen; fachliche Payloadfehler werden nicht als Mutationserfolg normalisiert.
- Offene Nachweislücken: konkurrierend entstehende Referenz und reale Mainserver-Blockade müssen in der Zielumgebung geprüft werden.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

### INV-06: Jede Mutation erfordert exakt ihre eigene Studio-Action

- Kritikalität: kritisch
- Geltungsbereich: UI-Verfügbarkeit und Serverausführung.
- Verletzungsszenarien: `categories.read` erlaubt Save, Create erlaubt Update, ausgeblendeter Button ersetzt Serverprüfung.
- Prävention: feste Methoden-/Action-Matrix und erneute Autorisierung im Serverdispatcher.
- Erkennung: vollständige Positiv-/Negativmatrix über Read/Create/Update/Delete.
- Recovery: Denial vor Upstream-Aufruf; keine fachliche Mutation.
- Geplante direkte Evidenz:
  - Route-Tests, die je Methode jede falsche beziehungsweise fehlende Action ablehnen.
  - UI-Tests für unabhängig sichtbare Aktionen.
  - Audit-/Logtest für die tatsächlich geprüfte Action.
- Nachweisstatus: lokal teilnachgewiesen
- Ausgeführte Evidenz und Ergebnis: Route-Tests belegen getrennte Actions für Read, Create, Update und Delete sowie Nichtaufruf des Services bei lokalem Denial; der Komponententest belegt unabhängige Aktionsverfügbarkeit.
- Offene Nachweislücken: vollständige Positiv-/Negativmatrix und Audit-/Lognachweis bleiben offen.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

### INV-07: Ein unklarer Create-Ausgang löst keinen blinden zweiten Upstream-Aufruf aus

- Kritikalität: hoch
- Geltungsbereich: Browser-Create, Kategorienroute und Aufruf von `saveCategory`.
- Verletzungsszenarien: Die Upstream-Mutation war erfolgreich, aber die Antwort geht verloren; der Benutzer oder Client wiederholt Create.
- Prävention: ein pro Anlegeversuch stabiler `Idempotency-Key` und Wiederverwendung des vorhandenen Host-Reservierungs-, Payload-Bindungs- und Replay-Pfads vor dem Upstream-Aufruf. Nur terminal gespeicherte Ergebnisse werden replayed; eine nichtterminale Reservation wird nicht als sicher wiederholbar behandelt.
- Erkennung: Route-Tests für Reservation, terminales Replay, nichtterminalen Ausgang, Payload-Konflikt und nicht verfügbare Idempotenz-Persistenz.
- Recovery: terminales Replay mit demselben Schlüssel oder Management-Re-Read vor jeder neuen Create-Entscheidung; kein automatischer Retry einer nichtterminalen Reservation.
- Geplante direkte Evidenz:
  - API-Test, dass der Client denselben Schlüssel für den Retry desselben Anlegeversuchs verwendet.
  - Route-Test, dass ein terminales Replay kein zweites `saveCategory` ausführt, eine nichtterminale Reservation einen Re-Read verlangt und ein abweichender Payload fail-closed kollidiert.
- Nachweisstatus: lokal nachgewiesen
- Ausgeführte Evidenz und Ergebnis: Service-Test verhindert Retry nach unklarem Mutationstransportfehler; Route-Tests belegen Reservation und terminales Replay ohne zweiten Upstream-Aufruf; Komponententest belegt stabilen Schlüssel beim Retry desselben Anlegeversuchs und Management-Re-Read vor der Retry-Entscheidung.
- Offene Nachweislücken: Verhalten mit produktiver Idempotenz-Persistenz bleibt Teil der Zielumgebungsabnahme.
- Restrisiko und Entscheidung: vor Merge nicht akzeptiert.

## Failure-Mode- und Evidenzmatrix

| Fehler-/Konkurrenzfall                               | Betroffene Invarianten | Erwartetes Ergebnis                                                      | Evidenz                     | Status  |
| ---------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------ | --------------------------- | ------- |
| Fremde Kategorie- oder Parent-ID                     | INV-01, INV-04         | Fail-closed ohne fremde Metadaten oder Upstream-Write                    | Route-/Integrationstest     | geplant |
| Management-Rolle fehlt upstream                      | INV-01, INV-06         | Getrennter Readiness-/Forbidden-Fehler, kein Active-only-Fallback        | Contract- und Umgebungstest | geplant |
| Registry-Typ fehlt nach dem Öffnen                   | INV-03                 | Gespeicherter Wert bleibt im Save-Input                                  | Form-Roundtrip-Test         | geplant |
| Kategorie wird zwischen Snapshot und Save verschoben | INV-04                 | Mainserver entscheidet atomar; UI lädt bestätigten Zustand neu           | Integrationstest            | geplant |
| Referenz entsteht unmittelbar vor Delete             | INV-05                 | Delete wird blockiert; keine Referenz wird entfernt                      | Integrationstest            | geplant |
| Response enthält HTTP 200 mit Payloadfehler          | INV-04, INV-05         | Kein Erfolgsfeedback; stabiler fachlicher Fehler                         | Adaptertest                 | geplant |
| Benutzer besitzt nur `categories.read`               | INV-06                 | Management-Read möglich, alle Mutationen serverseitig abgelehnt          | Permission-Matrix           | geplant |
| Management-Reload scheitert nach bestätigtem Save    | INV-03, INV-04         | Save bleibt als erfolgreich bestätigt; Reload ist wiederholbar           | UI-/Adaptertest             | geplant |
| Create-Antwort geht nach Upstream-Erfolg verloren    | INV-07                 | Terminales Replay oder fail-closed Re-Read vor neuer Create-Entscheidung | API-/Route-Test             | geplant |

## Freigabe der Implementierung

- [x] Kritische Invarianten, Systemgrenzen und Failure Modes sind beschrieben.
- [x] Jede kritische Invariante besitzt eine konkrete Nachweisplanung oder eine ausdrücklich akzeptierte Restrisikoentscheidung.
- [x] Es existieren keine unbekannten oder unzugeordneten kritischen Planungs- oder Modelllücken.
- [x] Verbleibende Nachweislücken sind transparent als noch auszuführende Evidenz ausgewiesen.

## Merge-Entscheidung

- [ ] Jede kritische Invariante besitzt ausgeführte direkte Evidenz für den exakten HEAD oder eine ausdrücklich akzeptierte Restrisikoentscheidung.
- [ ] Jeder nicht-terminale Zustand besitzt einen Konvergenz- oder Recovery-Pfad.
- [ ] Alle bekannten Eintritts-, Dispatch- und Execution-Grenzen sind erfasst.
- [ ] Teilfehler, Konkurrenz, Prozessabbruch und Wiederanlauf sind bewertet.
- [ ] Nicht automatisierbare Annahmen sind reproduzierbar geprüft oder als Restrisiko entschieden.
- [ ] Es existieren keine unbekannten oder unzugeordneten Nachweislücken.
