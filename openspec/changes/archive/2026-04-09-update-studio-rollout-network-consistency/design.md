## Kontext

Die neue Job-Architektur für `migrate` und `bootstrap` ist lokal validiert und nutzt bereits separate temporäre Stacks. Der verbleibende Produktionsfehler lag im Live-Rolloutpfad: Beim Rendern des für Quantum bestimmten Compose-Dokuments wurden null-basierte Netzwerkeinträge weg-normalisiert. Dadurch konnte `studio_app` seine Traefik-relevante `public`-Anbindung verlieren, obwohl der Swarm-Service formal noch lief.

## Entscheidung

### 1. Vollständige App-Spec vor dem Live-Rollout validieren

Der für `quantum-cli stacks update` erzeugte Compose-Render bleibt JSON-basiert, muss aber vor dem Schreiben der Deploy-Artefakte den vollständigen Netzwerkvertrag des `app`-Service validieren:

- `internal` und `public` sind Pflichtnetzwerke
- ingressrelevante Traefik-Labels müssen im Render erhalten bleiben
- top-level `name` wird entfernt, Service-Metadaten bleiben jedoch vollständig

### 2. Soll-/Live-Drift nicht nur auf Image/Env begrenzen

Der Acceptance-/Studio-Precheck vergleicht künftig zusätzlich netz- und ingressrelevante Felder der Live-Spec:

- Netzwerknamen
- Traefik-Labels
- Image-Referenz
- fehlende Secret-/Env-Schlüssel

Ein grüner Swarm-Task bei gleichzeitig rotem externem Live-Check ist damit ein eigenständiges Drift- oder Ingress-Fehlerbild und kein unscharfer Sammelfehler mehr.

### 3. Temp-Job-Stacks bleiben strikt getrennt vom Live-Stack

`migrate` und `bootstrap` laufen weiterhin in separaten temporären Stacks. Diese Stacks dürfen:

- keine Live-`app`-Spec rendern
- keine Live-Service-Definition aktualisieren
- nur das bestehende Overlay-Netz `<stack>_internal` nutzen

Der Live-Stack wird ausschließlich über den gehärteten `app-only`- bzw. `schema-and-app`-Rolloutpfad aktualisiert.

### 4. Recovery bleibt ein dokumentierter Operator-Pfad

Direkte Live-Eingriffe in die Portainer-API gelten als Incident-Recovery, nicht als Standardworkflow. Der kanonische Betriebsweg bleibt:

1. Drift diagnostizieren
2. Ziel-Digest und Render-Compose verifizieren
3. kontrollierten `app-only`-Reconcile ausführen
4. erst bei technischem Blocker auf dokumentierte Service-Reparatur ausweichen
