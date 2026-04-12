# Studio-Instanz Browser-Testgrundlage

## Zweck

Dieses Dokument beschreibt die wichtigsten Funktionen einer Studio-Instanz als fachliche Grundlage für weitere In-Browser-Tests gegen eine konkrete Tenant-URL wie `http://de-musterhausen.studio.localhost:3000`.

Ziel ist kein vollständiger Testkatalog, sondern ein stabiler Kern an Benutzerreisen, Navigationszielen und erwarteten Funktionsbereichen, die in manuellen Prüfungen, Playwright-Skripten oder Smoke-Tests wiederverwendet werden können.

## Geltungsbereich

- Beispiel-Instanz: `de-musterhausen`
- Beispiel-URL lokal: `http://de-musterhausen.studio.localhost:3000`
- Gültig für die Studio-Shell mit tenantbezogener Navigation und rollenabhängigen Bereichen

## Sichtbare Grundfunktionen ohne aktive Sitzung

Diese Funktionen sollten auch ohne vollständig geladene Nutzersitzung sichtbar oder grundsätzlich erreichbar sein:

- Startseite der Studio-Instanz
- Sprachumschaltung `DE` und `EN`
- Theme-Umschaltung hell/dunkel
- Skip-Link zum Hauptinhalt
- Systemstatus-Panel für:
  - Postgres
  - Redis
  - Keycloak
  - Autorisierungs-Cache
- lokale Log-Konsole in der Entwicklungsumgebung

## Zentrale Funktionsbereiche mit Sitzung

Nach erfolgreicher Anmeldung erscheint die Sidebar mit den für Rolle und Feature-Flags freigegebenen Bereichen.

### 1. Übersicht

- Route: `/`
- Zweck:
  - Einstieg in die Instanz
  - Übersicht über zentrale Arbeitsbereiche
  - Schnellzugriffe auf Inhalte, Konto und Schnittstellen

### 2. Konto

- Routen:
  - `/account`
  - `/account/privacy`
- Zweck:
  - eigenes Profil anzeigen
  - Kontokontext prüfen
  - Datenschutz- und Privatsphäre-bezogene Informationen anzeigen

### 3. Inhaltsverwaltung

- Routen:
  - `/content`
  - `/content/new`
  - `/content/$contentId`
- Zweck:
  - Inhalte auflisten
  - Inhalte filtern und durchsuchen
  - neuen Inhalt anlegen
  - bestehenden Inhalt lesen oder bearbeiten

### 4. Schnittstellen

- Route: `/interfaces`
- Zweck:
  - Status externer Schnittstellen prüfen
  - tenantbezogene Schnittstellenkonfiguration laden
  - Konfiguration speichern
  - Fehlerzustände verständlich anzeigen

### 5. Benutzer- und Rechteverwaltung

- Routen:
  - `/admin/users`
  - `/admin/users/new`
  - `/admin/users/$userId`
  - `/admin/organizations`
  - `/admin/organizations/new`
  - `/admin/organizations/$organizationId`
  - `/admin/instances`
  - `/admin/instances/new`
  - `/admin/instances/$instanceId`
  - `/admin/roles`
  - `/admin/roles/new`
  - `/admin/roles/$roleId`
  - `/admin/groups`
  - `/admin/groups/new`
  - `/admin/groups/$groupId`
  - `/admin/legal-texts`
  - `/admin/legal-texts/new`
  - `/admin/legal-texts/$legalTextVersionId`
  - `/admin/iam`
- Zweck:
  - Nutzer anlegen, suchen, filtern, bearbeiten und deaktivieren
  - Organisationen und Mitgliedschaften verwalten
  - Instanzen pflegen und Provisioning-Status prüfen
  - Rollen und Gruppen verwalten
  - Rechtstexte verwalten
  - effektive Berechtigungen, Governance- und Datenschutzfälle im IAM-Cockpit prüfen

## Vorbereitete, aber aktuell nur als Platzhalter integrierte Bereiche

Diese Bereiche sind navigierbar, stellen derzeit aber vor allem Shell-, Routing- und Berechtigungsintegration sicher:

- `/media`
- `/categories`
- `/app`
- `/modules`
- `/monitoring`
- `/help`
- `/support`
- `/license`

