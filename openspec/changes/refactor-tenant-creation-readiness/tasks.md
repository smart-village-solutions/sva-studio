## 0. Vertrags- und Konfliktklärung

- [x] 0.1 Den Change gegen die aktiven Changes
      `automate-kassel-tenant-ingress`,
      `automate-keycloak-realm-baseline`,
      `add-plugin-tenant-lifecycle` und
      `fix-tenant-iam-doctor-evidence` abgleichen und widersprüchliche
      Aktivierungs- beziehungsweise Realm-Szenarien ausdrücklich auflösen.
- [x] 0.2 Die bestehende Instanz-, Run-, Readiness- und Fehlerprojektion
      inventarisieren und belegen, welche Felder wiederverwendet werden können.
- [x] 0.3 Entscheiden, ob `awaiting_activation` und die fachlichen Klassen
      `provisioning_waiting`/`provisioning_blocked` rein abgeleitet werden können
      oder eine minimale Schemaerweiterung benötigen.
- [x] 0.4 Die verwendete Keycloak-Serviceidentität und deren minimale
      Realm-Listen-, Lese- und Create-Prüfrechte dokumentieren.
- [x] 0.5 Den bisherigen Kasseler Elternlauf auf den gemeinsamen fachlichen
      Tenant-Flow abbilden und ausschließlich seine technischen
      Ingress-/TLS-/Readiness-Capabilities als profilspezifisch markieren.

## 1. Gemeinsame Read-only Verträge

- [x] 1.1 Einen gemeinsamen typsicheren Draft-Vertrag aus den vorhandenen
      Create-Schemas ableiten; keine parallele Payloaddefinition einführen.
- [x] 1.2 Den serverseitigen Draft-Readiness-Vertrag mit getrennten Anlage-,
      Bereitstellungs- und Aktivierungsbefunden implementieren.
- [x] 1.3 Den paginierbaren, durchsuchbaren Realm-Katalog im vorhandenen
      Keycloak-Admin-Pfad ergänzen und die Ausgabe auf auswahlrelevante Daten
      begrenzen.
- [x] 1.4 `master`, reservierte und bereits fremd zugeordnete Realms
      serverseitig als nicht auswählbar klassifizieren.
- [x] 1.5 Realm-Eignung als `ready`, `auto_completable` oder
      `manual_resolution_required` modellieren und mit stabilem Grundcode,
      Auswirkung, Behebung und Folgeprüfung ausgeben.
- [x] 1.6 Unit- und Contract-Tests für Normalisierung, Pagination,
      Autorisierung, Redaction und alle Blockerklassen ergänzen.

## 2. Authoritative Create-Gates

- [x] 2.1 Den Create-Service unmittelbar vor dem Registry-Insert mit derselben
      aktuellen Keycloak-Verfügbarkeits-, Berechtigungs- und Realm-Prüfung
      absichern.
- [x] 2.2 Für `new` abgeleitete Werte, Realm-Abwesenheit und nachgewiesene
      Create-Fähigkeit prüfen, ohne Keycloak im Preflight zu mutieren.
- [x] 2.3 Für `existing` Auswahlstatus, Lesbarkeit, Registry-Zuordnung und
      Realm-Eignung erneut prüfen.
- [x] 2.4 Race- und Negativtests für Keycloak-Ausfall, 401/403,
      Circuit-Breaker, Realm-Kollision, konkurrierende Zuordnung und veralteten
      UI-Preflight ergänzen.
- [x] 2.5 Sicherstellen, dass bei einem Anlageblocker weder Tenant,
      Provisioning-Auftrag noch Audit-Erfolg persistiert werden.

## 3. Fachliche Anlage von Background-Bereitstellung entkoppeln

- [x] 3.1 Den Create-Commit auf Registry-Sollzustand, Audit und den minimalen
      dauerhaften Bereitstellungsauftrag begrenzen.
- [x] 3.2 Modul-Policy-, Lifecycle-, Callback- und sonstige technische
      Folgearbeiten aus der rollbackfähigen fachlichen Anlage lösen, soweit sie
      nicht für einen dauerhaften reparierbaren Auftrag erforderlich sind.
- [x] 3.3 Fehlende Worker-, Queue-, Callback-, Provisioner-, Ingress- und
      Plugin-Fähigkeiten read-only ermitteln und als wartend, blockiert oder
      unbekannt projizieren.
