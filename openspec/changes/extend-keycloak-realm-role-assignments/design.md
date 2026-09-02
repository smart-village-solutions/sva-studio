## Context

Das Studio kennt zwei voneinander getrennte Rollenwelten:

1. Lokale IAM-Rollen bündeln Studio-Permissions und sind die normative Quelle für Studio-UI- und API-Autorisierung.
2. Keycloak-Realm-Rollen werden von Keycloak oder angebundenen Anwendungen verwendet. Außer der technischen Tenant-Sonderrolle `system_admin` begründen sie keine Studio-Permissions.

Der Change erweitert ausschließlich die Administration direkter Keycloak-Rollenzuweisungen. Er führt weder eine lokale Spiegelrolle für externe Realm-Rollen noch eine Auswertung dieser Rollen durch Studio-Fachgates ein.

## Goals / Non-Goals

- Goals:
  - alle relevanten Keycloak-Realm-Rollen eines Tenant-Realms sichtbar machen;
  - direkte und über Composite Roles geerbte Zuweisungen unterscheidbar darstellen;
  - direkte reguläre Realm-Rollenzuweisungen mit `iam.role.write` verwalten;
  - dieselbe Zuweisungsfunktion für gemappte Studio-Konten und noch nicht gemappte Keycloak-/App-Benutzer anbieten;
  - Root-/Tenant-Grenzen, Builtin-Schutz und die normative lokale Studio-Autorisierung erhalten;
  - `system_admin` zuweisbar halten und dabei alle bestehenden Schutzinvarianten bewahren.
- Non-Goals:
  - Keycloak-Clientrollen verwalten;
  - Keycloak-Rollen anlegen, ändern oder löschen, die nicht `managed_by=studio` sind;
  - externe Realm-Rollen in `iam.roles` oder `iam.account_roles` importieren;
  - Mainserver-spezifische Rollennamen oder Rollenabhängigkeiten im Studio codieren;
  - Keycloak-Rollen für Studio-Fachautorisierung auswerten;
  - einen Freigabe-, Antrags- oder Vier-Augen-Workflow einführen;
  - die Rollen-Enforcement-Logik konsumierender Anwendungen verändern.

## Decisions

### `iam.role.write` autorisiert alle Rollenzuweisungen

Die vorhandene Permission `iam.role.write` bleibt die einzige tenantseitige Schreibberechtigung für lokale und Keycloak-basierte Rollenzuweisungen. Es wird keine Mainserver- oder Keycloak-spezifische Permission ergänzt.

Lesepfade bleiben an `iam.role.read` und, soweit Benutzerdaten benötigt werden, `iam.user.read` gebunden. Eine UI-Freischaltung ersetzt niemals die serverseitige Permission-Prüfung.

### Externe Keycloak-Rollen bleiben eine getrennte Interop-Sicht

Lokale IAM-Rollen und rohe Keycloak-Rollen werden in API und UI getrennt geführt. Externe Keycloak-Rollen werden nicht in die lokale Rollen- oder Permission-Auflösung aufgenommen. Ihre Zuweisung kann Rechte in konsumierenden Anwendungen verändern, aber niemals allein ein Studio-Gate öffnen.

### Zuweisbarkeit folgt einer generischen Schutzklassifikation

Eine Rolle ist im Tenant-Studio direkt zuweisbar, wenn alle folgenden Bedingungen erfüllt sind:

- sie ist eine Realm-Rolle des für die aktive Instanz aufgelösten Tenant-Realms;
- sie ist keine Keycloak-Builtin-Rolle (`offline_access`, `uma_authorization`, `default-roles-*`);
- sie ist keine Keycloak-Clientrolle;
- sie ist keine technische Service-Rolle, insbesondere `realm_account_admin`;
- sie ist keine Root-/Plattformrolle, insbesondere `instance_registry_admin`.

Die Klassifikation darf nicht allein aus einem vom Client gelieferten Rollennamen abgeleitet werden. Der Server löst Rolle, Realm, Typ und aktuelle Metadaten über den tenantgebundenen Identity Provider auf. Neue Keycloak-Builtins oder reservierte Plattformrollen müssen über eine zentral getestete Policy ergänzt werden können.

Reguläre externe Anwendungsrollen und Studio-managed Realm-Rollen sind zuweisbar. Composite Realm Roles sind ebenfalls zuweisbar, sofern sie die Schutzklassifikation erfüllen.

### Nur direkte Zuordnungen sind mutierbar

Die Benutzerprojektion unterscheidet:

