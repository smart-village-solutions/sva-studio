# ADR-051: Technische Accounts und Organisations-Mainserver-Provisioning

**Status:** Accepted
**Entscheidungsdatum:** 2026-08-11
**Entschieden durch:** SVA Studio Team

## Kontext

Der bestehende SVA-Mainserver provisioniert persönliche und organisatorische Zugänge über denselben Benutzer-Endpunkt und benötigt dafür ein reales Keycloak-Subject. Organisationen entstehen im Studio dagegen lokal und können bereits manuell verschlüsselte Mainserver-Credentials besitzen. Ein externer Fehler darf deshalb weder die lokale Organisationserstellung zurückrollen noch zu doppelten technischen Identitäten, verlorenen Credentials oder überschriebenen DataProvider-Bindungen führen.

Technische Accounts müssen außerdem administrativ sichtbar und korrigierbar bleiben, dürfen aber nicht durch den normalen Inaktivitäts-Lifecycle deaktiviert oder pseudonymisiert werden. Die Kennzeichnung soll keine impliziten Änderungen an Rollen, Gruppen, Status oder Login auslösen.

## Entscheidung

1. `iam.accounts.is_technical_account` ist eine unabhängige, auditierte Klassifikation. Sie verändert keine anderen Accountattribute oder Beziehungen.
2. Benutzerlisten schließen technische Accounts standardmäßig serverseitig vor Gesamtzahl und Pagination aus. Ein expliziter Filter blendet sie mit sichtbarer Kennzeichnung ein.
3. Automatische und manuell gestartete Inaktivitäts-Lifecycle-Läufe überspringen aktuell technische Accounts vor jeder Zustandsentscheidung. Explizite Deaktivierung und privilegierter Hard Delete bleiben getrennte Verträge.
4. `iam.organization_mainserver_credentials` ist die kanonische Zustandsquelle für Organisations-Credentials, technischen Account, Operationsreferenz, Phase, Versuch, Lease, sicheren Fehlercode und Verifikationszeitpunkte.
5. Organisations-Provisioning beginnt erst nach dem lokalen Organisations-Commit und ist best-effort. Eine atomare Lease pro Instanz und Organisation verhindert parallele externe Identitäten und erlaubt Recovery nach Ablauf.
6. Vor jeder neuen technischen Accountanlage prüft Studio die aktive Mainserver-Konfiguration und die persönlichen Bootstrap-Credentials des handelnden Administrators. Der aktive Organisationskontext und Organisations-Credential-Fallbacks sind ausgeschlossen.
7. Der technische Keycloak-Account erhält deterministische Accountdaten sowie `instanceId`, `organizationId` und `accountPurpose = organization_mainserver`, aber keine Studio-/Keycloak-Rollen, Gruppen oder Einladung. Recovery erfordert eine vollständige eindeutige Übereinstimmung.
8. Studio sendet für persönliche und technische Organisationsaccounts fest `role: "studio"` an den unveränderten Mainserver-Benutzer-Endpunkt. Die Mainserver-Rolle ist von Studio-/Keycloak-Rollen und Gruppen unabhängig. Fehlt das Rollenfeld bei anderen Aufrufern, bleibt `restricted` die Mainserver-Defaultrolle. Der Endpunkt liefert Application-ID, Secret und die garantierte `data_provider_id`. Studio speichert Credentials verschlüsselt und verwendet die ID als `create_response`-Evidenz der credential-versionierten Organisationsbindung. `/data_provider.json` dient der späteren Verifikation.
9. Lost Response, lokale Teilpersistenz und Binding-Konflikte führen zu `reconciliation_required` und niemals zu einem stillen Überschreiben. Eine Accountkompensation ist nur vor einem sicher nicht abgesendeten Upstream-Aufruf zulässig.
10. Der explizite Retry benötigt ausschließlich `iam.org.write` und einen Idempotency-Key. Diese eng begrenzte Systemwirkung verleiht kein allgemeines Account-Schreibrecht.
11. Hard Delete ist während einer aktiven Provisioning-Lease blockiert. Danach wird die technische Accountreferenz gelöst; gültige Organisations-Credentials und DataProvider-Bindungen bleiben erhalten.
12. Reprovisionierung sendet `role: "studio"` erneut, verändert jedoch keine bestehende Mainserver-Rolle. Bestehende Nutzer werden nicht automatisch migriert. Cross-Tenant-Provisionierung wird mit HTTP `403`, eine ungültige Rolle mit HTTP `422` als sicherer, nicht wiederholbarer Provisioning-Fehler behandelt.

## Konsequenzen

### Positiv

- Lokale Organisationserstellung bleibt unabhängig von Keycloak- und Mainserver-Verfügbarkeit zuverlässig.
- Konkurrenz, Wiederholung und Crash-Recovery besitzen einen persistenten, beobachtbaren Vertrag.
- Technische Accounts werden im Lifecycle geschützt, ohne einen neuen Accounttyp mit impliziten Nebenwirkungen einzuführen.
- Secrets bleiben write-only; UI, Audit und Logs arbeiten mit secret-freien Zuständen und sicheren Fehlercodes.
- `iam.org.write` entspricht der Nutzererwartung für den gesamten Organisations-Create- und Retry-Pfad.

### Negativ

- Ein externer Erfolg kann bewusst manuelle Reconciliation erfordern und hinterlässt dann einen technischen Account.
- Die Studio-Datenbank und Keycloak halten unterschiedliche Teile desselben Integrationszustands; Leases und Recovery-Regeln müssen dauerhaft gepflegt werden.
- Exakte Listenfilterung kann mehrere Keycloak-Fenster benötigen.
- Administratoren können einen menschlich genutzten Account als technisch markieren; Sichtbarkeit und Audit begrenzen dieses organisatorische Risiko, verhindern es aber nicht.

## Verbindliche Leitplanken

- Kein Organisations-Provisioning allein durch manuelles Setzen von `isTechnicalAccount`.
- Kein technischer Account vor erfolgreichem Konfigurations- und persönlichem Credential-Preflight.
- Kein Bootstrap mit aktiven oder Zielorganisations-Credentials.
- Keine frei wählbaren Studio-/Keycloak-Rollen, Gruppen, Einladung oder Accountattribute im Organisations-Provisioning-Request; die Mainserver-Initialrolle ist fest `studio`.
- Kein Überschreiben einer abweichenden DataProvider-Bindung.
- Keine Secrets, Tokens oder rohen Upstream-Antworten in Read-Modellen, Logs oder Audit.
- Kein Hard Delete des zugeordneten Accounts während einer aktiven Lease.

## Verwandte ADRs

- `ADR-016-idp-abstraktionsschicht.md`
- `ADR-021-per-user-sva-mainserver-delegation.md`
- `ADR-036-kanonischer-iam-projektions-und-reconcile-vertrag.md`
- `ADR-042-externe-schnittstellen-als-host-owned-registry.md`
- `ADR-045-organisationsgebundene-mainserver-credentials-und-policy-gesteuerte-delegation.md`
- `ADR-049-kanonischer-permission-katalog-und-additiver-reconcile.md`
