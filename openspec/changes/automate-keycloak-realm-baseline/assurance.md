# Assurance: Automatisierte Keycloak-Realm-Baseline

## Kritische Grenzen

Der Change erweitert die privilegierte Provisioner-Grenze um Realm-Einstellungen, Benutzerprofil, Mapper und SMTP-Metadaten. Die zentrale Gefahr ist nicht nur ein fehlender Wert, sondern eine zu breite Mutation, die Bestands-Realms, unbekannte Profilattribute oder manuell gesetzte Secrets überschreibt.

## Invarianten und Nachweise

### KRB-1 – Baseline gilt ausschließlich für neue Realms

Ein normaler Lauf für `realmMode = existing` darf keine Baseline-Realmwerte automatisch schreiben.

Nachweis:

- tabellengetriebene Plan- und Execution-Tests für `new` und `existing`;
- Adapter-Spies belegen ausbleibende Realm-Baseline-Writes im Bestandsmodus;
- ein Konflikttest verhindert die Übernahme eines bereits vorhandenen Realms im Modus `new`.

### KRB-2 – Server ist für Standards führend

Browser-, MCP- oder CLI-Clients können New-Realm-Defaults weder umgehen noch abweichend festlegen.

Nachweis:

- Contract-Tests für ausgelassene, passende und widersprüchliche technische Eingaben;
- Servertests belegen identische Desired Snapshots unabhängig vom Client;
- die UI sendet für neue Realms keine editierbaren technischen Defaultwerte mehr.

### KRB-3 – Kein Secret in Baseline oder Evidenz

Die Baseline, Snapshots, Plan, Run, Audit, Fehler und Browserantworten enthalten kein SMTP-Passwort und keinen tatsächlichen Passwort-Platzhalter.

Nachweis:

- Redaction- und Serialisierungstests gegen Passwort-, Token- und SMTP-Felder;
- Snapshot-Assertions schließen `password`, maskierte Werte und Klartext-Providerantworten aus;
- Repository-Suche und Review der server-only Baseline.

### KRB-4 – Manuelles SMTP-Passwort verlässt Keycloak nicht

Realm-Create schreibt das SMTP-Passwort nicht. Ein von Keycloak maskiert gelesener Wert wird nur als boolescher Konfigurationsstatus ausgewertet und nie zurückgegeben.

Nachweis:

- Adaptertests prüfen das vollständige Create-Payload auf Abwesenheit von `smtpServer.password`;
- Readback-Tests bestätigen, dass nur `smtpPasswordConfigured` den Adapter verlässt;
- Baseline-Tests schließen Passwort und Platzhalter aus.

### KRB-5 – SMTP-Passwort bleibt eine sichtbare manuelle Nacharbeit

Das fehlende SMTP-Passwort wird mit stabilem Grund- und Aktionscode ausgewiesen, lässt aber den rein technischen Provisioning-Lauf erfolgreich abschließen.

Nachweis:

- Run-Step-Test für fehlendes und vorhandenes Passwort;
- UI-Status zeigt den booleschen Readback ohne Secret-Wert;
- die operative Dokumentation nennt Setzen und Testen direkt in Keycloak.

### KRB-6 – Fremde Realm- und Profilwerte bleiben erhalten

Die Baseline besitzt nur die ausdrücklich verwalteten Felder. Unbekannte Realm-Attribute, Standardprofilfelder und tenant-spezifische Profilattribute werden nicht entfernt oder umgeschrieben.

Nachweis:

- Read-modify-write-Tests mit zusätzlichen Realm- und Profilfeldern;
- Concurrency-Test für zwischen Read und Write verändertes Benutzerprofil;
- Readback bestätigt sowohl Baseline als auch erhaltene Fremdfelder.

### KRB-7 – Retry wechselt die Baseline nicht stillschweigend

Ein persistierter Auftrag darf bei Wiederholung nicht unbemerkt eine neuere Baseline anwenden.

Nachweis:

- Fingerprint- und Snapshot-Tests mit zwei Baseline-Versionen;
- Replay-Test mit unveränderter Baseline bleibt zulässig;
- ein Versions- oder Fingerprint-Konflikt bricht vor der Mutation ab.

### KRB-8 – Manuelle Arbeit ist sichtbar

Ein automatischer Teilerfolg darf die SMTP-Nacharbeit nicht verdecken.

Nachweis:

- Plan- und Run-Test für den manuellen Schritt;
- UI-Test für den vereinfachten New-Realm-Ablauf;
- Detailstatus zeigt, ob ein Passwort konfiguriert ist.

## Failure Modes

| Fehler                               | Erwartetes Verhalten                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| Baseline ungültig                    | Fail-fast vor Keycloak-Zugriff                                |
| Realm-Write teilweise fehlgeschlagen | vorhandene Realm-Kompensation oder expliziter Cleanup-Befund  |
| Profil konkurrierend geändert        | retrybarer Konflikt ohne blindes Überschreiben                |
| SMTP-Passwort fehlt                  | `smtp_password_required`, technischer Lauf bleibt erfolgreich |
| Keycloak liefert `********`          | kein Erfolgsnachweis und niemals Rückschreiben                |
| Existing-Realm wird geprüft          | Readback erlaubt, keine automatische Baseline-Mutation        |

## Abnahmegrenze

Technische Tests allein schließen den Change nicht. Die spätere Umgebungsabnahme benötigt einen neu erstellten Test-Realm mit vollständigem Readback, korrektem Browser-Login und `/auth/me`. Für E-Mail ist nach manuellem Passwortsetzen ein Test direkt in Keycloak erforderlich. Keine produktiven Bestands-Realms werden für den Erstnachweis mutiert.
