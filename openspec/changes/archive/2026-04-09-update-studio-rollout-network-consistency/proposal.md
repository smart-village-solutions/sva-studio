# Change: Rollout-Hardening für Netzwerk- und Ingress-Konsistenz

## Why

Der produktionsnahe Rolloutpfad für `studio` konnte den Live-Service `studio_app` technisch auf `1/1` halten, gleichzeitig aber durch eine unvollständige Service-Spec das Netzwerk `public` verlieren lassen. Das führte zu externem `502`, obwohl Swarm intern grün aussah. Zusätzlich dürfen die temporären `migrate`- und `bootstrap`-Stacks niemals die Live-Spec von `app` beeinflussen.

## What Changes

- Der Deploy-Render für den Live-Stack wird auf vollständige Netzwerk- und Ingress-Konsistenz geprüft, bevor `quantum-cli stacks update` aufgerufen wird.
- Der Acceptance-/Studio-Precheck erweitert Soll-/Live-Drift um netz- und ingressrelevante Service-Felder (`internal`, `public`, Traefik-Labels).
- Der dokumentierte Rolloutvertrag trennt Live-Stack und die bereits eingeführten temporären Job-Stacks verbindlich; Temp-Stacks dürfen keine `app`-Spec ableiten oder mutieren.
- Für `studio` wird ein kanonischer, nicht destruktiver Recovery-Pfad für Netz-/Ingress-Drift dokumentiert.
- Das aktuell gewünschte Live-Image wird wieder bewusst mit `config/runtime/studio.local.vars` konvergiert und über denselben gehärteten `app-only`-Pfad ausgerollt.
- Dieser Change setzt `update-studio-swarm-migration-job` voraus und ergänzt nur Netzwerk-, Ingress- und Reconcile-Regeln statt die Job-Mechanik erneut zu spezifizieren.

## Impact

- Affected specs: `deployment-topology`, `architecture-documentation`
- Affected code: `scripts/ops/runtime-env.ts`, `scripts/ops/runtime/deploy-project.ts`, `scripts/ops/runtime/remote-service-spec.ts`, `config/runtime/studio.local.vars`
- Affected arc42 sections: `07-deployment-view`, `08-cross-cutting-concepts`