- [x] 3.4 Post-Commit-Wake-up-Fehler dauerhaft sichtbar machen und über den
      vorhandenen Claim-/Recovery-Pfad heilbar halten.
- [x] 3.5 PostgreSQL-Integrationstests für erfolgreichen Create bei fehlender
      Background-Fähigkeit, atomaren Mindest-Commit, Crash-Grenzen und
      Idempotenz ergänzen.
- [x] 3.6 Falls eine Migration nötig ist, vorab
      `docs/development/studio-db-schema-final.sql` und
      `docs/development/studio-db-schema.md` prüfen und beide im selben
      Lieferabschnitt aktualisieren.

## 4. Eigentumssicherer Bestands-Realm

- [x] 4.1 Ownership- und Instanzbindungsregeln für Login-Client,
      Tenant-Admin-Client, Plugin-Clients, Mapper, Studio-Rollen und
      Tenant-Admin festlegen.
- [x] 4.2 Vorhandene gleichnamige Artefakte ohne eindeutigen Nachweis als
      manuellen Konflikt behandeln; bloße Namensgleichheit darf keine Übernahme
      erlauben.
- [x] 4.3 Den read-only Änderungsplan auf ausschließlich fehlende oder
      eindeutig Studio-eigene Artefakte begrenzen.
- [x] 4.4 Fremde Clients, Rollen und Benutzer sowie IdP, Federation, SMTP und
      realmweite Sicherheitsrichtlinien aus automatischen Bestands-Realm-
      Mutationen ausschließen.
- [x] 4.5 Einen versionierten Plan-Fingerprint erzeugen und Execute gegen
      geänderten Sollzustand, Readback, Ownership und Vertragsversion
      fail-closed sperren; nachgewiesene eigene Schritte getrennt vom
      unveränderten Freigabe-Fingerprint als Fortschritt erhalten.
- [x] 4.6 Keycloak-Adapter-, Plan- und Execution-Tests für fehlende, eigene,
      fremde, unvollständige und widersprüchliche Artefakte ergänzen.

## 5. Provisioning und ausschließlich manuelle Aktivierung

- [x] 5.1 Worker-Preflight, bestätigten Plan, Mutation und aktuellen
      Postflight als getrennte, korrelierte Phasen führen.
- [x] 5.2 Den Kasseler `activate`-Worker-Schritt entfernen und den
      Elternlauf nach vollständiger technischer Abnahme in
      `awaiting_activation` überführen.
- [x] 5.3 Alle produktiven Statusschreiber prüfen und automatisches Setzen von
      `active` außerhalb der kritischen Benutzeraktion entfernen.
- [x] 5.4 Die Aktivierungs-Challenge an Instanzrevision sowie aktuelle
      technische Readiness-Evidenz und den Akteur binden. UI behält Session,
      CSRF und Fresh-Reauth; MCP behält Service-Account und Einmal-Challenge
      gemäß ADR-047. Beide prüfen denselben fachlichen Aktivierungsvertrag.
- [x] 5.5 Serverseitig unmittelbar vor Aktivierung Keycloak-Postflight,
      Secrets, OIDC-Konfiguration (Issuer, Redirect-/Callback-URLs, PKCE),
      Ingress/TLS, Tenant-IAM, Modul-Readiness und blockierende manuelle
      Nacharbeiten über bestehende serverseitige Readbacks und Probes prüfen.
      Nur vor Aktivierung ausführbare technische Prüfungen verwenden; kein
      interaktiver Login-/Gateway-Nachweis, kein Sonderzugang und keine
      nachgelagerte Browserabnahme als Tenant-Prozessschritt.
- [x] 5.6 Unit-, Service- und Integrationstests für jeden offenen,
      veralteten und erfolgreichen Aktivierungszustand ergänzen.
- [x] 5.7 Für Standard- und Kassel-Profil dieselbe Contract-Suite ausführen
      und belegen, dass Kassel weder Create-Gates, Fehlerklassen, Retry-Regeln
      noch die manuelle Aktivierung umgeht.

## 6. Fehler, Remediation und sichere Retries

- [x] 6.1 Den bestehenden Fehlervertrag optional um Feld/Schritt, Auswirkung,
      Behebung, Zuständigkeit, Folgeprüfung, Retry-Klasse und Run-Korrelation
      erweitern.
- [x] 6.2 Providertexte, PII und Secrets an jeder API-, Persistenz-, Log- und
      MCP-Grenze redigieren.
