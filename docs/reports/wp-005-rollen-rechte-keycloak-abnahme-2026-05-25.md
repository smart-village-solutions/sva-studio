# WP-005 Abnahme: Rollen- und Rechtemanagement via Keycloak

## Ziel

Dieser Bericht bündelt die fachlichen und technischen Nachweise für den Abschluss von `WP-005`.

## Nachweisrahmen

- Mehrfachherkunft direkt plus Gruppe
- deaktivierte oder soft-gelöschte Gruppen
- Gültigkeitsfenster von Mitgliedschaften
- Geo Parent-Allow mit Child-Deny
- instanzfremde Gruppen- oder Geo-Daten

## Umsetzungsnachweise

### Technischer Abschlussstand

- Der Benutzer-Detailvertrag für `permissionTrace` wurde um strukturierte Herkunfts-, Restriktions- und Inaktivitätsfelder erweitert.
- Die SQL-basierte Benutzer-Detailabfrage projiziert jetzt Herkunft aus Organisation und Geo-Scope sowie Inaktivitätsgründe für Rollen- und Gruppenpfade.
- Der Benutzer-Update-Pfad für Rollen und Gruppen arbeitet diff-basiert und ersetzt unveränderte Zuweisungen nicht mehr per globalem Lösch-/Neuaufbau.
- Die Admin-UI im Benutzerdetail zeigt zusätzliche Transparenzzeilen für Vererbungsursprung, Geo-Restriktionen, Gültigkeiten und Inaktivitätsgründe.

### Verifizierte Nachweise

- `openspec validate refactor-wp-005-iam-assignment-transparency --strict`
- `pnpm exec vitest run packages/core/src/iam/account-management-contract.test.ts packages/iam-admin/src/user-detail-permission-sql.test.ts packages/auth-runtime/src/iam-account-management/assignment-diff.test.ts packages/auth-runtime/src/iam-account-management/shared-assignment.test.ts packages/iam-admin/src/user-update-persistence.test.ts`
- `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/users/-user-edit-page.test.tsx`

### Verbindliche Vorführ- und Nachweisfälle

| Fall | Sichtbarer UI-Zustand | Fachliche Erwartung | Technischer Effekt | Ergebnis mit Datum |
| --- | --- | --- | --- | --- |
| Mehrfachherkunft direkt plus Gruppe | Im Benutzerdetail ist dieselbe Berechtigung mit mehreren Herkunftspfaden im `permissionTrace` sichtbar | Direktzuweisung und gruppenbasierte Zuweisung werden transparent zusammengeführt | Vertragsmodell und SQL-Projektion liefern strukturierte Herkunftsfelder statt eines zusammengefallenen Endzustands | Repo-seitig nachgewiesen am `2026-05-25`; Zielumgebungs-Screenshot jetzt automatisiert archiviert, fachlich starker Showcase-Nutzer weiter offen |
| Deaktivierte oder soft-gelöschte Gruppe | Im Benutzerdetail erscheint ein expliziter Inaktivitätsgrund für betroffene Gruppenpfade | Inaktive Gruppen dürfen keine wirksame Berechtigung vortäuschen und müssen fachlich erkennbar sein | Inaktivitätsgründe wie `group_disabled` werden serverseitig geliefert und im UI ausgewiesen | Repo-seitig nachgewiesen am `2026-05-25`; Delivery-Evidence in Zielumgebung weiter datenabhängig |
| Gültigkeitsfenster einer Zuweisung | Gültig-ab/Gültig-bis und abgelaufene oder noch nicht aktive Pfade sind sichtbar | Zeitlich begrenzte Zuweisungen müssen nachvollziehbar aktiv oder inaktiv sein | Validity- und Inaktivitätsfelder werden diff-basiert persistiert und im Detailvertrag projiziert | Repo-seitig nachgewiesen am `2026-05-25`; echter Umgebungsnachweis hängt an passendem Showcase-Datensatz |
| Geo Parent-Allow mit Child-Deny | Geo-Herkunft, Restriktion und Child-Deny sind im Detailpfad sichtbar | Übergeordnete Freigabe darf durch untergeordnete Sperre eingeschränkt werden, ohne Transparenzverlust | Restriktions-ID, Geo-Ursprung und Konfliktfall sind Teil des `permissionTrace` | Repo-seitig nachgewiesen am `2026-05-25`; normierter Zielumgebungsfall im Runner vorhanden, aber im lokalen Datensatz noch nicht stark genug ausgeprägt |

### Abgedeckte Konflikt- und Transparenzfälle

- Mehrfachherkunft direkt plus Gruppe: strukturelle Herkunft im `permissionTrace`
- deaktivierte Gruppen: expliziter Inaktivitätsgrund `group_disabled`
- Gültigkeitsfenster von Rollen- und Gruppenpfaden: explizite Validity- und Inaktivitätsfelder
- Geo Parent-Allow mit Child-Deny: sichtbare Geo-Herkunft und Restriktions-ID im Benutzerdetail

### Zielumgebungs-Evidence vom `2026-05-25`

- Der Evidence-Runner öffnet die Benutzerdetailansicht inzwischen gezielt auf dem Tab `Berechtigungen` und archiviert dort normierte Screenshots.
- Die lokal erzeugten Läufe [iam-evidence-2026-05-25T21-32-14Z.md](./iam-evidence-2026-05-25T21-32-14Z.md) und [iam-evidence-2026-05-25T21-34-15Z.md](./iam-evidence-2026-05-25T21-34-15Z.md) belegen den funktionierenden Screenshot- und Artefaktpfad.
- Der zuletzt verwendete Nutzer `03cd7781-3af2-4ff5-8afe-7c996e4f0460` zeigt dabei den technisch korrekten Rechte-Tab, aber keine effektiven Berechtigungen. Die Laufstrecke ist damit belastbar, die fachliche Aussagekraft des lokalen Showcase-Nutzers jedoch begrenzt.

## Abnahmeeinschätzung

Im aktuellen Repository-Stand ist `WP-005` fachlich wesentlich weiter als der bisherige Kurzstatus "technisch weitgehend abgeschlossen" ausdrückt. Die vier für die Endabnahme entscheidenden Konflikt- und Transparenzfälle sind in Datenvertrag, Query-/Persistenzpfaden und Admin-UI konkret nachvollziehbar angelegt.

Für den Kundentermin kann daher belastbar gesagt werden:

- was vorgeführt wird: genau die vier oben normierten Konflikt- und Nachweisfälle
- was erfüllt ist: Transparenz der Herkunft, Erkennbarkeit inaktiver Pfade, zeitliche Gültigkeit und Geo-Konfliktauflösung
- was offen bleibt: normierte Zielumgebungs-Screenshots bzw. echte Delivery-Evidence derselben vier Fälle

## Offene Restpunkte

- Ein vollständiger fachlicher Abnahmelauf in Ziel- oder Integrationsumgebung steht weiterhin aus.
- Die normierten Zielumgebungsnachweise für alle vier Vorführfälle werden jetzt reproduzierbar erzeugt, benötigen aber noch einen fachlich stärkeren Showcase-Datensatz für maximal aussagekräftige Screenshots.

## Abnahmeentscheidung

`WP-005` ist repo-seitig fachlich klar vorführbar und mit den vier normierten Konfliktfällen kundentauglich beschreibbar. Für die formale Endabnahme bleibt aber die archivierte Ziel- oder Integrationsumgebungs-Evidence derselben Fälle noch nachzuziehen.
