# IAM-Abnahmevorbereitung: 48h-Checkliste

Stand: `2026-05-25`

## Ziel

Diese Checkliste maximiert in den letzten `48` Stunden vor einer Aufforderung zur IAM-Abnahme die Erfolgschance im Kundentermin und reduziert formale Angriffsflächen.

Sie ist bewusst nicht als allgemeiner Projektplan formuliert, sondern als kurzer operativer Fokus auf die derzeit größten Nachweis- und Abnahmerisiken.

## Arbeitsstand am `2026-05-25`

Die Checkliste ist repo-seitig wie folgt abgearbeitet:

- `WP-005` wurde im Abnahmebericht auf vier verbindliche Vorführ- und Nachweisfälle verdichtet: [wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md](./wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md)
- `WP-006` erhielt einen gebündelten Zusatznachweis für Consent-Enforcement, Export und Negativfall: [wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)
- `WP-003` erhielt ein normiertes Kurzprotokoll für den noch ausstehenden Zielumgebungs-Smoke-Test: [wp-003-zielumgebungs-smoke-test-protokoll-2026-05-25.md](./wp-003-zielumgebungs-smoke-test-protokoll-2026-05-25.md)
- `WP-010` ist auf dieselbe Consent-/Export-Evidence wie `WP-006` synchronisiert: [wp-010-rechtstexte-abnahme-2026-05-25.md](./wp-010-rechtstexte-abnahme-2026-05-25.md)
- die geforderte 1-Seiten-Matrix liegt vor: [2026-05-25-iam-abnahme-1-seiten-matrix.md](./2026-05-25-iam-abnahme-1-seiten-matrix.md)
- ein sprachlich vorsichtiger Entwurf für die Abnahmeaufforderung liegt vor: [2026-05-25-iam-abnahmeaufforderung-entwurf.md](./2026-05-25-iam-abnahmeaufforderung-entwurf.md)

Nicht repo-seitig abschließbar bleiben echte Ziel- oder produktionsnahe Vorführläufe. Diese sind in den neuen bzw. aktualisierten Protokollen explizit als offene Delivery-Evidence markiert.

## Ausgangslage

Die IAM-Leistung ist fachlich weitgehend geliefert und mit eigenständigen WP-Abnahmeprotokollen deutlich besser referenzierbar als in früheren Zwischenständen.

Für die Aufforderung zur Abnahme ist das grundsätzlich ausreichend belastbar. Die größte Restvorsicht liegt aktuell nicht in einer erkennbaren fachlichen Hauptlücke, sondern in noch nachzuziehenden Zielumgebungs-, End-to-End- und Delivery-Evidenzen einzelner Arbeitspakete.

Die wichtigsten offenen Hebel sind derzeit:

1. `WP-005` Rollen, Gruppen, Vererbungen und Geo-Konfliktfälle
2. `WP-006` Consent-, Enforcement- und Export-Evidence
3. `WP-003` Zielumgebungs-Smoke-Test für Organisationshierarchie
4. ein kompaktes Zuordnungsblatt Angebotspaket zu WP zu Nachweis

## Priorisierung

| Priorität | Thema | Warum jetzt |
| --- | --- | --- |
| `P1` | `WP-005` formal schließen | aktuell größte Lücke zwischen technischem Stand und ausdrücklicher fachlicher Endabnahme |
| `P1` | `WP-006` End-to-End-Evidence konsolidieren | rechtlich sensibler Scope; offener Consent-/Export-Nachweis ist leicht angreifbar |
| `P2` | `WP-003` Zielumgebungs-Smoke-Test archivieren | fachlich stark, formal aber noch nicht vollständig geschlossen |
| `P2` | Angebots-Mapping auf 1 Seite | nimmt dem Kunden die Zuordnungsarbeit ab und erhöht Vertragsklarheit |
| `P3` | Terminregie und Vorführreihenfolge finalisieren | erhöht Abnahmesicherheit im Gespräch, schließt aber keine Beweislücke |

## T-48 bis T-36 Stunden

### 1. `WP-005` fachliche Endabnahme vorbereiten und dokumentieren

**Ziel:**
Aus dem aktuellen Stand "technisch weitgehend abgeschlossen, fachliche Endabnahme noch offen" einen abnahmefähigen, kundentauglichen Abschluss machen.

**Konkret erledigen:**

