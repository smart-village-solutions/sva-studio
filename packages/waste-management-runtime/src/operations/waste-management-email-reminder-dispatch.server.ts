import { type MailDispatchPayload, type MailTransportConfig } from '@sva/core';
import {
  type WasteManagementEmailReminderConfig,
} from '@sva/waste-management-contracts';
import type { MailDispatchMessage, MailDispatchMessageAddress } from '@sva/mail-runtime';
import { createWasteManagementUnsubscribeToken } from '@sva/waste-management-contracts/unsubscribe-token';

import {
  buildGroupReminderContent,
  parseIsoDateUtc,
  reminderAppointmentsSchema,
  reminderMemberDedupeKey,
  type ReminderMember,
} from './waste-management-email-reminder-planning.js';

const templatePlaceholderPattern = /\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g;

const formatPickupDateLabel = (pickupDate: string): string =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parseIsoDateUtc(pickupDate));

const renderTemplate = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(templatePlaceholderPattern, (_match, rawKey: string) => values[rawKey] ?? '');

const formatEmailLocationLabel = (value: string): string => {
  if (!value.trim()) {
    return value;
  }
  const [city, ...addressParts] = value.split(',').map((part) => part.trim());
  const streetsAndHouseNumbers = /^alle\s+straßen(?:\s+(?:(?:alle|und)\s+)?hausnummern)?$/iu;
  const houseNumbers = /(?:^|\s+)alle\s+hausnummern$/iu;
  return [
    city,
    ...addressParts
      .filter((part) => !streetsAndHouseNumbers.test(part))
      .map((part) => part.replace(houseNumbers, '')),
  ]
    .filter(Boolean)
    .join(', ');
};

const buildUnsubscribeUrl = (
  config: WasteManagementEmailReminderConfig,
  input: {
    readonly subscriptionId: string;
    readonly unsubscribeTokenHash: string;
    readonly secret: string;
  }
): string => {
  const url = new URL(config.unsubscribePath, config.publicBaseUrl);
  url.searchParams.set(
    'token',
    createWasteManagementUnsubscribeToken({
      subscriptionId: input.subscriptionId,
      unsubscribeTokenHash: input.unsubscribeTokenHash,
      secret: input.secret,
    })
  );
  return url.toString();
};

type ReminderDispatchInput = Readonly<{
  config: WasteManagementEmailReminderConfig;
  subscriptionId: string;
  email: string;
  locationLabel: string;
  pickupDate: string;
  originalSendAt: string;
  members: readonly ReminderMember[];
  unsubscribeTokenHash: string;
  unsubscribeTokenSecret: string;
}>;

export const buildReminderDispatchPayload = (input: ReminderDispatchInput): MailDispatchPayload => {
  const unsubscribeUrl = buildUnsubscribeUrl(input.config, {
    subscriptionId: input.subscriptionId,
    unsubscribeTokenHash: input.unsubscribeTokenHash,
    secret: input.unsubscribeTokenSecret,
  });
  const pickupDateLabel = formatPickupDateLabel(input.pickupDate);
  const content = buildGroupReminderContent(input.members);
  const values = {
    fractionName: content.fractionName,
    locationLabel: formatEmailLocationLabel(input.locationLabel),
    pickupDate: pickupDateLabel,
    unsubscribeUrl,
  } as const;

  return {
    orderId: input.subscriptionId,
    transportId: input.config.transportId,
    messageKind: 'transactional',
    templateKey: 'waste.email-reminder.reminder',
    locale: 'de-DE',
    addresses: [
      { kind: 'to', email: input.email },
      ...(input.config.replyToEmail
        ? [{ kind: 'reply_to' as const, email: input.config.replyToEmail }]
        : []),
    ],
    templatePayload: {
      subject: renderTemplate(input.config.reminderSubjectTemplate, values),
      introText: renderTemplate(input.config.reminderIntroTemplate, values),
      listIntroText: renderTemplate(input.config.reminderListIntroTemplate ?? '', values),
      outroText: input.config.reminderOutroText ?? '',
      reasonText: renderTemplate(input.config.reminderReasonText ?? '', values),
      unsubscribeLabel: input.config.unsubscribeLinkLabel,
      unsubscribeUrl,
      locationLabel: values.locationLabel,
      pickupDate: pickupDateLabel,
      ...content,
      privacyPolicyUrl: input.config.privacyPolicyUrl,
      imprintUrl: input.config.imprintUrl,
      ...(input.config.serviceLabel ? { serviceLabel: input.config.serviceLabel } : {}),
    },
    tags: ['waste-management', 'email-reminder', 'reminder'],
    metadata: {
      module: 'waste-management',
      flow: 'public-email-reminder-delivery',
      subscriptionId: input.subscriptionId,
      originalSendAt: input.originalSendAt,
      reminderMemberKeys: JSON.stringify(
        [...new Set(input.members.map((member) =>
          reminderMemberDedupeKey(input.subscriptionId, input.pickupDate, member)
        ))].sort()
      ),
      pickupDate: input.pickupDate,
    },
  };
};

