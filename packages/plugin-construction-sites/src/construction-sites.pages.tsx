import { useParams } from '@tanstack/react-router';
import {
  usePluginTranslation,
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
} from '@sva/plugin-sdk';
import { StudioContentHistory, type MainserverPrincipalControlModel } from '@sva/studio-ui-react';
import { CONSTRUCTION_SITES_TYPE } from './contract.js';
import { useConstructionSiteAccess } from './construction-sites.access.js';
import { useConstructionSiteEditor } from './construction-sites.editor-state.js';
import { ConstructionSiteEditor } from './construction-sites.editor.js';

type Props = Readonly<{ principalControl?: MainserverPrincipalControlModel }>;
function ConstructionSiteHistory({ id }: Readonly<{ id: string }>) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <StudioContentHistory
      contentId={id}
      loadHistory={(contentId) =>
        fetchIamContentHistory(contentId, { contentType: CONSTRUCTION_SITES_TYPE })
      }
      labels={{
        loading: pt('history.loading'),
        error: pt('history.error'),
        empty: pt('history.empty'),
        createHint: pt('history.createHint'),
        tableLabel: pt('history.tableLabel'),
        time: pt('history.time'),
        action: pt('history.action'),
        actor: pt('history.actor'),
        summary: pt('history.summary'),
        sourceNotice: pt('history.sourceNotice'),
        emptySummary: pt('history.emptySummary'),
      }}
      formatAction={(action) =>
        pt(
          action === 'created'
            ? 'history.created'
            : action === 'status_changed'
              ? 'history.statusChanged'
              : 'history.updated'
        )
      }
      formatDate={(date) => formatDateTimeInEditorTimeZone(date) ?? date}
    />
  );
}
function Editor({ id, scope, principalControl }: Props & Readonly<{ id?: string; scope: string }>) {
  const state = useConstructionSiteEditor(id, scope, principalControl?.value);
  return (
    <ConstructionSiteEditor
      state={state}
      principalControl={principalControl}
      history={id ? <ConstructionSiteHistory id={id} /> : null}
    />
  );
}
function ScopedEditor({ id, ...props }: Props & Readonly<{ id?: string }>) {
  const { session } = useConstructionSiteAccess();
  const scope = JSON.stringify([session.instanceId, session.subjectId, session.organizationId]);
  return <Editor key={`${scope}:${id ?? 'new'}`} {...props} id={id} scope={scope} />;
}
export function ConstructionSitesCreatePage(props: Props) {
  return <ScopedEditor {...props} />;
}
export function ConstructionSitesEditPage(props: Props) {
  const { id } = useParams({ strict: false }) as { id?: string };
  return <ScopedEditor {...props} id={id} />;
}
