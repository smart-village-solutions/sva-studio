# Studio Release Learnings 2026-04-28

## Zusammenfassung

Der Studio-Release vom 28. April 2026 hat drei unterschiedliche Klassen von Erkenntnissen geliefert:

1. ein echter fachlicher Fehler im Bootstrap-Pfad,
2. zwei vermeidbare False-Negatives im Verify-/Release-Wrapper,
3. mehrere Stellen, an denen der Rollout robuster und schlanker werden kann, ohne die eigentlichen Sicherheits- und Datenbank-Gates aufzugeben.

Der wichtigste operative Befund ist:

- `migrate` und `bootstrap` als dedizierte Temp-Job-Stacks sind der richtige Pfad und müssen bleiben,
- das fachliche Risiko lag diesmal nicht im Swarm-Rollout, sondern im Bootstrap-SQL-Vertrag,
- der finale `app-only`-Rollout war live gesund, wurde aber vom Wrapper zu früh als Fehler markiert.

## Was wir konkret gelernt haben

### 1. Der Bootstrap-Vertrag muss jede neue Schema-Pflicht explizit mitziehen

Migration `0031` hat `iam.instances.tenant_admin_client_id` auf `NOT NULL` gezogen. Der Bootstrap-Reconcile hat diesen Wert aber noch nicht mitgeschrieben.

Folge:

- `migrate` lief grün,
- `bootstrap` brach ab,
- der Live-Stack blieb zwar unverändert,
- aber der Release war blockiert.

Lehre:

- bei jeder Migration, die `NOT NULL`, neue Pflichtfelder oder Upsert-Verträge einzieht, muss der zugehörige Bootstrap-/Seed-/Reconcile-Pfad in derselben Änderung mitgeprüft werden,
- dafür brauchen wir gezielte Regressionstests auf die erzeugte Bootstrap-SQL, nicht nur generische Runtime-Tests.

### 2. Der lokale Operator-Pfad ist richtig, die Terminologie war aber missverständlich

`pnpm env:release:studio:local` deployt nicht lokal, sondern startet den kanonischen lokalen Operator für den Remote-Swarm.

Lehre:

- diesen Unterschied müssen die Runbooks noch expliziter benennen,
- `env:deploy:studio` und `env:migrate:studio` bleiben Low-Level-Pfade für Diagnose und Recovery, nicht der primäre Bedienpfad.

### 3. Das Health-Gate nach dem Cutover war zu aggressiv

Direkt nach dem `app-only`-Rollout schlugen die Wrapper-Probes kurz mit `404` fehl:

- `app-db-principal`
- Tenant-Redirect-Probe

Wenige Sekunden später waren dieselben Endpunkte wieder gesund:

- `/health/ready` lieferte `200`
- `/auth/login` lieferte den korrekten Tenant-Realm-Redirect
- `pnpm env:smoke:studio` lief grün

Lehre:

- wir hatten keinen echten Produktionsfehler,
- sondern ein Timing-Problem zwischen Task-Wechsel, Ingress-Propagation und erstem externen Verify-Lauf.

### 4. Die Verify-Evidenz ist inhaltlich vorhanden, aber lokal nicht auffindbar

`Studio Image Verify` lief für das neue Digest erfolgreich in GitHub, der lokale `precheck` meldete trotzdem weiter:

- `image_verify_evidence_missing`

Ursache:

- der `precheck` sucht nur im lokalen Verzeichnis `artifacts/runtime/image-verify`,
- die GitHub-Artefakte werden nicht als gleichwertige Evidenz aufgelöst.

Lehre:

- die Evidence-Suche ist aktuell zu eng an einen lokalen Operator-Artefaktpfad gebunden,
- das erzeugt Warnrauschen, obwohl das eigentliche Verify-Gate grünte.

### 5. Der Verify-Workflow hat einen echten Shell-Bug bei `image_tag`

`Studio Image Verify` scheiterte zunächst nicht am Image, sondern an der `tr`-Sanitisierung für `image_tag`.

Lehre:

- Workflow-Helfer müssen auf dem tatsächlichen Runner-Verhalten getestet werden,
- Metadaten wie `image_tag` dürfen das eigentliche Verify-Gate nicht zu Fall bringen.

## Was wir nicht entschlacken sollten

Diese Prüfungen haben echten Wert und sollten bleiben:

- `image-digest` als verbindlicher Release-Eingang
- `migrate` und `bootstrap` als dedizierte Temp-Job-Stacks
- Schema-Guard und Bootstrap-Evidenz
- Live-Spec-/Ingress-Konsistenz vor dem Rollout
- `app-db-principal` als Nachweis aus Sicht des echten Runtime-Users
- Tenant-Redirect-Smokes gegen echte Tenant-Hosts

Gerade die heutige Ursache zeigt, dass die Kombination aus Schemaänderung, Bootstrap und Runtime-Principal keine künstliche Überprüfung war, sondern den echten Fehler eingegrenzt hat.

## Was wir sinnvoll reduzieren oder umklassifizieren können

### 1. Post-Cutover-Healthchecks enthärten

Statt den Deploy direkt beim ersten `404` zu verwerfen, sollte der Wrapper:

- ein kurzes Settling-Fenster nach dem Stack-Update geben,
- fehlschlagende externe Probes in diesem Fenster aktiv wiederholen,
- erst nach mehreren konsistenten Fehlschlägen auf `error` gehen.

Empfehlung:

- erste Health-/Tenant-Probes nicht hart sofort werten,
- stattdessen `retry with bounded backoff` für 30 bis 90 Sekunden.

### 2. Verify-Evidenz nur noch als hartes Gate oder gar nicht

Wenn `Studio Image Verify` in GitHub verbindlich erfolgreich war, sollte `precheck` nicht zusätzlich einen lokalen Artefaktpfad als zweite Wahrheit verlangen.

Empfehlung:

- entweder GitHub-Evidenz sauber auflösen,
- oder die lokale Artefaktsuche für Operator-Läufe nur noch als `info` statt `warn` behandeln.

### 3. Observability-Probe weiter als `warn`, nicht als Release-Blocker

Die fehlenden frischen Loki-Ereignisse waren heute kein Root Cause des Releases.

Empfehlung:

- für `studio` in der aktuellen Testphase Observability weiter als Diagnose-Signal führen,
- aber nicht in die gleiche Gewichtung wie Schema-, Bootstrap- oder Live-Readiness-Gates ziehen.

### 4. Low-Level- und kanonische Pfade klarer trennen

Der Prozess ist nicht in der Anzahl der Kernschritte zu fett, aber in der Bedienoberfläche noch zu vieldeutig.

Empfehlung:

- `env:release:studio:local` als Standard noch klarer dokumentieren,
- Low-Level-Kommandos explizit als Diagnose-/Recovery-Pfad markieren,
- Release-Dokumentation an der Wahrheit des echten Operator-Ablaufs ausrichten.

## Konkrete Nacharbeiten

1. Release-Wrapper: Post-Cutover-Settling und Retry-Fenster für externe Health-/Tenant-Probes einführen.
2. `precheck`: GitHub-Verify-Evidenz als gleichwertige Quelle akzeptieren oder lokale Artefaktsuche auf `info` herabstufen.
3. GitHub-Workflow `Studio Image Verify`: `image_tag`-Sanitisierung runner-kompatibel korrigieren.
4. Bei künftigen Migrations-PRs einen expliziten Checkpunkt aufnehmen:
   - "Welche Bootstrap-/Seed-/Reconcile-Pfade müssen mitgezogen werden?"

## Einordnung

Das Deployment ist nicht grundsätzlich überprüft, sondern an zwei Stellen noch zu nervös:

- beim Evidence-Lookup,
- beim Health-Gate direkt nach dem Cutover.

Die eigentlichen harten Gates waren heute hilfreich. Entschlackt werden sollte daher vor allem das Warnrauschen und das Timing-Verhalten, nicht die fachlichen Sicherheits- und Datenbank-Prüfungen.