- [x] 6.3 Unbekannte Fehler standardmäßig als nicht retrybar klassifizieren
      und mit sicherer Diagnoseanweisung sowie Vorgangskennung ausgeben.
- [x] 6.4 Automatische und manuelle Retries an explizite schrittbezogene
      Codes und persistierte Commit-Evidenz binden.
- [x] 6.5 Den Wiederaufnahme-Schritt aus dem ersten nicht nachgewiesenen,
      sicher idempotenten Schritt ableiten und gültige Teilerfolge erhalten.
- [x] 6.6 Fault-Injection-Tests nach jedem externen Write und an allen
      Commit-Grenzen ergänzen; insbesondere Write vor Quittung mit eindeutig
      eigenem Effekt, fremder Drift und nicht zuordenbarem Zielzustand prüfen.
      Unklare Secret-Rotation und Passwort-Reset bleiben ohne blinden Retry.

## 7. Instanz-UI

- [x] 7.1 Den Bestands-Realm-Freitext durch eine zugängliche, durchsuchbare
      Combobox für `Nutzer-Datenbank (Keycloak-Realm)` mit sichtbaren,
      begründet deaktivierten Einträgen ersetzen.
- [x] 7.2 Alle vorausgehenden Wizard-Schritte beim Submit erneut validieren
      und den stillen `authRealm = instanceId`-Fallback auf `new` begrenzen.
- [x] 7.3 Pflichtfelder und Secret-Regeln mit dem serverseitigen Vertrag und
      dem SOLL-Dokument vereinheitlichen.
- [x] 7.4 Fehler feldbezogen mit Fokusführung, `aria-invalid`,
      `aria-describedby` und einer verlinkten Zusammenfassung darstellen.
- [x] 7.5 In der Review-Stufe Anlage-, Bereitstellungs- und
      Aktivierungsblocker einschließlich Auswirkung und Behebung anzeigen.
- [x] 7.6 Provisioning nur für einen aktuellen bestätigbaren Plan,
      Retry nur bei `retryable` und Aktivierung nur bei serverseitig erlaubter
      nächster Aktion anbieten.
- [x] 7.7 Die ungesteuerte Aktivierungsaktion aus der Instanzübersicht
      entfernen.
- [x] 7.8 Komponenten-, Accessibility- und Browser-Tests für Realm-Auswahl,
      Feldfehler, Blockerklassen, Retry und Aktivierung ergänzen.
- [x] 7.9 Den gemeinsamen vierstufigen Flow `Instanz`,
      `Nutzer-Datenbank (Keycloak-Realm)`, `Erster Administrator` und
      `Prüfen und anlegen` umsetzen; technische Details im selben Flow
      progressiv offenlegen.
- [x] 7.10 Ableitbare technische Werte aus dem Standardformular entfernen und
      read-only unter `Technische Details` anzeigen; das Bestands-Secret erst
      in der zuständigen sicheren Aktion erfassen oder abgleichen.
- [x] 7.11 Die Studio-Instanz aus dem Umgebungskontext read-only als
      `Smart Village App` oder `KasselDIALOG` anzeigen und keinen
      Studio-Instanz-Wähler einführen.
- [x] 7.12 Nach Create direkt in das gemeinsame Einrichtungscockpit wechseln
      und die separate Setup-Seite samt Route nach Übernahme ihrer
      verbleibenden Fähigkeiten entfernen; das bestehende normative
      Admin-Bootstrap-Requirement durch das MODIFIED-Delta ersetzen.
- [x] 7.13 Workflow-, Execute-, Preflight-, Plan- und Keycloak-Statuskarten zu
      einer serverseitig gesteuerten nächsten Hauptaktion mit
      `Erneut prüfen` und progressiven technischen Details zusammenführen;
      ersetzte Komponenten im selben Lieferabschnitt löschen.

## 8. MCP

- [x] 8.1 Read-only Tools für Realm-Katalog und Draft-Readiness auf den
      gemeinsamen Serververträgen ergänzen.
- [x] 8.2 Den Create-Prozess so ändern, dass nur serverseitig bestätigte,
      payloadgleiche Idempotenzwiederholungen fortgesetzt werden; generisches
      HTTP 409 bleibt ein Blocker.
- [x] 8.3 Teilfortschritt nach späteren Fehlern mit Instanz-ID, erledigten und
      offenen Schritten, Auswirkung und sicherer nächster Aktion erhalten.
