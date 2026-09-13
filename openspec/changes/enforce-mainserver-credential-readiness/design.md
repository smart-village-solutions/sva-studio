## Context

Persönliche Credentials liegen in Keycloak, organisatorische verschlüsselt in
der Studio-Datenbank. Die vorhandene Auth-Runtime löst beide Quellen bereits
principal- und policygebunden auf und erzeugt bei Erfolg einen Fingerprint.
Sie verliert jedoch die Unterscheidung partieller Attribute vor den Consumern.

Create und Reprovisionierung behandeln den Keycloak-Write als Abschluss. Die
Projection persistiert Fehlerzeitpunkt und Fehlercode, berücksichtigt diese
Information aber nicht bei ihrem 60-Sekunden-Scheduler.

## Decision

### Bestehenden Reader präzisieren

Der vorhandene Credential-Reader bleibt die einzige fachliche Quelle. Seine
discriminated union unterscheidet:

- `ready`: vollständige Credentials; nur dieser interne Zweig trägt die Werte
  und einen Fingerprint;
- `missing`: beide erforderlichen Werte fehlen;
- `partial`: ein erforderliches Attribut fehlt;
- `stale`: ein Read-back stimmt nicht mit einer ausdrücklich erwarteten
  Credential-Version überein;
- `unavailable`: Keycloak oder Datenbank ist nicht belastbar lesbar.

Legacy-Attribute bleiben nur als vollständig vorhandenes Paar kompatibel.
Browser, Logs, Audit und Reports erhalten ausschließlich Status, Quelle,
fehlende Attributnamen und Fingerprint-Presence.

### Provisionierung erst nach Read-back abschließen

Nach dem bestehenden Keycloak-Write liest Create, Einzel- oder Bulk-
Reprovisionierung die Attribute über den instanzgebundenen Reader zurück. Der
aus der bereits vorliegenden Mainserver-Antwort berechnete erwartete
Fingerprint muss passen. Andernfalls wird Mainserver-Readiness nicht als
erfolgreich ausgewiesen.

Der lokale Account bleibt bestehen. Ein bereits bestätigter Providererfolg
wird nicht als Providerfehler umgedeutet; der stabile Fehlercode beschreibt
den lokalen Read-back-Zustand.

### Projection an der vorhandenen Quellgrenze gaten

Die bestehende Projection-Source-/Binding-Grenze prüft Readiness vor dem ersten
Token- oder GraphQL-Aufruf. Nicht bereite Zustände werden als stabiler Sync-
Fehler persistiert. Vorhandene Snapshots bleiben lesbar; es erfolgt weder
Finalisierung noch Löschabgleich.

Die Mainserver-Fassade bleibt unverändert. Ergibt die Umsetzung, dass das Gate
ohne neue öffentliche Adapter-API nicht zuverlässig möglich ist, stoppt der
Block und das Design wird erneut geprüft.

### Vorhandenen Sync-State für den Cooldown nutzen

Eine pure Fälligkeitsfunktion verwendet `last_error_code`, `last_failed_at`,
Trigger und Uhrzeit. `missing`, `partial` und `stale` werden frühestens nach 15
Minuten erneut geprüft. Transiente Ausfälle behalten den vorhandenen kurzen
technischen Retry. Manueller Refresh darf erneut prüfen, aber niemals das Gate
umgehen.

Es gibt keinen automatischen IAM→Projection-Recovery-Hook. Nach erfolgreicher
Reprovisionierung wird der Zustand beim nächsten manuellen Refresh oder der
nächsten fälligen Scheduler-Probe erkannt.

## Rejected Alternatives

- Nur Logging drosseln: verhindert weder unnötige Aufrufe noch falschen
  Provisioning-Erfolg.
- Tenantweite Readiness: blockiert unbeteiligte Principals und lokale
  Funktionen.
- Neue Retry-Tabelle oder neuer Jobrunner: der vorhandene Sync-State trägt die
  benötigte Fälligkeit bereits.
- Sofortiger Recovery-Intent und neue Metriken: für die Korrektheit von #1332
  nicht erforderlich und daher Follow-up-Scope.

## Liefergrenze

1. Statusmatrix und Provisioning-Read-back implementieren und testen.
2. Projection-Gate und Cooldown implementieren und testen.
3. Bestehende Architekturdokumentation und Mainserver-Runbook präzisieren.

Production-Verifikation und Rollout-Abnahme beginnen erst nach Merge und sind
im separat freizugebenden Folge-Change
`verify-mainserver-credential-readiness-rollout` beschrieben. Zusätzliche
Metriken, Audit-Infrastruktur oder ein automatischer Recovery-Hook werden nur
bei einem konkreten Betriebsbefund als eigener Change vorgeschlagen.