- direkt zugewiesene Realm-Rollen;
- ausschließlich über Composite Roles geerbte effektive Realm-Rollen.

Nur direkte Zuordnungen können über das Studio entzogen werden. Eine geerbte Rolle bleibt read-only und verweist in der UI auf ihre Herkunft. Das Zuweisen einer bereits effektiv vorhandenen, aber nur geerbten Rolle darf wahlweise eine direkte Zuordnung ergänzen; die UI muss diesen Effekt ausdrücklich benennen.

### Mutationen sind tenantgebundene Deltas

Der Server akzeptiert eine konkrete Assign- oder Remove-Operation für eine aufgelöste Benutzer- und Rollenidentität. Er darf niemals die vollständige vom Client gelieferte Rollenmenge als Ersatz des Keycloak-Zustands schreiben.

Der Ablauf lautet:

1. Actor, aktive Instanz und `iam.role.write` auflösen.
2. Zielbenutzer ausschließlich im Tenant-Realm der aktiven Instanz auflösen.
3. Zielrolle aus demselben Realm laden und Schutzklassifikation prüfen.
4. Aktuelle direkte und effektive Zuweisungen lesen.
5. Genau das angeforderte idempotente Delta gegen Keycloak ausführen.
6. Direkte Zuweisungen über denselben gebundenen Provider erneut lesen.
7. Erfolg nur bestätigen, wenn der Zielzustand nachgewiesen ist; andernfalls einen stabilen unklaren oder fehlgeschlagenen Zustand liefern.
8. Ergebnis auditieren und die UI-Projektion aktualisieren.

Der Client darf weder Realm, Instanz noch Keycloak-Admin-Credentials bestimmen. Unbekannte Rollen, Scope-Wechsel und nicht mehr vorhandene Benutzer schlagen fail-closed fehl.

### Unmapped Keycloak-Benutzer bleiben zulässige Ziele

Ein Benutzer benötigt für die Zuweisung einer externen Keycloak-Rolle keinen lokalen `iam.accounts`-Datensatz. Das Studio verwendet eine opaque, serverseitig gegen den aktiven Tenant-Realm aufgelöste Zielidentität. Der Status `unmapped` blockiert weiterhin lokale Profil-, Status- oder IAM-Rollenmutationen, aber nicht die separate Keycloak-Rollenzuweisung.

Es erfolgt keine implizite Kontoanlage oder JIT-Persistenz allein durch eine externe Rollenzuweisung.

### `system_admin` bleibt ein gekoppelter Sonderfall

`system_admin` ist eine zuweisbare Tenant-Realm-Rolle, zugleich aber die geschützte Vollzugriffsrolle des lokalen IAM-Modells. Deshalb darf sie nicht über den rein externen Keycloak-Zuweisungspfad mutiert werden.

Für `system_admin` gilt weiterhin der kanonische lokale Rollenpfad mit gekoppelter Keycloak-Mutation:

- das Ziel muss ein gemapptes Tenant-Konto mit aktiver Instanzmitgliedschaft sein;
- der Actor muss selbst `system_admin` sein und `iam.role.write` besitzen;
- Zuweisung und Entzug müssen lokalen IAM- und Keycloak-Zustand konsistent halten;
- der letzte aktive `system_admin` darf nicht entzogen werden;
- Root-Rollen dürfen dadurch nicht in den Tenant gelangen;
- partielle Cross-System-Ergebnisse müssen kompensiert oder als expliziter Reconciliation-Zustand ausgewiesen werden.

Damit bleibt `system_admin` sichtbar und zuweisbar, ohne dass eine bloße rohe Keycloak-Zuweisung die lokale Autorisierungsquelle umgeht.

### Kein Studio-Wissen über Anwendungsrollen

Das Studio codiert keine Namen wie `mainserver_role_news_item` und keine Abhängigkeit zu `mainserver_restricted`. Falls eine externe Anwendung Rollenabhängigkeiten benötigt, werden diese in Keycloak als Composite Role oder in der Autorisierung der konsumierenden Anwendung modelliert.

### Audit und Datenschutz

Jeder erfolgreiche, abgelehnte oder nach einem Upstream-Fehler unklare Mutationsversuch erzeugt genau ein kanonisches Audit-Ereignis. Erfasst werden mindestens Instanz, Actor-Account, pseudonyme Zielreferenz, Rollenname, Operation, Ergebnis, Request-ID und Trace-ID.

Tokens, Secrets, E-Mail-Adressen, vollständige Upstream-Antworten und rohe Keycloak-Subjects werden weder in Audit-Details noch in operative Logs aufgenommen.

## API and Projection Shape