const normalizeMailTextLine = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const joinMailTextSections = (sections: readonly (string | undefined)[]): string =>
  sections
    .filter((section): section is string => Boolean(normalizeMailTextLine(section)))
    .map((section) => section.trim())
    .join('\n\n');

const mapPayloadAddresses = (
  payload: MailDispatchPayload
): Readonly<Record<'to' | 'cc' | 'bcc' | 'replyTo', readonly MailDispatchMessageAddress[]>> => {
  const to: MailDispatchMessageAddress[] = [];
  const cc: MailDispatchMessageAddress[] = [];
  const bcc: MailDispatchMessageAddress[] = [];
  const replyTo: MailDispatchMessageAddress[] = [];

  for (const address of payload.addresses) {
    const nextAddress = {
      email: address.email,
      ...(address.displayName ? { displayName: address.displayName } : {}),
    } as const;
    if (address.kind === 'to') {
      to.push(nextAddress);
      continue;
    }
    if (address.kind === 'cc') {
      cc.push(nextAddress);
      continue;
    }
    if (address.kind === 'bcc') {
      bcc.push(nextAddress);
      continue;
    }
    if (address.kind === 'reply_to') {
      replyTo.push(nextAddress);
    }
  }

  return { to, cc, bcc, replyTo };
};

const resolveReminderFromAddress = (
  config: WasteManagementEmailReminderConfig,
  transport: MailTransportConfig
): MailDispatchMessageAddress => ({
  email: config.fromEmail || transport.defaultFromEmail || '',
  displayName: config.fromName || transport.defaultFromName || undefined,
});

const resolveReminderReplyToAddresses = (
  config: WasteManagementEmailReminderConfig,
  transport: MailTransportConfig,
  payload: MailDispatchPayload
): readonly MailDispatchMessageAddress[] | undefined => {
  const payloadAddresses = mapPayloadAddresses(payload).replyTo;
  if (payloadAddresses.length > 0) {
    return payloadAddresses;
  }
  const fallbackEmail = config.replyToEmail || transport.defaultReplyToEmail;
  if (!fallbackEmail) {
    return undefined;
  }
  return [{ email: fallbackEmail }];
};

type DoiTemplateContext = Readonly<{
  serviceLabel: string | undefined;
  dataControllerLabel: string | undefined;
  values: Readonly<{
    confirmUrl: string;
    locationLabel: string;
    privacyPolicyUrl: string;
    imprintUrl: string;
    serviceLabel: string;
    dataControllerLabel: string;
    expiryHours: string;
  }>;
}>;

const resolveDoiTemplateContext = (
  config: WasteManagementEmailReminderConfig,
  templatePayload: MailDispatchPayload['templatePayload']
): DoiTemplateContext => {
  const serviceLabel = normalizeMailTextLine(templatePayload.serviceLabel ?? config.serviceLabel);
  const dataControllerLabel = normalizeMailTextLine(
    templatePayload.dataControllerLabel ?? config.dataControllerLabel
  );

  return {
    serviceLabel,
    dataControllerLabel,
    values: {
      confirmUrl: templatePayload.confirmUrl ?? '',
      locationLabel: formatEmailLocationLabel(templatePayload.locationLabel ?? ''),
      privacyPolicyUrl: templatePayload.privacyPolicyUrl ?? '',
      imprintUrl: templatePayload.imprintUrl ?? '',
      serviceLabel: serviceLabel ?? '',
      dataControllerLabel: dataControllerLabel ?? '',
      expiryHours: String(config.doiTokenTtlHours),
    },
  };
};

const renderOptionalDoiTemplate = (
  template: string | undefined,
  values: DoiTemplateContext['values']
): string | undefined =>
  normalizeMailTextLine(template) ? renderTemplate(template!, values) : undefined;

