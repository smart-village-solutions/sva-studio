/** Supported feedback question controls preserve uneditable data. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioSection } from '@sva/studio-ui-react';

import {
  SsfV2Field as Field,
  readSsfV2Path as readPath,
  type SsfV2EditorProps as EditorProps,
} from './admin.content-v2-field-control.js';
import type {
  SsfInstallationContentV2Fields,
  SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';

type FormValue = SsfInstallationContentV2Fields | SsfRuntimeContentV2Fields;
type Path = readonly (string | number)[];

export const FeedbackFields = <T extends FormValue>(props: EditorProps<T> & { path: Path }) => {
  const pt = usePluginTranslation('ssf');
  const feedback = readPath(
    props.value,
    props.path
  ) as SsfInstallationContentV2Fields['localization']['feedback'];
  const known = new Set([
    'translationQuality',
    'performance',
    'usability',
    'recommendation',
    'improvementIdeas',
  ]);
  return (
    <StudioSection title={pt('v2.feedback')}>
      <Field {...props} path={[...props.path, 'headline']} labelKey="v2.formHeadline" />
      {feedback.questions.map((question, index) =>
        known.has(question.id) ? (
          <details key={question.id} className="rounded-lg border border-border/70 p-4">
            <summary className="cursor-pointer font-medium">
              {question.headline || pt(`v2.questions.${question.id}`)}
            </summary>
            <div className="mt-4 space-y-4">
              <Field
                {...props}
                path={[...props.path, 'questions', index, 'headline']}
                labelKey="v2.questionHeadline"
              />
              <Field
                {...props}
                path={[...props.path, 'questions', index, 'question']}
                labelKey="v2.questionText"
              />
              <Field
                {...props}
                path={[...props.path, 'questions', index, 'required']}
                labelKey="v2.required"
                kind="checkbox"
              />
              {question.type === 'scale' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    {...props}
                    path={[...props.path, 'questions', index, 'minLabel']}
                    labelKey="v2.minLabel"
                  />
                  <Field
                    {...props}
                    path={[...props.path, 'questions', index, 'maxLabel']}
                    labelKey="v2.maxLabel"
                  />
                </div>
              ) : null}
              {question.type === 'longText' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    {...props}
                    path={[...props.path, 'questions', index, 'placeholder']}
                    labelKey="v2.placeholder"
                  />
                  <Field
                    {...props}
                    path={[...props.path, 'questions', index, 'maxLength']}
                    labelKey="v2.maxLength"
                    kind="number"
                  />
                </div>
              ) : null}
            </div>
          </details>
        ) : null
      )}
      <Field {...props} path={[...props.path, 'noticeHtml']} labelKey="v2.notice" kind="html" />
      <Field {...props} path={[...props.path, 'button']} labelKey="v2.button" />
    </StudioSection>
  );
};
