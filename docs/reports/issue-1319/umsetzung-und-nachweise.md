# Issue #1319: Login-Bereitschaft vor SSF-Veröffentlichung

## Ziel und Lieferumfang

Ein veröffentlichter Mandant muss den vollständigen SSF-Loginvertrag erfüllen.
Die Erstprovisionierung erzeugt die Voraussetzungen vor der Freigabe. Ein
Directory-Read ist schreibfrei und schützt ergänzend gegen Teilzustände und Drift.
Die Änderung ergänzt die bestehenden Changes `add-ssf-tenant-administration`,
`add-ssf-iam-permission-projection` und `add-ssf-admin-login-directory`.

## Grenzen und Reihenfolge

1. Der Host leitet `ssf-frontend` und `/login/*` ausschließlich aus der expliziten
   HTTPS-Installationskonfiguration `SVA_STUDIO_SSF_LOGIN_ORIGIN` ab. Die Registry
   bestimmt Realm und Instanz. Requests dürfen beides nicht überschreiben.
2. Der bestehende Keycloak-Worker übernimmt den versionierten Browservertrag aus
   dem persistierten Auftrags-Snapshot. Version 1 bleibt Ressourcenclient-Vertrag;
   Version 2 beschreibt einen öffentlichen Browserclient mit Code Flow, PKCE S256,
   maximal 900 Sekunden Access-Token-Laufzeit und ohne Passwort-/Service-Account-Flow.
3. Der SSF-Lifecycle beansprucht die Projektionsgeneration unter seinem bestehenden
   Tenant-Lock. Auch ein früheres `ready` muss vor Wiederverwendung geprüft werden.
4. Der Core gleicht die deklarierten Clients ab; der Browserclient bleibt während
   der Vorbereitung deaktiviert. Ein fehlender Ressourcenclient wird initial angelegt;
   vorhandene Ressourcenclients bleiben beim Login-Abgleich unverändert und müssen
   ihren eigenen Vertrag erfüllen.
5. Die IAM-Projektion schreibt nur Attribute der vorhandenen Tenant-Subjects und
   Client-Mapper des Browserclients. Ressourcenclient, Studio-Clients und deren
   Secrets bleiben getrennt. Root-Identitäten erhalten keine Tenantrechte.
6. Erst nach dem bestätigten IAM-Read-back provisioniert das Plugin `ssf.tenants`
   idempotent. Danach folgen Client-Aktivierung und gemeinsame Baseline-/Revisionsprüfung.
   Erst dann darf die Projektionsgeneration `ready` werden.
7. Directory und Runtime-Freigabe prüfen denselben produktiven Readiness-Pfad.
   Fehlende Konfiguration, fehlende Baseline, Client-Drift, unbestätigte Revision,
   gesperrter Lifecycle und suspendierte Instanzen bleiben unveröffentlicht.
   Die registrierte Lifecycle-Operation `readiness` prüft ohne Schreibzugriffe
   und verwirft eine zwischenzeitlich gewechselte bestätigte Revision.

## Fehler und Wiederanlauf

- Fehler vor externer Mutation lassen keine neue Freigabe entstehen.
- Ein Abbruch nach Client- oder DB-Anlage wird durch denselben idempotenten Job
  fortgesetzt. Es entsteht kein zweiter Jobtyp oder Retry-Mechanismus.
- Aktivierungs-/Read-back-Fehler sperren die Projektion und versuchen zusätzlich,
  den Browserclient wieder zu deaktivieren. Ein fehlgeschlagener externer Write
  darf keine erfolgreiche Kompensation vortäuschen.
- Konkurrenz zwischen Provisioner und Plugin kann den Browserclient deaktivieren.
  Der aktuelle Read-back verhindert Veröffentlichung eines solchen Zustands; der
  nächste Lifecycle-Abgleich stellt die Voraussetzungen wieder her.
- Die Queue-Einführung verlangt einen koordinierten Worker-Rollout: ältere Worker
  verstehen den Browservertrag nicht und müssen vor neuen V2-Aufträgen ersetzt sein.
- Externe Systeme können nach einer Prüfung ausfallen. Lokale Tests ersetzen
  deshalb weder einen realen OIDC-Flow noch die revisionsgleiche SSF-Abnahme.

## Nachweisplan

- Vertragsvalidierung: erlaubte Konfiguration, fremde Origins/Clients/Audiences,
  Wildcards, Credentials und unerlaubte Felder.
- Core-Adapter: PKCE-/Origin-Drift, öffentliche Clients ohne Secretzugriffe,
  Read-back-Fehler, bestehende Ressourcenclient-Kompatibilität.
- Lifecycle: saubere Erstprovisionierung, falsches gespeichertes `ready`,
  fehlende Baseline, Teilfehler, Generationenkonflikt und Wiederanlauf.
- Directory/Runtime: vor Freigabe unsichtbar; zwei getrennte Mandanten;
  suspendiert, blockiert, fehlende Clients und Revisionsabweichungen.
- PostgreSQL: echter Tenant-Grunddatensatz, RLS und erneuter Claim einer veralteten
  Ready-Generation unter unverändertem Tenant-Lock.
- Abschließend: relevante Unit-, Type-, Runtime-, Lint- und Integrations-Gates.
- Externe Abnahme: zwei echte Realm-Logins bis SSF-Callback/Gateway, falsche
  Audience/Tenant-/Rollenclaims und aktuelle Tokenrevision; Staging und Production
  ausschließlich über den maßgeblichen Rollout-Prozess.

## Aktueller Nachweisstand

Die gezielten Unit- und App-Vertragstests, PostgreSQL-Integration mit Migration
Up/Down, Typechecks und der gebaute Auth-Runtime-Import sind lokal erfolgreich.
Der Zwei-Mandanten-Vertragstest prüft Unsichtbarkeit während aller
Provisionierungsphasen, einen fehlgeschlagenen zweiten Mandanten und dessen Retry.
Die vollständige Complexity-Auswertung meldet keine neuen Findings; bestehende
getrackte Befunde bleiben unverändert. Es gibt keine Schemaänderung.

Offen bleibt die externe Abnahme mit echten Keycloak-Logins, SSF-Callback und
Gateway sowie die Einbindung dieses Nachweises in den konkreten Staging-/Produktionsrollout.
Es wurde kein Deployment durchgeführt; Issue #1319 darf damit noch nicht als
produktiv abgeschlossen bewertet werden.
