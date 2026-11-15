/** Compose page-owned runtime field groups without owning persistence. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';
import type { SsfV2EditorProps } from './admin.content-v2-field-control.js';
import { BrandingFields, FeedbackFields } from './admin.content-v2-fields.js';
import { GuestLanguages } from './admin.content-v2-guest-fields.js';
import { SsfLegalTextsEditor } from './admin.content-v2-legal-fields.js';
import { RecordingFields } from './admin.content-v2-recording-fields.js';
import { StaffFields } from './admin.content-v2-staff-fields.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
export type SsfRuntimeEditorProps = SsfV2EditorProps<SsfRuntimeContentV2Fields> &
  Readonly<{
    supportedLanguages: SsfSupportedLanguagesCatalog | null;
    existingGuestLocales?: readonly string[];
    part?: 'all' | 'metadata' | 'texts' | 'feedback';
  }>;
export type SsfGuestLanguage = SsfRuntimeContentV2Fields['guestLanguages'][number];
type Props = SsfRuntimeEditorProps;
type RuntimePage =
  | 'appearance'
  | 'languages'
  | 'recordings'
  | 'feedback'
  | 'default-configuration'
  | 'default-content';
type PageProps = Props & { page: RuntimePage };
const pageGroups = {
  appearance: ['appearance', 'staff', 'guests'],
  recordings: ['settings', 'retention', 'wording'],
  feedback: ['staff', 'guests'],
  'default-configuration': ['languages', 'settings', 'retention'],
  'default-content': ['appearance', 'staff', 'guests', 'wording', 'feedback'],
  languages: ['languages'],
} as const;
const errorGroup = (path: string, groups: readonly string[], page: RuntimePage): string => {
  if (path.startsWith('branding')) return 'appearance';
  if (path.startsWith('legalTexts') || path.startsWith('recording.texts')) return 'wording';
  if (
    ['recording.retention', 'recording.audit', 'recording.timestamp'].some((prefix) =>
      path.startsWith(prefix)
    )
  )
    return 'retention';
  if (path.startsWith('recording')) return 'settings';
  if (path.includes('feedback') && groups.includes('feedback')) return 'feedback';
  if (path.startsWith('guestLanguages'))
    return groups.includes('languages') ? 'languages' : 'guests';
  return page === 'languages' || page === 'default-configuration' ? 'languages' : 'staff';
};
const RuntimeGroup = ({ group, ...props }: PageProps & { group: string }) => {
  switch (group) {
    case 'appearance':
      return <BrandingFields {...props} />;
    case 'languages':
      return (
        <>
          <StaffFields {...props} part="metadata" />
          <GuestLanguages {...props} part="metadata" />
        </>
      );
    case 'staff':
      return props.page === 'feedback' ? (
        <FeedbackFields {...props} path={['staff', 'feedback']} />
      ) : (
        <StaffFields {...props} part="texts" />
      );
    case 'guests':
      return <GuestLanguages {...props} part={props.page === 'feedback' ? 'feedback' : 'texts'} />;
    case 'settings':
      return <RecordingFields {...props} section="settings" />;
    case 'retention':
      return <RecordingFields {...props} section="retention" />;
    case 'wording':
      return (
        <>
          <RecordingFields {...props} section="wording" />
          <SsfLegalTextsEditor {...props} />
        </>
      );
    case 'feedback':
      return (
        <>
          <FeedbackFields {...props} path={['staff', 'feedback']} />
          <GuestLanguages {...props} part="feedback" />
        </>
      );
    default:
      return null;
  }
};
export const SsfRuntimeV2Editor = (props: PageProps) => {
  const pt = usePluginTranslation('ssf');
  const groups: readonly string[] = pageGroups[props.page];
  const [selected, setSelected] = useState(groups[0]!);
  useEffect(() => {
    const path = Object.keys(props.errors ?? {})[0];
    if (!path) return;
    const group = errorGroup(path, groups, props.page);
    if (groups.includes(group)) setSelected(group);
  }, [props.errors, props.page]);
  return (
    <div className="space-y-5">
      {!props.supportedLanguages ? (
        <p role="status">{pt('v2.languageCatalogUnavailable')}</p>
      ) : null}
      {groups.length === 1 ? (
        <RuntimeGroup {...props} group={groups[0]!} />
      ) : (
        <Tabs value={selected} onValueChange={setSelected}>
          <TabsList
            className="flex max-w-full flex-wrap justify-start"
            aria-label={pt(`administration.pages.${props.page}`)}
          >
            {groups.map((group) => (
              <TabsTrigger key={group} value={group}>
                {pt(`administration.sections.${group}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map((group) => (
            <TabsContent key={group} value={group} forceMount hidden={selected !== group}>
              <RuntimeGroup {...props} group={group} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};
