# Change: SSF-Accounts in einem synchronen Vorgang vollständig anlegen

## Why

Die Account-Anlage schreibt heute zuerst nach Keycloak und Studio und plant
anschließend einen tenantweiten SSF-Reconcile. Damit kann sie Erfolg melden,
obwohl dem Benutzer noch SSF-Claims fehlen. Fehler des Hintergrundprozesses
bleiben außerhalb des ursprünglichen Vorgangs und sind für den Administrator
schwer erkennbar.

Die Anlage soll innerhalb eines Requests abschließen: Voraussetzungen prüfen,
Keycloak vollständig schreiben, lokal speichern, Ergebnis zurückgeben. Eine
aktive, SSF-berechtigte Neuanlage benötigt keinen späteren Projektionslauf,
um Directory und Login nutzen zu können.

## What Changes

- Der Create liest die bestätigte Mandantenreadiness und aktuelle
  Vertragsrevision, validiert Rollen einschließlich Gruppenrollen und leitet
  die SSF-Claims über dieselbe fachliche Abbildung wie der Lifecycle ab.
- Keycloak-Create und erforderlicher technischer Rollenabgleich erfolgen vor
  der gemeinsamen lokalen Transaktion für Account, Mitgliedschaft und
  Zuweisungen. Der angeforderte fachliche Accountstatus bleibt erhalten.
- Fehler vor dem lokalen Commit werden unmittelbar beantwortet. Ein bereits
  eindeutig angelegter Keycloak-Benutzer wird gezielt gelöscht; auch eine
  fehlgeschlagene Bereinigung wird im vorhandenen Fehlerpfad sichtbar.
- Create und Lifecycle verwenden dieselbe Tenant-Sperre. Der Lifecycle liest
  seinen Benutzerbestand innerhalb dieser Sperre, damit er keine neue Anlage
  mit einem veralteten Bestand überschreibt.
- Die Vertragsrevision wird unabhängig von der Benutzerliste. Tatsächliche
  Projektionsänderungen und Read-back-Abweichungen werden weiterhin anhand
  der vollständigen Inhalte und der vorhandenen Generation erkannt.
- Die bestehende Directory-Prüfung berücksichtigt nach dem Commit einen
  aktiven, SSF-berechtigten lokalen Account zusammen mit bestätigter
  Mandantenreadiness. Sie wartet nicht auf die nächste Subject-Projektion.
- Die Umstellung lehnt alte Vertragsstände bereits im Readiness-Leser ab.
  Die vorhandene Lifecycle-Vertragsänderung löst die einmalige Konvergenz aus.
- Der create-spezifische Reconcile-Aufruf entfällt. Die verbleibende
  Lifecycle-Verantwortung und die Umfangsgrenze stehen verbindlich im Design.

## Out of Scope

Die Umfangsgrenze in `design.md` gilt für den gesamten Change. Insbesondere
entstehen kein Hintergrundabschluss der Anlage, kein technischer
Pending-Account und keine allgemeine Neuarchitektur der Projektion.

## Dependencies and Conflicts

Dieser Change baut auf `add-ssf-iam-permission-projection` und
`add-ssf-tenant-administration` auf. Er ersetzt die subject-basierte
Revisionssemantik sowie den nach PR #1474 eingeführten Create-Reconcile.
Die bisherige Gleichsetzung von Vertragsrevision und vollständigem
Projektionsinhalt wird aufgehoben; der inhaltliche Lifecycle-Read-back bleibt
verbindlich. Directory-Sichtbarkeit benötigt für synchron angelegte Accounts
keinen nachgelagerten Subject-Read-back mehr.

## Impact

- Affected specs: `iam-access-control`, `ssf-authorization-projection`
- Affected code: Account-Create in `@sva/auth-runtime` und `@sva/iam-admin`,
  SSF-Ableitung, Projektionsvergleich, Sperre und Readiness in
  `@sva/plugin-ssf`, bestehende hostseitige Lifecycle-/Directory-Anbindung,
  vorhandene Fehleranzeige mit Übersetzungen und zugehörige Tests
- Database impact: keine neue Tabelle, Spalte oder Migration vorgesehen
- Affected arc42 sections: `05-building-block-view`,
  `08-cross-cutting-concepts`, `10-quality-requirements`,
  `11-risks-and-technical-debt`

## Success Criteria

- Erfolg bedeutet: Keycloak-Write, erforderlicher Rollenabgleich und lokaler
  Commit sind abgeschlossen; kein SSF-Job stellt den Account später fertig.
- Ein aktiver, SSF-berechtigter Account erhält bei der anschließenden
  Tokenausstellung alle vier SSF-Claims und kann sich nach Erfüllung der
  bestehenden Anmeldevoraussetzungen ohne manuellen Keycloak-Eingriff bei
  SSF anmelden und ein Gespräch starten.
- Fehlende Readiness oder unzulässige Rollen/Gruppen scheitern vor der
  Benutzeranlage; Fehler und fehlgeschlagene Bereinigung sind unmittelbar
  im bestehenden Dialog sichtbar und korrelierbar.
- Die erste aktive SSF-berechtigte Neuanlage macht einen ansonsten bereiten
  Mandanten ohne weiteren Reconcile im Directory sichtbar.
- Paralleler Reconcile, spätere Rechteänderungen und Vertragsumstellung
  erhalten ihre bisherigen Schutzwirkungen mit den vorhandenen Mitteln.
