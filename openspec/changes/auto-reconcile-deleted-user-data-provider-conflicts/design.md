## Context

`recordMainserverDataProviderObservation` behandelt eine exakte Beobachtung weiterhin als Konflikt, sobald ihre gespeicherte Bindung bereits `conflict` ist. Verweist eine konkurrierende Bindung auf einen später endgültig gelöschten Benutzer, bleibt sie aus Auditgründen erhalten und wird bei der Konflikterkennung weiterhin berücksichtigt. Ein erneuter erfolgreicher Aufruf von `/data_provider.json` kann den Zustand deshalb nicht heilen.

Der Identity-Guard läuft vor der eigentlichen Mainserver-Mutation. Eine erfolgreiche Auflösung kann den bereits begonnenen Request daher sicher fortsetzen, ohne einen Provider-Write wiederholen zu müssen.

## Goals

- Eindeutig veraltete persönliche Bindungen anlassbezogen ohne UI-Eingriff aus dem aktuellen Konfliktset entfernen.
- Historische Evidenz und die Trennung zwischen lokaler Historisierung und externem Credential-Widerruf bewahren.
- Bestehende unklare Konflikte weiterhin fail-closed behandeln.
- Ohne Queue, Scheduler, neue Tabelle oder allgemeinen Reconciliation-Workflow auskommen.

## Non-Goals

- Keine Entscheidung über zwei weiterhin handlungsfähige Benutzer oder über Organisationsprincipals.
- Keine automatische Behandlung vorläufiger Löschung oder reversibler Sperrung.
- Keine Upstream-Mutation und kein Account-Rebind.
- Keine Wiederholung einer bereits an den Mainserver gesendeten Content-Mutation.

## Decisions

### Anlassbezogene Auflösung im bestehenden Identity-Guard

Die Auflösung wird nur versucht, nachdem der authentifizierte Identity-Endpunkt für die aktuelle Credential-Version einen DataProvider geliefert und die normale Beobachtung einen Konflikt erkannt hat. Sie läuft im selben Request vor dem Content-Write. Nach Erfolg setzt der Guard den vorhandenen Mutationspfad fort; ein eigener Hintergrundworker wäre für diesen seltenen und kurzen Datenbankvorgang zusätzliche Ownership ohne fachlichen Nutzen.

### Enger Eindeutigkeitsnachweis

Automatische Auflösung ist nur erlaubt, wenn alle folgenden Bedingungen gelten:

1. Der handelnde Principal ist ein aktiver, nicht gesperrter und nicht gelöschter Benutzer der aktuellen Instanz.
2. Identity-Evidenz bestätigt für seine aktuelle Credential-Version exakt den konfliktbehafteten DataProvider.
3. Jede andere aktuelle Bindung dieses DataProviders gehört ebenfalls zu einem Benutzerprincipal.
4. Jeder konkurrierende Benutzer ist entweder endgültig gelöscht oder existiert nach einem abgeschlossenen Hard Delete nicht mehr.
5. Es existiert keine aktuelle konkurrierende Organisationsbindung und kein aktiver, gesperrter, vorläufig gelöschter oder sonst nicht eindeutig klassifizierbarer Benutzer.

Eine leere oder widersprüchliche Datenbankantwort, ein Identity-Fehler oder ein paralleler unklarer Zustand lässt den bestehenden Konflikt unverändert.

### Atomarer Statusübergang ohne Evidenzverlust

Der bestehende tenant- und DataProvider-lokale Advisory-Lock wird wiederverwendet. Innerhalb einer Datenbanktransaktion werden die konkurrierenden Bindungen erneut geladen und klassifiziert. Erst nach erfolgreichem Eindeutigkeitsnachweis werden ihre aktuellen `conflict`-Zeilen auf `historical` mit `superseded_at` gesetzt und die exakte aktuelle Beobachtung auf `verified` gesetzt.

`revoked` wird nicht verwendet, weil die Löschung eines Studio-Accounts keinen externen Widerruf der Mainserver-Credentials beweist. Keine Bindungszeile wird gelöscht oder überschrieben.

### Kein UI-Zustand und kein asynchroner Job

Erfolg ist für den Benutzer bis auf die normal erfolgreiche Mutation unsichtbar. Eine nicht eindeutig mögliche Auflösung liefert weiterhin den bestehenden Fehler `mainserver_data_provider_identity_conflict`. Es gibt keinen neuen Button, Dialog, Pollingzustand oder Scheduler.

### Beobachtbarkeit

Erfolgreiche und abgelehnte automatische Auflösungsversuche erhalten strukturierte, PII-minimierte Signale mit Instanz, gehashtem beziehungsweise bereits vorhandenem Credential-Fingerprint, DataProvider-ID, Anzahl historisierter Bindungen, Ergebnis und sicherem Grundcode. Secrets, Benutzernamen, E-Mail-Adressen und rohe Identity-Antworten werden nicht protokolliert.

## Alternatives Considered

### Auflösung direkt bei Account-Löschung

Das würde den Löschpfad mit Mainserver-Bindungswissen koppeln und nicht alle bereits vorhandenen Konflikte reparieren. Außerdem fehlt dort die frische Identity-Evidenz der verbleibenden Credential-Version.

### Queue oder periodischer Reconciliation-Job

Das würde Retry-, Lease-, Scheduling- und Betriebszustände für einen kurzen, anlassbezogen vollständig entscheidbaren Vorgang einführen. Der erste Speicherversuch bliebe unnötig fehlerhaft.

### Konfliktzeile des gelöschten Accounts löschen oder auf `revoked` setzen

Löschen zerstört Audit-Evidenz. `revoked` würde ohne bestätigten Upstream-Widerruf einen stärkeren Zustand behaupten, als Studio belegen kann.

## Risks and Mitigations

- Ein nur vorübergehend inaktiver Principal wird fälschlich verdrängt → automatische Auflösung ausschließlich bei endgültiger Löschung oder nachweislich fehlendem Hard-Delete-Account; Sperrung und Soft Delete bleiben Konflikt.
- Parallele Beobachtungen erzeugen widersprüchliche Übergänge → bestehender DataProvider-Advisory-Lock, erneutes Lesen und atomare Statusänderung in einer Transaktion.
- Ein externer Credential-Satz des gelöschten Accounts ist weiterhin gültig → lokaler Status wird nur `historical`; kein externer Widerruf wird behauptet. Eine spätere erneute aktive Beobachtung erzeugt wieder fail-closed einen Konflikt.
- Selbstheilung verdeckt einen häufigeren Systemfehler → strukturierte Metrik und Auditnachweis machen Anzahl und Grund sichtbar.

## Migration Plan

1. Repro-Test für zwei persönliche Conflict-Bindungen desselben DataProviders ergänzen.
2. Klassifikation und atomaren Übergang im bestehenden Binding-Modul implementieren.
3. Identity-Guard so erweitern, dass er nach erfolgreicher Auflösung ohne Provider-Write-Wiederholung fortfährt.
4. Unit-, Datenbankintegrations-, Type- und Server-Runtime-Gates ausführen.
5. Dokumentation und arc42-Vertrag aktualisieren.
6. Über den kanonischen Build- und Promote-Pfad ausrollen; bestehende Konflikte heilen erst beim nächsten betroffenen Mutationsversuch.

## Open Questions

- Keine. Der Scope ist auf endgültig gelöschte persönliche Konkurrenten und denselben Mutationsrequest begrenzt.
