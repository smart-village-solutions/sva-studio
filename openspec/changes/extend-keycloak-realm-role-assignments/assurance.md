# Assurance: Keycloak-Realm-Rollenzuweisungen

## Scope

Der Change erweitert eine sicherheitskritische Trust Boundary: Ein Tenant-Administrator kann über das Studio Rechte in externen Anwendungen verändern, indem er direkte Realm-Rollenzuweisungen in Keycloak mutiert. Die Studio-Autorisierung selbst muss davon unabhängig bleiben.

## Kritische Invarianten

### KC-ROLE-01: Tenant-Grenze

Jeder Rollenread und jede Rollenmutation verwendet ausschließlich den serverseitig für die aktive Instanz gebundenen Tenant-Realm und Tenant-Admin-Client. Clientseitig gelieferte Realm-, Instanz- oder Providerangaben dürfen den Scope nicht beeinflussen.

Geplanter Nachweis:

- Unit- und Integrationstests für fremde Benutzer-, Rollen- und Realm-Referenzen;
- negativer API-Test gegen Cross-Tenant-Targets;
- E2E-Nachweis mit zwei getrennten Tenant-Realms.

### KC-ROLE-02: Studio-Autorisierung bleibt IAM-lokal

Das Hinzufügen oder Entfernen einer externen Keycloak-Rolle verändert weder lokale `iam.account_roles` noch effektive Studio-Permissions. Ausnahme ist ausschließlich der bestehende gekoppelte Sonderpfad für `system_admin`.

Geplanter Nachweis:

- DB-Integrationstest vor und nach externer Rollenzuweisung;
- Authorize-Test, der trotz externer Anwendungsrolle ohne lokale Permission fail-closed bleibt;
- separater Positivtest für den kanonischen `system_admin`-Pfad.

### KC-ROLE-03: Geschützte Rollenklassen

Keycloak-Builtins, Clientrollen, Service-Rollen und Root-/Plattformrollen sind im Tenant sichtbar, aber nicht über den externen Zuweisungspfad mutierbar.

Geplanter Nachweis:

- tabellengetriebene Policy-Tests für `offline_access`, `uma_authorization`, `default-roles-*`, Clientrollen, `realm_account_admin` und `instance_registry_admin`;
- API-Negativtests für manipulierte Rollennamen und Rollen-IDs;
- UI-Test für sichtbare read-only Begründungen.

### KC-ROLE-04: Direkte und geerbte Zuordnungen

Nur direkte Realm-Rollenzuweisungen werden entfernt. Eine ausschließlich geerbte Rolle darf weder als direkt zugeordnet gemeldet noch durch einen ungeeigneten Remove-Aufruf scheinbar erfolgreich entfernt werden.

Geplanter Nachweis:

- Keycloak-Adaptertests mit Composite Roles;
- Projektionstest für direkte, geerbte und zugleich direkt plus geerbt vorhandene Rollen;
- UI-Test für nicht mutierbare geerbte Rollen.

### KC-ROLE-05: Kein breites Rollen-Replace

Eine Mutation verändert ausschließlich die angeforderte direkte Rolle. Builtins, parallele externe Zuweisungen und unbekannte Rollen bleiben unverändert.

Geplanter Nachweis:

- Adaptertest mit konkurrierender zusätzlicher Rolle;
- Contract-Test, dass Assign und Remove jeweils ein einzelnes aufgelöstes Delta senden;
- Retry-Test ohne Verlust nicht beteiligter Rollen.

### KC-ROLE-06: Nachgewiesener Upstream-Zustand

Erfolg wird erst gemeldet, wenn ein kausaler Read über denselben gebundenen Provider den Zielzustand bestätigt. Ein Timeout oder widersprüchlicher Read darf nicht als Erfolg erscheinen.

Geplanter Nachweis:

- Tests für Erfolg, Timeout vor Mutation, Timeout nach möglicher Mutation und widersprüchlichen Re-Read;
- stabiler `reconciliation_required`- oder gleichwertiger Konfliktzustand bei nicht auflösbarer Ambiguität;
- Telemetrie-Nachweis ohne sensitive Providerdaten.

### KC-ROLE-07: `system_admin`-Konsistenz

`system_admin` bleibt zuweisbar, darf aber nur durch einen Actor mit `system_admin` und `iam.role.write` über den gekoppelten lokalen IAM-/Keycloak-Pfad verändert werden. Der letzte aktive `system_admin` bleibt geschützt.

Geplanter Nachweis:

- Negativtest für Actor ohne `system_admin` trotz `iam.role.write`;
- Positivtest für autorisierte Zuweisung;
- Letztadmin- und Selbstentzugstests;
- Fehler- und Kompensationstests für partielle IAM-/Keycloak-Ergebnisse.

### KC-ROLE-08: Unmapped Targets ohne implizite Persistenz

Reguläre externe Realm-Rollen dürfen einem im Tenant-Realm vorhandenen, aber lokal unmapped Benutzer zugewiesen werden. Dadurch entstehen weder lokales Konto noch Membership oder lokale Rollenbeziehung.

Geplanter Nachweis:

- API- und DB-Integrationstest für ein unmapped Keycloak-Subject;
- Cross-Tenant-Negativtest mit gleichartiger externer Referenz;
- UI-E2E für eine Zuweisung aus der vollständigen Tenant-Benutzerliste.

### KC-ROLE-09: Datenschutz und Audit

Audit und Logs enthalten Actor, Tenant, pseudonyme Zielreferenz, Rollenname, Operation und Ergebnis, aber keine Tokens, Secrets, E-Mail-Adressen, vollständigen Upstream-Antworten oder rohen Keycloak-Subjects.

Geplanter Nachweis:

- Audit-Sink-Test für Erfolgs-, Ablehnungs- und Ambiguitätspfade;
- PII-/Secret-Assertions gegen strukturierte Logs;
- genau ein kanonisches Audit-Ereignis pro Versuch.

## Merge- und Rollout-Nachweis

Vor dem Merge müssen für den exakten PR-HEAD mindestens vorliegen:

- relevante Unit-, Typ-, Server-Runtime- und Integrationstests;
- E2E-Abdeckung für gemappte und unmapped Benutzer sowie geschützte Rollen;
- aktualisierte arc42-Abschnitte und ADR;
- dokumentierter Review der Keycloak-Admin-Capabilities des Tenant-Service-Accounts;
- Nachweis, dass externe Rollen keine Studio-Permissions erzeugen.

Vor Production müssen auf Staging zusätzlich nachgewiesen werden:

- Rollenliste und direkte/effektive Zuordnungen in einem realen Tenant-Realm;
- Assign und Remove einer ungefährlichen externen Testrolle;
- unveränderte Builtin-, Root- und nicht beteiligte Rollenzuweisungen;
- Audit-Ereignis und verständliche UI-Rückmeldung;
- gleicher unveränderlicher Image-Digest für Staging und Production gemäß kanonischem Rollout-Prozess.

## Lokaler Nachweisstand

- Rollenklassifikation, direkte/effektive Projektion und Delta-Bildung sind durch gezielte Unit-Tests abgedeckt.
- Handler-Integrationstests belegen gemappte und unmapped Benutzer, `iam.role.write` als serverseitiges Gate, ein einzelnes Keycloak-Delta sowie ausbleibende lokale IAM-Schreibzugriffe.
- Keycloak-Adaptertests belegen getrennte direkte und effektive Realm-Rollen einschließlich Composite-Vererbung.
- Playwright belegt für einen unmapped App-Benutzer Anzeige, Tastaturbedienung, Assign, Remove, geschützte Builtins und den sichtbaren Reconciliation-Fehlerzustand.
- Der reale Tenant-Realm-, Audit-Sink- und Digest-Nachweis bleibt bis zum Staging-Smoke offen.
