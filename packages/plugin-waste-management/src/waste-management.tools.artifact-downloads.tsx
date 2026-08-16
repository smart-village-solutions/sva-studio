import type { StudioJobResponse } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';

import { formatUpdatedAt } from './waste-management.page.support.js';

export const WasteToolsArtifactDownloads = ({ job }: { readonly job: StudioJobResponse['data'] }) => {
  const pt = usePluginTranslation('wasteManagement');
  const artifacts = job.resultPayload?.artifacts ?? [];
  if (job.status !== 'succeeded' || artifacts.length === 0) return null;
  return (
    <section className="space-y-2 rounded-xl border border-border/70 bg-background/80 p-4">
      <h3 className="text-sm font-semibold">{pt('tools.meta.downloadsTitle')}</h3>
      <div className="flex flex-wrap gap-2">
        {artifacts.map((artifact) => (
          <a
            key={artifact.artifactId}
            className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            href={`/api/v1/plugin-operations/jobs/${encodeURIComponent(job.id)}/artifacts/${encodeURIComponent(artifact.artifactId)}`}
          >
            {pt('tools.meta.downloadArtifact', { fileName: artifact.fileName })}
          </a>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {pt('tools.meta.downloadExpiresAt', { value: formatUpdatedAt(artifacts[0].expiresAt) })}
      </p>
    </section>
  );
};