- Zielumgebung oder Integrationsumgebung für die maßgeblichen Konfliktfälle festlegen
- genau vier Vorführ- und Nachweisfälle verbindlich ziehen:
  - Mehrfachherkunft direkt plus Gruppe
  - deaktivierte oder soft-gelöschte Gruppe
  - Gültigkeitsfenster einer Zuweisung
  - Geo Parent-Allow mit Child-Deny
- pro Fall je einen Nachweis sichern:
  - sichtbarer UI-Zustand
  - fachliche Erwartung
  - technischer Effekt
  - Ergebnis mit Datum
- vorhandenen Report zu `WP-005` um eine klare Abnahmeeinschätzung ergänzen:
  - was vorgeführt wurde
  - was erfüllt ist
  - ob noch Restpunkte offen bleiben

**Erwartetes Ergebnis:**

- `WP-005` ist nicht mehr nur technisch weitgehend abgeschlossen, sondern als fachlich abnahmebereit formulierbar.

### 2. `WP-006` Nachweise für Consent, Enforcement und Export bündeln

**Ziel:**
Die aktuell verteilte gute Evidenz in ein kompaktes formales Abnahmepaket überführen.

**Konkret erledigen:**

- einen blockierenden Consent-Fall in Ziel- oder produktionsnaher Umgebung als echten End-to-End-Lauf dokumentieren
- einen erfolgreichen Exportfall mit korrekter Berechtigung dokumentieren
- einen Negativfall ohne Exportberechtigung dokumentieren
- den Restabgleich zwischen Compliance-Scope und finalem Rechtstext-/Consent-Flow explizit schriftlich festhalten
- die Evidence-Dateien oder Screenshots so ablegen, dass sie im Termin direkt referenzierbar sind

**Erwartetes Ergebnis:**

- `WP-006` bleibt nicht nur "gut vorbereitet", sondern wird deutlich näher an formale Freigabereife gezogen.

## T-36 bis T-24 Stunden

### 3. `WP-003` Zielumgebungs-Smoke-Test abschließen

**Ziel:**
Die einzige offen benannte formale Lücke dieses ansonsten starken Pakets schließen.

**Konkret erledigen:**

- Parent-Child-Anlage in Zielumgebung durchführen
- Parent-Child-Re-Zuordnung in Zielumgebung durchführen
- Tenant-Grenzen oder Negativpfad kurz mit dokumentieren
- Hierarchiepfad und stabilen UI-Zustand nach der Änderung sichern
- Nachweis als kurzer Zusatzbericht oder Ergänzung zum bestehenden `WP-003`-Protokoll ablegen

**Erwartetes Ergebnis:**

- `WP-003` kann ohne nennenswerten formalen Vorbehalt in die Abnahmeaufforderung einfließen.

### 4. `WP-010` mit `WP-006` synchron prüfen

**Ziel:**
Verhindern, dass der Consent- und Rechtstextpfad im Termin als inkonsistent wahrgenommen wird.

**Konkret erledigen:**

- prüfen, ob der finale blockierende Akzeptanzflow gegen `WP-010` dieselben Aussagen trägt wie `WP-006`
- prüfen, ob Export- und Negativnachweise deckungsgleich referenzierbar sind
- bei Abweichungen nicht beide Berichte separat ausdiskutieren, sondern einen führenden Nachweis benennen

**Erwartetes Ergebnis:**

- kein Widerspruch zwischen Datenschutz-/Compliance-Argumentation und Rechtstext-/Consent-Argumentation

## T-24 bis T-8 Stunden

### 5. 1-Seiten-Matrix für die Abnahmeaufforderung erstellen

**Ziel:**
Die Rückrichtung zwischen Angebot und Lieferstand auf eine sofort lesbare Seite verdichten.

**Konkret erledigen:**

- Tabelle mit genau diesen Spalten erstellen:
  - Angebots-Paket
  - führende Workpackages
  - tragender Report
  - Vorführschritt im Termin
  - offener Restpunkt
  - Einschätzung `grün`, `gelb`
- nur die wirklich tragenden IAM-Pakete aufführen:
  - `WP-001`
  - `WP-002`
  - `WP-003`
  - `WP-004`
  - `WP-005`
  - `WP-006`
  - `WP-010`
- `rot` nur verwenden, wenn ein Arbeitspaket fachlich nicht vorführbar wäre; nach aktuellem Stand ist das nicht erkennbar

**Erwartetes Ergebnis:**

- ein Dokument, das Management, Kunde und Projektleitung ohne Einarbeitung lesen können

