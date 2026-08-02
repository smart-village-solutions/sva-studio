# Erkenntnisse aus dem Studio-Promote vom 2. August 2026

## Ursachen und Auswirkungen

Der Rollout bestätigte das Grundmodell „ein Image, derselbe Digest, gestufte Freigabe“. Die Störungen entstanden an Vertragsgrenzen: Ein älterer Backup-Agent verstand den neuen Waste-Auftrag nicht, eine lokale Override-Datei konnte als vollständiges Remote-Bundle missverstanden werden, und eine vollständige Traefik-Router-Lücke wurde nicht für alle blockierenden Probes einheitlich als Warmup klassifiziert. Dadurch waren manuelle Diagnose und kontrollierte Wiederholungen nötig; das bereits laufende System blieb wiederherstellbar.

## Prävention

- Getrackte nicht-sensitive Remote-Profile und geschützte Overrides werden deterministisch gebaut; lokale Dateien sind keine Remote-Quelle.
- Der neue Builder beginnt im Shadow-Modus und ersetzt die bewährte Deploy-Ausgabe erst nach Dev- und Staging-Nachweis.
- Production verlangt Staging-Parität auch für reine App-Promotions.
- Der Backup-Agent veröffentlicht geschützte Capabilities; Producer werden vor neuen Consumer-Gates ausgerollt.
- Swarm-Konvergenz und HTTP-Warmup werden getrennt bewertet. Production-Readiness verlangt abschließend HTTP 200.
- Stabile redigierte Fehlercodes machen Retry- und Recovery-Entscheidungen nachvollziehbar.

## Recovery-Grenze

Es gibt keinen zweiten Deploymentpfad und keinen automatischen Rollback. `recovery` ist ein ausdrücklich freigegebener Modus desselben Promote-Workflows. Ein App-Rollback verwendet vorherigen Digest und nicht-sensitive Config-Revision; inkompatible Secret-Rotationen benötigen einen eigenen geprüften Plan.