Die konkrete Routengestaltung bleibt der Implementierung vorbehalten, muss aber folgende typisierte Informationen bereitstellen:

- Rollenmetadaten: stabile Keycloak-Rollen-ID, Anzeigename, Beschreibung, Realm-/Client-Typ, Composite-Status, Ownership und Zuweisbarkeit mit Begründung;
- Benutzerzuweisung: direkte Rollennamen, effektive Rollennamen und Herkunft geerbter Rollen, soweit Keycloak diese auflösbar liefert;
- Mutationsantwort: angeforderte Operation, nachgewiesener Direktzustand, Sync-/Ergebnisstatus und stabiler Fehlercode;
- keine vom Client frei wählbaren Realm- oder Instanzparameter.

## Error Handling

- `403`: fehlendes `iam.role.write`, unzulässige Privilegienhöhe oder geschützter `system_admin`-Pfad;
- `404`: Zielbenutzer oder Rolle existiert im gebundenen Tenant-Realm nicht;
- `409`: geschützte Rolle, Letztadmin-Konflikt, nicht mutierbare geerbte Zuordnung oder nicht eindeutig bestätigbarer Cross-System-Zustand;
- `422`: syntaktisch gültige, aber für diese Operation unzulässige Rollenkategorie;
- `502`/`503`: Keycloak nicht erreichbar oder Tenant-Admin-Capability nicht verfügbar;
- stabile Fehlercodes und eine nicht-sensitive, lokalisierbare UI-Darstellung für alle Fälle.

Bei Timeout oder unklarem Keycloak-Ergebnis wird vor einer Wiederholung der aktuelle Direktzuweisungszustand gelesen. Ein Retry darf kein breites Rollen-Replace auslösen.

## Accessibility and UX

- Lokale IAM-Rollen und Keycloak-Rollen werden in getrennten, eindeutig beschrifteten Bereichen dargestellt.
- Direkt, geerbt, extern verwaltet, Studio-managed und geschützt sind nicht nur farblich unterscheidbar.
- Deaktivierte Aktionen enthalten eine sichtbare und für Screenreader verknüpfte Begründung.
- Assign-/Remove-Aktionen sind per Tastatur bedienbar und melden Erfolg oder Fehler über bestehende zugängliche Feedback-Komponenten.
- Es gibt keinen irreführenden Edit- oder Delete-Button für extern verwaltete Rollendefinitionen.

## Alternatives Considered

- Eigene Permission wie `iam.mainserverRole.write`: verworfen, weil die Administration generisch für beliebige Tenant-Realm-Rollen gelten soll und keine Mainserver-Kopplung entstehen darf.
- Rollen-Allowlist pro Anwendung: verworfen, weil sie Studio-Releases an externe Rollenkataloge koppeln würde.
- Import externer Realm-Rollen in `iam.roles`: verworfen, weil dadurch erneut zwei normative Rollenwahrheiten und unklare Studio-Permission-Wirkung entstünden.
- Vollständiges Ersetzen aller Benutzerrollen aus einem UI-Payload: verworfen, weil parallele Änderungen oder geschützte/intern verwaltete Rollen verloren gehen könnten.
- Direkte Verwaltung von Keycloak-Clientrollen: für diesen Change verworfen, weil Clientrollen eine andere Trust Boundary und wesentlich weiterreichende Admin-Capabilities besitzen können.

## Migration Plan

1. Rollenklassifikation und additive Projektionsverträge einführen.
2. Keycloak-Admin-Port um getrennte direkte und effektive Benutzerrollensichten ergänzen.
3. Read-only UI für alle Realm-Rollen und getrennte Benutzerzuweisungen ausliefern.
4. Delta-Mutationspfad für reguläre externe Realm-Rollen hinter `iam.role.write` aktivieren.
5. `system_admin` im gemeinsamen UI auf den bestehenden gekoppelten Sonderpfad routen und Schutzfälle nachweisen.
6. Audit, Fehlerdarstellung und E2E-Smokes ergänzen.
7. Tenantweise prüfen, ob der Tenant-Admin-Service-Account die minimal erforderlichen Keycloak-Rechte besitzt.

Ein Rollback deaktiviert den neuen Mutationspfad und lässt die additive read-only Projektion bestehen. Bereits in Keycloak gesetzte externe Rollenzuweisungen werden nicht automatisch entfernt.

## Open Questions

Keine fachlichen Open Questions. Endpoint-Namen und konkrete UI-Komponenten werden innerhalb der bestehenden IAM-v1- und Admin-Ressourcenmuster umgesetzt.