const buildDoiText = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly templatePayload: MailDispatchPayload['templatePayload'];
  readonly templateContext: DoiTemplateContext;
}): string =>
  joinMailTextSections([
    renderOptionalDoiTemplate(input.config.doiPreheader, input.templateContext.values),
    renderTemplate(input.config.doiIntroText, input.templateContext.values),
    normalizeMailTextLine(input.templateContext.values.locationLabel)
      ? `Ort: ${input.templateContext.values.locationLabel}`
      : undefined,
    input.config.doiButtonLabel
      ? `${input.config.doiButtonLabel}: ${input.templatePayload.confirmUrl}`
      : input.templatePayload.confirmUrl,
    renderOptionalDoiTemplate(input.config.doiFallbackText, input.templateContext.values),
    renderOptionalDoiTemplate(input.config.doiExpiryNoticeText, input.templateContext.values),
    input.templateContext.serviceLabel
      ? `Service: ${input.templateContext.serviceLabel}`
      : undefined,
    input.templateContext.dataControllerLabel
      ? `Verantwortlich: ${input.templateContext.dataControllerLabel}`
      : undefined,
    `Datenschutz: ${input.templatePayload.privacyPolicyUrl}`,
    `Impressum: ${input.templatePayload.imprintUrl}`,
  ]);

const buildDoiEnvelope = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
  readonly subject: string;
  readonly text: string;
}): MailDispatchMessage => {
  const { config, transport, payload, subject, text } = input;
  const { to, cc, bcc } = mapPayloadAddresses(payload);
  const replyTo = resolveReminderReplyToAddresses(config, transport, payload);

  return {
    from: resolveReminderFromAddress(config, transport),
    to,
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
  };
};

const buildDoiDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage => {
  const { templatePayload } = input.payload;
  const templateContext = resolveDoiTemplateContext(input.config, templatePayload);
  const text = buildDoiText({ config: input.config, templatePayload, templateContext });
  return buildDoiEnvelope({
    ...input,
    subject: renderTemplate(input.config.doiSubjectTemplate, templateContext.values),
    text,
  });
};

const readReminderAppointments = (payload: MailDispatchPayload['templatePayload']) => {
  if (payload.reminderAppointments === undefined) {
    return [{ fractionName: payload.fractionName, hintText: payload.hintText }];
  }
  try {
    return reminderAppointmentsSchema.parse(JSON.parse(payload.reminderAppointments));
  } catch {
    throw new Error('invalid_reminder_appointments');
  }
};

const renderReminderAppointments = (payload: MailDispatchPayload['templatePayload']): string => {
  const pickupDate = normalizeMailTextLine(payload.pickupDate);
  return readReminderAppointments(payload)
    .map((appointment) => {
      const bulletLine = normalizeMailTextLine(appointment.fractionName)
        ? `- ${appointment.fractionName}${pickupDate ? ` (${pickupDate})` : ''}`
        : undefined;
      const hintText = normalizeMailTextLine(appointment.hintText);
      const hintLines = hintText
        ?.split('\n')
        .map((line) => (line ? `  ${line}` : ''))
        .join('\n');
      return [bulletLine, hintLines].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n');
};

const buildReminderDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage => {
  const { templatePayload } = input.payload;
  const storedLocationLabel = templatePayload.locationLabel ?? '';
  const locationLabel = formatEmailLocationLabel(storedLocationLabel);
  // Reminder text is rendered when queued, so update the stored label without rendering the templates again.
  const formatQueuedText = (text?: string): string | undefined =>
    storedLocationLabel && locationLabel && storedLocationLabel !== locationLabel
      ? text?.split(storedLocationLabel).join(locationLabel)
      : text;
  const serviceLabel = normalizeMailTextLine(
    templatePayload.serviceLabel ?? input.config.serviceLabel
  );
  const text = joinMailTextSections([
    formatQueuedText(templatePayload.introText),
    formatQueuedText(templatePayload.listIntroText),
    renderReminderAppointments(templatePayload),
    templatePayload.outroText,
    formatQueuedText(templatePayload.reasonText),
    `${templatePayload.unsubscribeLabel}: ${templatePayload.unsubscribeUrl}`,
    `Datenschutz: ${templatePayload.privacyPolicyUrl}`,
    `Impressum: ${templatePayload.imprintUrl}`,
    serviceLabel ? `Service: ${serviceLabel}` : undefined,
  ]);
  const addresses = mapPayloadAddresses(input.payload);
  const replyTo = resolveReminderReplyToAddresses(input.config, input.transport, input.payload);

  return {
    from: resolveReminderFromAddress(input.config, input.transport),
    to: addresses.to,
    ...(addresses.cc.length > 0 ? { cc: addresses.cc } : {}),
    ...(addresses.bcc.length > 0 ? { bcc: addresses.bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject: formatQueuedText(templatePayload.subject) ?? templatePayload.subject,
    text,
  };
};

export const buildDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage =>
  input.payload.templateKey === 'waste.email-reminder.doi'
    ? buildDoiDispatchMessage(input)
    : buildReminderDispatchMessage(input);