Für Browser-Tests sollten diese Bereiche aktuell nur auf Erreichbarkeit, korrekte Seitentitel und stabile Shell-Integration geprüft werden, nicht auf tiefe Fachlogik.

## Rollenabhängigkeit

Die Navigation ist nicht statisch. Sichtbarkeit und Erreichbarkeit einzelner Bereiche hängen von Authentifizierung, Rollen und Feature-Flags ab.

Für Browser-Tests ist deshalb zwischen mindestens drei Nutzungsarten zu unterscheiden:

- ohne Anmeldung
  - nur öffentliche Shell- und Startseitenfunktionen
- mit Standard-Arbeitskonto
  - Übersicht, Konto, Inhalte und gegebenenfalls Schnittstellen
- mit Admin-/IAM-Konto
  - zusätzliche Bereiche unter `/admin/*`, IAM-Cockpit, Instanz- und Rollenverwaltung

## Empfohlene Kernreisen für Browser-Tests

Diese Kernreisen bilden den wichtigsten fachlichen und technischen Mindestumfang ab.

### A. Öffentliche Instanz-Erreichbarkeit

- Instanz-URL aufrufen
- Startseite rendert ohne White Screen
- Sprache wechseln
- Theme wechseln
- Systemstatus-Widget ist sichtbar

### B. Anmeldung und Shell-Aktivierung

- Sitzung laden oder Login auslösen
- Header bleibt bedienbar
- Sidebar erscheint nach erfolgreicher Authentifizierung
- Navigation reagiert ohne Vollseitenfehler

### C. Konto und Datenschutz

- `/account` öffnen
- Profilinformationen oder Statusbereich prüfen
- `/account/privacy` öffnen
- Datenschutzbezogene Inhalte und Status prüfen

### D. Inhaltsverwaltung

- `/content` öffnen
- Liste rendert
- Suche oder Filter reagieren
- neuen Inhalt anlegen oder Editor öffnen
- Detailroute `/content/$contentId` rendert stabil

### E. Schnittstellenverwaltung

- `/interfaces` öffnen
- bestehende Konfiguration laden
- Verbindungsstatus anzeigen
- Formularänderung speichern
- Erfolg oder fachlicher Fehler wird sichtbar dargestellt

### F. IAM- und Admin-Bereiche

- `/admin/users` öffnen
- Listenansicht, Filter und Detailnavigation prüfen
- `/admin/organizations` und `/admin/roles` öffnen
- `/admin/groups` öffnen
- `/admin/iam` öffnen
- Tabs, Filter und Detailbereiche ohne Laufzeitfehler prüfen

## Minimale Assertions für Automation

Unabhängig vom konkreten Testfall sollten Browser-Tests möglichst diese stabilen Aussagen prüfen:

- Seite rendert mit genau einem Hauptinhalt
- Header bleibt sichtbar und interaktiv
- Route-Wechsel verursachen keinen unerwarteten Fehler-Fallback
- leere Zustände, Ladezustände und Fehlerzustände sind lesbar
- geschützte Bereiche sind ohne passende Rolle nicht stillschweigend offen
- sichtbare Navigationspunkte passen zum Sitzungs- und Rollenstatus

## Hinweise für die spätere Testautomatisierung

- Tests sollten tenantbezogen gegen die konkrete Hostname-Variante laufen
- öffentliche und authentifizierte Szenarien getrennt aufbauen
- Admin-Szenarien getrennt von Standardnutzer-Szenarien ausführen
- Platzhalterseiten nur auf Routing und Shell-Verhalten prüfen
- bei Admin-Bereichen zusätzlich Rechtefehler und leere Zustände abdecken

## Priorität für den nächsten Ausbauschritt

Wenn aus diesem Dokument konkrete In-Browser-Tests abgeleitet werden, sollte die Reihenfolge wie folgt sein:

1. öffentliche Instanz-Erreichbarkeit und Shell-Grundfunktionen
2. Authentifizierung und Sichtbarkeit der tenantbezogenen Navigation
3. Konto und Inhalte
4. Schnittstellen
5. IAM- und Admin-Funktionen