### 6. Abnahmeaufforderung sprachlich sauber vorbereiten

**Ziel:**
Die Aufforderung so formulieren, dass sie selbstbewusst ist, aber keine unnötig harte Behauptung enthält.

**Empfohlene Aussageform:**

- Leistung ist fachlich geliefert und abnahmebereit
- tragende Nachweise liegen paketbezogen vor
- verbleibende Restpunkte betreffen dokumentarische Zielumgebungs- oder End-to-End-Evidenz, nicht den fachlichen Kern der Lieferung
- wir bitten um Termin zur formalen Abnahme bzw. gemeinsamen Abnahmedurchsprache

**Vermeiden:**

- "vollständig formal abgeschlossen"
- "alle Nachweise bereits abschließend archiviert"
- "keine Restpunkte mehr"

## T-8 bis T-0 Stunden

### 7. Kundentermin auf Abnahmeerfolg trimmen

**Ziel:**
Im Gespräch zuerst Stärke zeigen, dann Restpunkte kontrolliert einordnen.

**Empfohlene Reihenfolge im Termin:**

1. `WP-001` Login, Tenant-Scope, Auth-Basis
2. `WP-002` Accounts und Profile
3. `WP-003` Organisation und Hierarchie
4. `WP-005` Rollen, Gruppen, Vererbungen, Transparenz
5. `WP-004` zentraler Authorize-Pfad und Performance
6. `WP-006` Datenschutz, Consent, Export
7. `WP-010` Rechtstexte und Akzeptanzsystem
8. Abschluss mit Abnahmeaufforderung und transparenter Restpunkte-Einordnung

### 8. Restpunkte aktiv kontrollieren

**Im Termin nicht defensiv formulieren, sondern so:**

- Restpunkte sind bekannt
- Restpunkte sind dokumentiert
- Restpunkte betreffen formale Abrundung einzelner Zielumgebungs- oder Delivery-Evidenzen
- Restpunkte stellen den fachlichen Leistungsstand nicht in Frage

## Minimaler Muss-Umfang

Wenn die Zeit nicht für alles reicht, ist diese Reihenfolge bindend:

1. `WP-005` Zielumgebungs- und Konfliktnachweise schließen
2. `WP-006` Consent-/Export-End-to-End-Nachweise konsolidieren
3. `WP-003` Hierarchie-Smoke-Test archivieren
4. 1-Seiten-Matrix Angebot zu Nachweis erstellen

## Go-/No-Go-Einschätzung

### Go für Abnahmeaufforderung

Wenn diese vier Punkte erfüllt sind, sollte die Aufforderung zur Abnahme mit guter Erfolgschance vertretbar sein:

- `WP-005` ist fachlich nicht mehr offen formuliert
- `WP-006` hat mindestens einen echten Consent- und einen Export-Nachweis plus Negativfall
- `WP-003` hat den archivierten Zielumgebungs-Smoke-Test
- die Angebotszuordnung liegt kompakt auf einer Seite vor

### Gelber Reststatus bleibt akzeptabel

Auch dann darf die Aufforderung zur Abnahme noch erfolgen, wenn:

- einzelne optionale Delivery-Artefakte noch nicht perfekt normiert sind
- nicht jeder Zusatznachweis bereits im finalen Außenformat vorliegt
- operative Ergänzungen wie zusätzliche Screenshots oder Exportbeispiele noch nachsortiert werden

### No-Go

Vor einer Aufforderung zur Abnahme sollte gestoppt werden, wenn einer dieser Fälle eintritt:

- `WP-005` bleibt fachlich ausdrücklich offen
- der Consent-Blocker in `WP-006` lässt sich nicht reproduzierbar vorführen
- `WP-003` zeigt in Zielumgebung inkonsistentes Hierarchieverhalten
- die Paket-zu-Nachweis-Zuordnung bleibt im Termin nur mündlich und nicht dokumentiert

## Empfehlung

Mit zusätzlichen `48` Stunden würde ich nicht weiter in allgemeine Begründungstexte investieren, sondern nur diese Abfolge verfolgen:

1. `WP-005` schließen
2. `WP-006` konsolidieren
3. `WP-003` archivieren
4. kompakte Angebots-Matrix und Abnahmeaufforderung vorbereiten

Genau diese Reihenfolge erhöht die Chance auf eine erfolgreiche Abnahmeaufforderung am stärksten, weil sie die letzten echten Nachweis- und Gesprächsrisiken reduziert.
