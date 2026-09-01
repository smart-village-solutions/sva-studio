import * as React from 'react';

import type { ContentMediaUsageBlockLabels } from './content-media-usage-block.js';
import {
  inspectManualContentMediaUrl,
  isPersistableManualContentMediaUrl,
  probeContentMediaImageUrl,
} from './content-media-url.js';
import type { ContentMediaUsagePatch } from './content-media-usage.js';
import { Input } from './input.js';
import { StudioField } from './studio-primitives.js';

type UrlFeedback = 'checking' | 'upgraded' | 'http' | 'https-unavailable' | 'invalid' | null;

type ContentMediaUrlFieldProps = Readonly<{
  usageId: string;
  value: string;
  externalError?: string;
  labels: ContentMediaUsageBlockLabels;
  onUpdate: (patch: ContentMediaUsagePatch) => void;
}>;

const joinIds = (...ids: readonly (string | undefined)[]) =>
  ids.filter(Boolean).join(' ') || undefined;

const useContentMediaUrlField = ({ onUpdate }: ContentMediaUrlFieldProps) => {
  const [feedback, setFeedback] = React.useState<UrlFeedback>(null);
  const validationSequence = React.useRef(0);

  const onChange = (nextValue: string) => {
    validationSequence.current += 1;
    setFeedback(null);
    onUpdate({ persistentUrl: nextValue });
  };
  const onBlur = async (nextValue: string) => {
    const sequence = validationSequence.current + 1;
    validationSequence.current = sequence;
    const inspection = inspectManualContentMediaUrl(nextValue);
    if (inspection.kind === 'empty' || inspection.kind === 'https') {
      if (inspection.value !== nextValue) onUpdate({ persistentUrl: inspection.value });
      setFeedback(null);
      return;
    }
    if (inspection.kind === 'invalid') {
      if (inspection.value !== nextValue) onUpdate({ persistentUrl: inspection.value });
      setFeedback('invalid');
      return;
    }

    if (inspection.value !== nextValue) onUpdate({ persistentUrl: inspection.value });
    setFeedback('checking');
    const supportsHttps = await probeContentMediaImageUrl(inspection.httpsCandidate);
    if (validationSequence.current !== sequence) return;
    if (supportsHttps) {
      onUpdate({ persistentUrl: inspection.httpsCandidate });
      setFeedback('upgraded');
      return;
    }
    setFeedback(inspection.httpFallback ? 'http' : 'https-unavailable');
  };

  return { feedback, onBlur, onChange } as const;
};

const resolveUrlPresentation = (
  value: string,
  feedback: UrlFeedback,
  externalError: string | undefined,
  labels: ContentMediaUsageBlockLabels
) => {
  const inspection = inspectManualContentMediaUrl(value);
  const isPersistable = isPersistableManualContentMediaUrl(value.trim());
  const localError =
    feedback === 'https-unavailable'
      ? labels.urlFeedback.httpsUnavailable
      : feedback === 'invalid'
        ? labels.urlFeedback.invalid
        : undefined;
  const error = localError ?? (isPersistable ? undefined : externalError);
  const showsHttpWarning =
    feedback === 'http' ||
    (feedback === null && inspection.kind === 'upgrade' && inspection.httpFallback);
  const status =
    feedback === 'upgraded'
      ? labels.urlFeedback.upgradedToHttps
      : showsHttpWarning
        ? labels.urlFeedback.insecureHttp
        : undefined;
  return { error, showsHttpWarning, status } as const;
};

export const ContentMediaUrlField = (props: ContentMediaUrlFieldProps) => {
  const { feedback, onBlur, onChange } = useContentMediaUrlField(props);
  const fieldId = `content-media-${props.usageId}-url`;
  const feedbackId = `${fieldId}-feedback`;
  const { error, showsHttpWarning, status } = resolveUrlPresentation(
    props.value,
    feedback,
    props.externalError,
    props.labels
  );

  return (
    <StudioField id={fieldId} label={props.labels.fields.url} error={error}>
      <Input
        id={fieldId}
        type="url"
        aria-busy={feedback === 'checking' || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={joinIds(
          error ? `${fieldId}-error` : undefined,
          status ? feedbackId : undefined
        )}
        value={props.value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={(event) => void onBlur(event.currentTarget.value)}
      />
      {status ? (
        <p
          id={feedbackId}
          role="status"
          className={
            showsHttpWarning
              ? 'text-xs text-amber-700 dark:text-amber-300'
              : 'text-xs text-muted-foreground'
          }
        >
          {status}
        </p>
      ) : null}
    </StudioField>
  );
};
