## 1. Vertrag und Persistenz

- [x] 1.1 Kanonische SSF-Permission-Menge und Claim-Namen festlegen
- [x] 1.2 Gewünschten und bestätigten Projektionszustand tenantgebunden persistieren
- [x] 1.3 Deterministische `authorizationRevision` aus der bestätigten Projektion berechnen
- [x] 1.4 Tenantgebundene Advisory-Lock und wiederaufnehmbare Zwischenzustände
      für den vollständigen externen Reconcile implementieren
- [x] 1.5 Effektive Studio-Permissions plugin-eigen und fail-closed auf
      unveränderte Tenant-Subjects, SSF-Rollen und SSF-Claims abbilden
- [x] 1.6 Effektive, aktive Tenant-Subjects samt SSF-Permission-Allowlist aus
      dem autoritativen Studio-IAM in einem Repeatable-Read-Snapshot lesen
- [x] 1.7 Hostseitige IAM-Quelle und plugin-eigenen Projektions-Reconcile über
      einen expliziten Runtime-Port verbinden

## 2. Keycloak-Projektion

- [x] 2.1 Tenantgebundenen, idempotenten Projektionsadapter mit injiziertem
      SSF-Client-Resolver für den gemeinsamen Tenant-Realm implementieren
- [x] 2.2 Projektion nach jedem Write vollständig zurücklesen und verifizieren
- [x] 2.3 Den in `add-ssf-tenant-administration` vorgesehenen
      tenantlokalen SSF-Client produktiv auflösen
- [x] 2.4a Lock-Schlüssel normalisieren und Primärfehler bei Unlock-Fehlern erhalten
- [x] 2.4b Externe Keycloak-Aufrufe mit nachweislich begrenzten Connect- und
      Read-Laufzeiten ausführen
- [x] 2.4c Die pluginseitige SSF-Widerrufsgrenze mit Abbruchsignal und einer
      nachweislich begrenzten Gesamtlaufzeit absichern
- [x] 2.4d Die Laufzeitbegrenzung im produktiven
      SSF-Widerrufsclient bis zum Netzwerktransport durchreichen
- [x] 2.5 Teilfehler, Retry und konkurrierende Läufe im produktiven
      Plugin-Lifecycle fail-closed behandeln

## 3. Token und Session-Lifecycle

- [x] 3.1 Mapper und Benutzerattribute für die verifizierte Revision im
      tenantlokalen SSF-Client-Scope idempotent projizieren
- [x] 3.2 Die Tokenausstellung ausschließlich des betroffenen SSF-Clients vor
      dem ersten Projektions-Write sperren und nach bestätigtem Read-back
      wieder freigeben; Studio-Client und Realm-Session bleiben
      unangetastet
- [ ] 3.3 Benutzertokenclaim, Host-Readiness und Runtime-Antwort revisionsgleich prüfen
- [x] 3.4 Projektionsreadiness vom optionalen Session-Widerruf entkoppeln und
      alte Access-Token-Rechte im Produktivbetrieb durch eine maximale
      Tokenlaufzeit von 15 Minuten begrenzen

## 4. Betrieb und Nachweise

- [ ] 4.1 Audit, niedrig-kardinale Metriken und getrennte Readiness-Ursachen ergänzen
- [ ] 4.2 Zwei-Tenant-, Mismatch-, Lock-/Unlock-, Timeout-, Client-Sperr-,
      Ausfall- und Retry-Tests ergänzen
- [ ] 4.3 Staging-E2E für Projektion → Token → Runtime sowie maximal
      15-minütige Access-Token-Laufzeit an exakten Digest binden
- [ ] 4.4 Produktive Runtime-Freigabe erst nach grünem Staging-Nachweis aktivieren

## 5. Verbindliche Reihenfolge für den verbleibenden Lieferpfad

Der MVP-Slice bis 5.3 verbindet jetzt echte Studio-Permissions mit dem
tenantlokalen SSF-Client. Audit-Ausbau, zusätzliche Statusoberflächen,
Komfortdiagnosen und optionale Sitzungswiderrufe bleiben nachgelagert. Als
nächster Freigabeblock folgen 5.4 und 5.5; der optionale Widerrufsconsumer
ersetzt weder den Tokenlaufzeit- noch den gemeinsamen Staging-Nachweis.

- [x] 5.1 Den minimalen Studio→SSF-Widerrufsvertrag sowie die
      Deploymentkonfiguration für eine separat verwaltete technische Identität
      `sva-studio-ssf-control-plane` festlegen; keine Plugin-SDK-Erweiterung und
      keine automatische Root-Client-Provisionierung einführen
- [x] 5.2 Einen kleinen SSF-HTTP-Consumer mit injizierbarem
      Client-Credentials-Provider, kanonischer Tenantbindung,
      deterministischem Idempotency-Key, Timeout, Fehlerklassifizierung und
      simuliertem Provider implementieren. Retries bleiben Eigentum des
      vorhandenen Lifecycles; danach 2.4d auf Studio-Seite abschließen
- [x] 5.3 Den vorhandenen Reconciler als schmalen Beitrag an den bestehenden
      Plugin-Lifecycle anbinden und 2.5 abschließen; bis dahin keine
      zusätzlichen Jobtypen oder Host-Abstraktionen einführen
- [ ] 5.4 Danach den bestätigten Projektionsstand als produktiven
      Host-Readiness-Provider anbinden, Tokenclaim, Host-Bindung und
      Runtime-Antwort revisionsgleich testen und 3.3 abschließen
- [ ] 5.5 Tenantlokalen SSF-OIDC-Client und exakte Callback-URIs im separaten
      Tenant-Administrations-Change umsetzen; bis dahin bleibt das produktive
      Enablement gesperrt
- [ ] 5.6 Optional: Der spätere SSF-Provider implementiert den vereinbarten
      authentifizierten, idempotenten Sammelwiderruf für exakt einen Tenant,
      ohne die Projektionsreadiness davon abhängig zu machen
