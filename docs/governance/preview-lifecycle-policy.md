# Preview-Lifecycle-Policy (Create/Update/Destroy)

## Ziel und Geltungsbereich

Diese Policy definiert den verbindlichen Lifecycle fuer PR-Preview-Umgebungen im Repository SVA Studio. Sie gilt plattformneutral fuer:

- Managed Preview-Plattformen (z. B. Vercel)
- Self-hosted Preview-Laufzeiten (z. B. VM/Kubernetes)

Nicht erlaubt sind manuelle Sonderwege je Teammitglied. Jeder offene PR folgt exakt demselben Lifecycle und endet immer mit automatischer Entsorgung.

## Event-zu-Aktion-Mapping (genau ein Schritt pro Event)

| PR-Event | Lifecycle-Schritt (genau 1) | Verbindliches Ergebnis |
| --- | --- | --- |
| `opened` | `CREATE_AND_PUBLISH` | Preview-Umgebung wird erstellt und URL veroeffentlicht |
| `synchronize` | `UPDATE_AND_REPUBLISH` | Bestehende Preview-Umgebung wird aktualisiert und URL erneut veroeffentlicht |
| `closed` | `DESTROY_AND_CLEANUP` | Preview-Umgebung und alle zugehoerigen Ressourcen werden vollstaendig entfernt |

Akzeptanzregel: Fuer jeden der drei Events existiert genau ein Lifecycle-Schritt. Zusatzevents (z. B. `reopened`) sind hier bewusst nicht Teil des Minimalvertrags.

## URL-Publishing-Strategie

Die URL-Verteilung folgt einem einheitlichen 3-Kanal-Modell, unabhaengig von der Plattform:

1. **Deployment API (kanonisch):** GitHub Deployment-Objekt mit `environment=preview/pr-<nummer>` und `environment_url=<preview-url>`.
2. **Status Check:** Check-Run `preview/url-published` mit derselben URL im Summary-Output.
3. **PR-Kommentar (sticky):** Ein einziger fortgeschriebener Bot-Kommentar `Preview URL: <preview-url>` (kein Kommentar-Spam).

Verbindliche Reihenfolge pro erfolgreichem `opened`/`synchronize`: Deployment API -> Status Check -> Sticky Kommentar.

## TTL- und Ablaufregeln (numerisch, hart)

- Inaktivitaets-TTL: `7` Tage ohne `synchronize`-Event -> Preview wird als `stale` markiert.
- Hard-TTL: `14` Tage seit letzter erfolgreicher Bereitstellung -> automatische Zerstoerung auch ohne PR-Close.
- Reaktions-SLA fuer `closed`: Zerstoerung startet spaetestens innerhalb von `15` Minuten nach Event-Eingang.
- Deprovisioning-Zeitbudget: Vollstaendiges Cleanup muss innerhalb von `2` Stunden abgeschlossen sein.

Verbot: Unbegrenzte Lebensdauer von Preview-Umgebungen.

## Cleanup-Regeln (Pflicht, Erfolgs- und Fehlerpfad)

### Erfolgspfad (`DESTROY_AND_CLEANUP` erfolgreich)

Die Zerstoerung gilt nur als erfolgreich, wenn alle Ressourcenklassen entfernt oder auf `inactive` gesetzt wurden:

1. **Compute:** Container/Serverless/Pod-Instanzen stoppen und loeschen.
2. **Storage:** Temporare Volumes, Build-Artefakte und Preview-Buckets loeschen.
3. **DNS:** Preview-Subdomain (`pr-<nummer>.*`) entfernen.
4. **GitHub Deployment-Objekte:** Deployment-Status auf `inactive` setzen.
5. **Metadata:** Interne Zuordnung (`pr_number`, `deployment_id`, `preview_url`, TTL-Timestamps) loeschen.

Abschlusskriterium: Status Check `preview/cleanup` = `success`.

### Fehlerpfad (`DESTROY_AND_CLEANUP` fehlgeschlagen)

Wenn ein Cleanup-Teilschritt fehlschlaegt, ist folgendes Retry-/Eskalationsschema verpflichtend:

- Retry 1: nach `5` Minuten
- Retry 2: nach `15` Minuten
- Retry 3: nach `60` Minuten
- Maximal `3` automatisierte Retries, danach Eskalation an Maintainer-On-Call mit Incident-Label `preview-cleanup-failed`.

Pflicht bei Fehler:

- Betroffene Ressourcenliste inkl. Typ (`compute|storage|dns|deployment|metadata`) im Fehler-Log dokumentieren.
- PR-Kommentar mit Fehlerstatus aktualisieren.
- Zombie-Praevention aktivieren: taeglicher Sweep-Job (`24` Stunden Takt) sucht verwaiste Preview-Ressourcen und erzwingt Nach-Cleanup.

## Compliance-Regeln

- Keine Preview ohne automatische Entsorgung.
- Keine personenspezifischen Ausnahmen ausserhalb dieser Policy.
- Dieselben Lifecycle-Schritte gelten fuer Vercel und self-hosted; nur technische Adapter unterscheiden sich.
- Diese Policy beschreibt Governance, keine plattformspezifischen Deploy-Kommandos.
