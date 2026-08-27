## Context

Studio verwendet für persönliche Accounts, Einzel- und Bulk-Reprovisionierung sowie organisationsgebundene technische Accounts denselben internen Mainserver-Provisioning-Port. Der externe Mainserver interpretiert `role` ausschließlich bei der Neuanlage; fehlt das Feld, gilt weiterhin dessen Default `restricted`. Die neue Rolle `studio` verleiht dieselben fachlichen API-/GraphQL-Verwaltungsrechte wie `admin`, sperrt aber den interaktiven Login in die Legacy-Mainserver-Oberfläche.

Die bestehenden Aussagen, dass der technische Organisationsaccount keine Rollen erhält, betreffen Studio-/Keycloak-Rollen, Gruppen und Einladungen. Sie verbieten nicht die Mainserver-Initialrolle im externen Provisioning-Payload.

## Goals / Non-Goals

- Goals:
  - Alle von Studio neu angelegten persönlichen und organisationsgebundenen Mainserver-Nutzer initial mit `studio` provisionieren.
  - Den gemeinsamen Transportvertrag klein und eindeutig halten.
  - Idempotenz, Tenant-Isolation und sichere Fehlerbehandlung explizit absichern.
- Non-Goals:
  - Bestehende Mainserver-Nutzer automatisch migrieren.
  - Mainserver-Rollen in Keycloak oder im lokalen Studio-IAM spiegeln.
  - Einen frei wählbaren Rollenparameter in Studio-APIs einführen.
  - Mainservers Defaultrolle `restricted` verändern.

## Decisions

- Decision: Der gemeinsame interne Provisioning-Port serialisiert fest `role: "studio"`.
  - Rationale: Alle produktiven Studio-Aufrufer benötigen dieselbe Mainserver-Initialrolle. Ein optionaler oder frei wählbarer Parameter würde Flexibilität vortäuschen, die fachlich nicht existiert.
  - Alternatives considered: Ein optionales `initialRole` pro Aufrufer wurde verworfen, weil dadurch ein Studio-Flow versehentlich wieder auf `restricted` zurückfallen könnte.
- Decision: Reprovisionierungsaufrufe senden denselben Payload erneut.
  - Rationale: Der Mainserver wertet `role` nur bei Neuanlage aus und bewahrt bestehende Rollen bei idempotenter Wiederholung.
- Decision: `403` und `422` bleiben fachlich unterscheidbare, nicht wiederholbare Ablehnungen.
  - Rationale: Cross-Tenant-Verstöße und Vertragsfehler dürfen nicht als vorübergehende Upstream-Ausfälle erscheinen. Öffentliche Studio-Fehler bleiben dabei sicher und exponieren keine Secrets oder unkontrollierten Upstream-Details.

## Risks / Trade-offs

- Ein veralteter Mainserver ohne Unterstützung für `studio` kann mit `422` antworten. Die Runtime behandelt dies als deterministischen Konfigurations-/Vertragsfehler; Rollout und Mainserver-Version müssen deshalb koordiniert werden.
- Bestehende `restricted`-Nutzer bleiben ohne automatische Migration unverändert. Das ist eine bewusste Produktentscheidung und muss betrieblich sichtbar dokumentiert werden.
- Der zentrale feste Payload koppelt Studio bewusst an den vereinbarten Mainserver-Rollennamen. Der Vertrag ist klein, verhindert dafür aber divergierende Caller-Konfigurationen.

## Migration Plan

1. Mainserver-Version mit Rolle `studio` und idempotentem Provisioning-Vertrag bereitstellen.
2. Studio-Transport, Tests und Dokumentation gemeinsam ausliefern.
3. Neue Provisionierungen beobachten; bestehende Nutzer unverändert lassen.
4. Bei `422` den Mainserver-Rollout beziehungsweise den externen Vertrag prüfen, nicht automatisch auf `restricted` zurückfallen.

## Open Questions

Keine offenen Produktentscheidungen für den vereinbarten Scope.