- [x] 8.4 `safeDetails` und Request-ID redigiert bis zum MCP-Fehlervertrag
      transportieren.
- [x] 8.5 Doctor-Readiness vor einer Aktivierungsempfehlung auswerten und die
      kritische Aktivierung weiterhin getrennt challenge-geschützt lassen.
- [x] 8.6 MCP-Contract- und Integrationstests für Realm-Auswahl,
      Keycloak-Ausfall, 409-Klassen, Teilfortschritt, unbekannte Fehler und
      wartende Aktivierung ergänzen.

- [x] 8.7 Bestehenden MCP-Prozess in `create`, `repair` und `adapt` vor
      nicht bestätigten Keycloak-Mutationen anhalten; Plan anzeigen,
      Fingerprint über die vorhandenen Execute-/Reconcile-Verträge prüfen und
      bestehenden Run nach Bestätigung, Timeout und Kanalwechsel weiterlesen.
      Auch nachgelagerte Rollenänderungen dürfen die Planbindung nicht umgehen.
      Negativtests für fremde/veraltete Pläne und doppelte Aufträge ergänzen.

## 9. Systemnachweise und Qualität

- [x] 9.1 Die Invarianten und Failure-Injection-Matrix aus
      `assurance.md` am exakten finalen HEAD mit verlinkter Evidenz aktualisieren.
      Die lokale Evidenz ist im Assurance Case dokumentiert; die SHA-Bindung,
      GitHub-Checks und Review-Threads werden über den kanonischen PR-Snapshot
      für den finalen PR-HEAD nachgewiesen.
- [x] 9.2 Früh die kleinsten betroffenen Unit-, Type- und
      `check:server-runtime`-Gates ausführen; breite Nx-Gates erst nach
      Scope-Messung gemäß `DEVELOPMENT_RULES.md`.
- [x] 9.3 Reale PostgreSQL-Integrationstests für Create, Claim, Retry,
      Evidenzrevision und Aktivierung ausführen.
- [x] 9.4 E2E den New-Realm- und Existing-Realm-Happy-Path sowie alle
      sicherheitskritischen Negativpfade prüfen.
- [x] 9.5 Mit statischer Suche und Tests belegen, dass ausschließlich die
      kritische Aktivierungsaktion `active` setzen kann.
- [x] 9.6 `pnpm check:file-placement` und
      `openspec validate refactor-tenant-creation-readiness --strict` ausführen.

## 10. Architektur, Bedienung und Rollout

- [x] 10.1 `docs/operations/instance-keycloak-provisioning.md` gegen die
      implementierten Verträge prüfen, ohne IST-Abweichungen in das
      SOLL-Dokument zu mischen.
- [x] 10.2 Die arc42-Abschnitte 03, 04, 05, 06, 08, 09, 10 und 11
      aktualisieren oder pro Abschnitt eine begründete Nichtbetroffenheit
      dokumentieren.
- [x] 10.3 Für die geänderten IAM-/Ownership- und Aktivierungsregeln eine ADR
      anlegen beziehungsweise eine bestehende ADR gezielt fortschreiben und in
      Abschnitt 09 verlinken; ADR-047 für kanalgeeignete Bestätigung
      fortschreiben, ohne Browser-Fresh-Reauth auf Maschinen zu übertragen.
- [x] 10.4 Den Konflikt mit `automate-kassel-tenant-ingress` vor Merge
      normativ auflösen, dessen automatischen Aktivierungsabschluss entfernen
      und den Elternlauf in den gemeinsamen Tenant-Flow überführen.
- [ ] 10.5 Dev und Staging über den kanonischen Build-/Promote-Pfad mit
      identischem Image-Digest durch technische Provisioning-Smokes verifizieren.
      Entwicklungsseitige UI-/E2E-Tests bleiben von Betreiberaktionen getrennt;
      keine Browserabnahme pro Tenant verlangen.
      **Operator-Gate:** Nicht ausgeführt; dieser Implementierungsauftrag enthält
      keine Freigabe für Build, Dev-/Staging-Promotion oder produktive Smokes.
- [ ] 10.6 Production erst nach bestätigtem manuellem Aktivierungspfad,
      vollständiger Assurance-Evidenz und expliziter Freigabe promoten.
      **Operator-Gate:** Nicht ausgeführt; Production-Promotion erfordert eine
      separate ausdrückliche Freigabe und einen Staging-bestätigten Digest.
