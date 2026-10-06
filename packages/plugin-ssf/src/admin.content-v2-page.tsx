import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button, StudioErrorState, StudioFormActionBar, StudioFormSummary,
  StudioLoadingState, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useState } from 'react';

import {
  readSsfSystemContentV2, writeSsfSystemContentV2,
} from './admin-api.js';
import {
  blankSsfInstallationV2, blankSsfRuntimeTemplateV2,
  SsfInstallationV2Editor,
} from './admin.content-v2-fields.js';
import { SsfRuntimeV2Editor } from './admin.content-v2-runtime-fields.js';
import {
  ssfInstallationContentV2FieldsSchema, ssfRuntimeContentV2FieldsSchema,
  type SsfInstallationContentV2Fields, type SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';
import type { SsfSystemContentV2View } from './content-v2-admin-contracts.js';

type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved' | 'invalid';
const fieldErrors = (issues: readonly { path: PropertyKey[] }[], message: string): Record<string, string> =>
  Object.fromEntries(issues.map((issue) => [issue.path.join('.'), message]));

type Section = 'installation' | 'runtimeTemplate';
const editableSystemContent = (saved: SsfSystemContentV2View) => {
  const defaultLocale = saved.supportedLanguages?.admin_default;
  const installation = saved.installation ?? blankSsfInstallationV2();
  const runtimeTemplate = saved.runtimeTemplate ?? blankSsfRuntimeTemplateV2();
  return {
    installation: saved.installation || !defaultLocale ? installation : {
      ...installation, localization: { ...installation.localization, locale: defaultLocale },
    },
    runtimeTemplate: saved.runtimeTemplate || !defaultLocale ? runtimeTemplate : {
      ...runtimeTemplate, staff: { ...runtimeTemplate.staff, locale: defaultLocale },
    },
  };
};

const discardSection = (
  section: Section, saved: SsfSystemContentV2View,
  setInstallation: (value: SsfInstallationContentV2Fields) => void,
  setRuntimeTemplate: (value: SsfRuntimeContentV2Fields) => void
) => {
  if (section === 'installation') setInstallation(saved.installation ?? blankSsfInstallationV2());
  else setRuntimeTemplate(saved.runtimeTemplate ?? blankSsfRuntimeTemplateV2());
};

const commitSection = async (
  section: Section,
  installation: SsfInstallationContentV2Fields,
  runtimeTemplate: SsfRuntimeContentV2Fields
): Promise<{ kind: 'invalid'; issues: readonly { path: PropertyKey[] }[] } |
  { kind: 'saved'; next: SsfSystemContentV2View }> => {
  const parsed = section === 'installation'
    ? ssfInstallationContentV2FieldsSchema.safeParse(installation)
    : ssfRuntimeContentV2FieldsSchema.safeParse(runtimeTemplate);
  if (!parsed.success) return { kind: 'invalid', issues: parsed.error.issues };
  const next = await writeSsfSystemContentV2({
    installation: section === 'installation' ? installation : null,
    runtimeTemplate: section === 'runtimeTemplate' ? runtimeTemplate : null,
  });
  return { kind: 'saved', next };
};

type SectionProps = {
  section: Section;
  saved: SsfSystemContentV2View;
  installation: SsfInstallationContentV2Fields;
  runtimeTemplate: SsfRuntimeContentV2Fields;
  setInstallation: (value: SsfInstallationContentV2Fields) => void;
  setRuntimeTemplate: (value: SsfRuntimeContentV2Fields) => void;
  status: Status;
  errors: Record<string, string>;
  supportedLanguages: SsfSystemContentV2View['supportedLanguages'] | null;
  onSave: (section: Section) => void;
  onDiscard: (section: Section) => void;
};

const SystemContentSection = ({ section, saved, installation, runtimeTemplate,
  setInstallation, setRuntimeTemplate, status, errors, supportedLanguages, onSave, onDiscard }: SectionProps) => {
  const pt = usePluginTranslation('ssf');
  return <TabsContent value={section} className="space-y-5">
    {section === 'installation' && !supportedLanguages ? <p className="text-sm text-muted-foreground" role="status">
      {pt('v2.languageCatalogUnavailable')}
    </p> : null}
    {saved[section] === null ? <p className="text-sm text-muted-foreground">{pt('v2.notConfigured')}</p> : null}
    {status === 'saved' ? <StudioFormSummary kind="success">{pt('status.saved')}</StudioFormSummary> : null}
    {status === 'invalid' ? <StudioFormSummary kind="error">{pt('v2.invalid')}</StudioFormSummary> : null}
    {status === 'error' ? <StudioFormSummary kind="error">{pt('status.saveError')}</StudioFormSummary> : null}
    {section === 'installation'
      ? <SsfInstallationV2Editor value={installation} onChange={setInstallation} errors={errors}
        disabled={status === 'saving'} supportedLanguages={supportedLanguages ?? null} />
      : <SsfRuntimeV2Editor value={runtimeTemplate} onChange={setRuntimeTemplate} errors={errors}
        disabled={status === 'saving'} supportedLanguages={supportedLanguages ?? null} />}
    <StudioFormActionBar>
      <Button type="button" variant="secondary" disabled={status === 'saving'} onClick={() => onDiscard(section)}>
        {pt('actions.discard')}
      </Button>
      <Button type="button" disabled={status === 'saving'} onClick={() => onSave(section)}>
        {pt(status === 'saving' ? 'actions.saving' : 'actions.save')}
      </Button>
    </StudioFormActionBar>
  </TabsContent>;
};

export const SsfSystemContentV2Page = () => {
  const pt = usePluginTranslation('ssf');
  const [saved, setSaved] = useState<SsfSystemContentV2View | null>(null);
  const [installation, setInstallation] = useState<SsfInstallationContentV2Fields | null>(null);
  const [runtimeTemplate, setRuntimeTemplate] = useState<SsfRuntimeContentV2Fields | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      const next = await readSsfSystemContentV2();
      setSaved(next);
      const editable = editableSystemContent(next);
      setInstallation(editable.installation);
      setRuntimeTemplate(editable.runtimeTemplate);
      setStatus('ready');
    } catch { setStatus('error'); }
  }, []);
  useEffect(() => void load(), [load]);
  const save = async (section: 'installation' | 'runtimeTemplate') => {
    if (!installation || !runtimeTemplate) return;
    setStatus('saving');
    try {
      const result = await commitSection(section, installation, runtimeTemplate);
      if (result.kind === 'invalid') {
        setErrors(fieldErrors(result.issues, pt('v2.invalid')));
        setStatus('invalid');
        return;
      }
      setErrors({});
      setSaved(result.next);
      setInstallation(result.next.installation ?? installation);
      setRuntimeTemplate(result.next.runtimeTemplate ?? runtimeTemplate);
      setStatus('saved');
    } catch { setStatus('error'); }
  };
  const discard = (section: Section) => {
    if (!saved) return;
    discardSection(section, saved, setInstallation, setRuntimeTemplate);
    setErrors({});
    setStatus('ready');
  };
  if (status === 'loading') return <StudioLoadingState>{pt('status.loading')}</StudioLoadingState>;
  if (!saved || !installation || !runtimeTemplate) {
    return <StudioErrorState><button type="button" onClick={() => void load()}>{pt('status.loadError')}</button></StudioErrorState>;
  }
  return (
    <Tabs defaultValue="installation">
      <TabsList aria-label={pt('page.systemTitle')}>
        <TabsTrigger value="installation">{pt('v2.installation')}</TabsTrigger>
        <TabsTrigger value="runtimeTemplate">{pt('v2.template')}</TabsTrigger>
      </TabsList>
      {(['installation', 'runtimeTemplate'] as const).map((section) => (
        <SystemContentSection key={section} section={section} saved={saved}
          installation={installation} runtimeTemplate={runtimeTemplate}
          setInstallation={setInstallation} setRuntimeTemplate={setRuntimeTemplate}
          supportedLanguages={saved.supportedLanguages ?? null}
          status={status} errors={errors} onSave={(target) => void save(target)} onDiscard={discard} />
      ))}
    </Tabs>
  );
};
