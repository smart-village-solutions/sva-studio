# Direkte Nutzerrechte im IAM

Diese Anleitung beschreibt die direkte Pflege von Berechtigungen auf Benutzerebene im SVA Studio.

Direkte Nutzerrechte sind eine gezielte Ausnahme zum normalen Rollen- und Gruppenmodell. Standardmäßig sollen Rechte weiterhin über Rollen und Gruppen zugeordnet werden. Direkte Nutzerrechte sind für Einzelfälle gedacht, in denen ein Konto bewusst von der Standardzuordnung abweichen muss.

## Zielbild

- Rollen definieren den normalen Berechtigungsrahmen.
- Gruppen bündeln Rollen für wiederkehrende Zuweisungsmuster.
- Direkte Nutzerrechte ergänzen oder beschränken diesen Rahmen für einzelne Benutzerkonten.

Die technische Herkunft wird im IAM als `direct_user` geführt.

## Pflege in der UI

Die Pflege erfolgt in der Admin-Oberfläche unter `/admin/users/$userId` im Tab `Berechtigungen`.

Dort werden zwei Sichten getrennt angezeigt:

- `Direkte Rechte`: explizit am Nutzer gesetzte Einzelzuweisungen
- `Aktuell wirksame Rechte`: die aufgelöste Gesamtsicht aus Nutzer-, Rollen- und Gruppenrechten

Für jede Berechtigung gibt es drei Zustände:

- `Nicht gesetzt`: keine direkte Nutzerzuweisung; die Wirkung ergibt sich aus Rollen und Gruppen
- `Erlauben`: setzt eine direkte positive Zuweisung für diesen Nutzer
- `Verweigern`: setzt eine direkte restriktive Zuweisung für diesen Nutzer

## Fachliche Regel

Die Konfliktregel bleibt konservativ:

- `deny` hat Vorrang vor `allow`
- direkte Nutzer-Denies schlagen konfliktäre Allows aus Rollen oder Gruppen
- direkte Nutzer-Allows ergänzen geerbte Rechte nur dann, wenn kein restriktiver Konflikt greift

Damit folgt die Funktion weiterhin der bestehenden Prioritätsregel aus [ADR-025](../adr/ADR-025-multi-scope-prioritaetsregel-fuer-iam.md).

## Persistenz und technische Wirkung

Die Zuordnung wird ausschließlich in der Studio-Datenbank gespeichert:

- Tabelle: `iam.account_permissions`
- Schlüssel: `instance_id`, `account_id`, `permission_id`
- Wirkung: `effect = allow | deny`

Die Permission-Engine berücksichtigt diese Quelle zusätzlich zu:

- direkten Rollen aus `iam.account_roles`
- gruppenvermittelten Rollen aus `iam.account_groups` und `iam.group_roles`

Die Wirkung ist direkt in folgenden Pfaden sichtbar:

- `GET /iam/me/permissions`
- `POST /iam/authorize`

## Abgrenzung zu Keycloak

Direkte Nutzerrechte sind Studio-interne IAM-Fachdaten.

Das bedeutet:

- Änderungen an direkten Nutzerrechten werden nicht nach Keycloak gespiegelt.
- Keycloak bleibt zuständig für Authentifizierung, Sessions und IdP-nahe Benutzer-/Rollenoperationen.
- Postgres bleibt zuständig für Studio-verwaltete Berechtigungslogik.

## Validierung und Fail-Closed-Verhalten

Beim Speichern gelten folgende Regeln:

- nur bekannte `permissionId`s sind erlaubt
- pro Permission ist höchstens eine direkte Nutzerzuweisung zulässig
- ungültige oder doppelte Einträge führen zu `invalid_request`
- reine Nutzerrechte-Änderungen lösen dieselbe Permission-Invalidierung aus wie Rollen- und Gruppenänderungen

## Operative Hinweise

Direkte Nutzerrechte sollten sparsam eingesetzt werden.

Empfehlung:

- Rollen oder Gruppen zuerst anpassen, wenn die Anforderung mehrere Personen betrifft
- direkte Nutzerrechte nur für dokumentierte Ausnahmefälle verwenden
- bei privilegierten Einzelabweichungen zusätzlich `POST /iam/authorize` zur fachlichen Prüfung verwenden

## Referenzen

- Architektur: [../architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md)
- Laufzeitsicht: [../architecture/06-runtime-view.md](../architecture/06-runtime-view.md)
- Qualitätsziele: [../architecture/10-quality-requirements.md](../architecture/10-quality-requirements.md)
- Konfliktregel: [../adr/ADR-025-multi-scope-prioritaetsregel-fuer-iam.md](../adr/ADR-025-multi-scope-prioritaetsregel-fuer-iam.md)
