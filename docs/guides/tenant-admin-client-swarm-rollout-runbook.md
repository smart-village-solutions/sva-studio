# Historischer Tenant-Admin-Client-Cutover

Status: **abgeschlossen – keine Betriebsanweisung**

Dieses Dokument bleibt nur als stabiler Verweis auf den einmaligen Cutover der Migrationen `0030` und `0031` erhalten. Die früheren manuellen Migrations-, Backfill- und Deploy-Kommandos wurden entfernt, weil sie nicht auf heutige Umgebungen übertragen werden dürfen.

Neue Änderungen am Tenant-Admin-Client werden als normale Migration beziehungsweise Bootstrap-Risiken klassifiziert und ausschließlich nach dem [kanonischen Studio-Rollout](./studio-rollout-process.md) erst nach Staging und anschließend mit demselben Digest nach Production befördert.
