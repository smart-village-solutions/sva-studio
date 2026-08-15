import type {
  MailDispatchPayload,
  MailTransportConfig,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteManagementEmailReminderConfig,
} from '@sva/core';
import type { MailDispatchMessage, MailDispatchMessageAddress } from '@sva/mail-runtime';
import { createWasteManagementUnsubscribeToken } from '@sva/waste-management-contracts/unsubscribe-token';

const templatePlaceholderPattern = /\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g;

export const createUtcIsoAtHour = (date: Date, hourUtc: number): string =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hourUtc, 0, 0, 0)
  ).toISOString();

export const parseIsoDateUtc = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid_iso_date:${value}`);
  }
  return parsed;
};

export const addDaysUtc = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const formatPickupDateLabel = (pickupDate: string): string =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parseIsoDateUtc(pickupDate));

const renderTemplate = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(templatePlaceholderPattern, (_match, rawKey: string) => values[rawKey] ?? '');

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

export const matchSelectionLocations = (
  locations: readonly WasteCollectionLocationRecord[],
  subscription: {
    readonly regionId?: string;
    readonly cityId: string;
    readonly streetId: string;
    readonly houseNumberId?: string;
  }
): readonly WasteCollectionLocationRecord[] =>
  locations.filter((location) => {
    if (!location.active || location.cityId !== subscription.cityId) {
      return false;
    }
    if (subscription.regionId) {
      if (location.regionId !== undefined && location.regionId !== subscription.regionId) {
        return false;
      }
    } else if (location.regionId !== undefined) {
      return false;
    }
    if (subscription.streetId === 'all') {
      return location.streetId === undefined;
    }
    if (location.streetId !== undefined && location.streetId !== subscription.streetId) {
      return false;
    }
    if (
      subscription.houseNumberId &&
      location.houseNumberId !== undefined &&
      location.houseNumberId !== subscription.houseNumberId
    ) {
      return false;
    }
    if (!subscription.houseNumberId && location.houseNumberId !== undefined) {
      return false;
    }
    return true;
  });

export const buildReminderDispatchPayload = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly subscriptionId: string;
  readonly email: string;
  readonly locationLabel: string;
  readonly fraction: WasteFractionRecord;
  readonly pickupDate: string;
  readonly unsubscribeTokenHash: string;
  readonly unsubscribeTokenSecret: string;
}): MailDispatchPayload => {
  const unsubscribeUrl = buildUnsubscribeUrl(input.config, {
    subscriptionId: input.subscriptionId,
    unsubscribeTokenHash: input.unsubscribeTokenHash,
    secret: input.unsubscribeTokenSecret,
  });
  const pickupDateLabel = formatPickupDateLabel(input.pickupDate);
  const values = {
    fractionName: input.fraction.name,
    locationLabel: input.locationLabel,
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
      locationLabel: input.locationLabel,
      pickupDate: pickupDateLabel,
      fractionName: input.fraction.name,
      privacyPolicyUrl: input.config.privacyPolicyUrl,
      imprintUrl: input.config.imprintUrl,
      ...(input.config.serviceLabel ? { serviceLabel: input.config.serviceLabel } : {}),
    },
    tags: ['waste-management', 'email-reminder', 'reminder'],
    metadata: {
      module: 'waste-management',
      flow: 'public-email-reminder-delivery',
      subscriptionId: input.subscriptionId,
      fractionId: input.fraction.id,
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
  values: Readonly<
    Record<
      | 'confirmUrl'
      | 'locationLabel'
      | 'privacyPolicyUrl'
      | 'imprintUrl'
      | 'serviceLabel'
      | 'dataControllerLabel',
      string
    >
  >;
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
      locationLabel: templatePayload.locationLabel ?? '',
      privacyPolicyUrl: templatePayload.privacyPolicyUrl ?? '',
      imprintUrl: templatePayload.imprintUrl ?? '',
      serviceLabel: serviceLabel ?? '',
      dataControllerLabel: dataControllerLabel ?? '',
    },
  };
};

const renderOptionalDoiTemplate = (
  template: string | undefined,
  values: DoiTemplateContext['values']
): string | undefined =>
  normalizeMailTextLine(template) ? renderTemplate(template!, values) : undefined;

const buildDoiLocationSection = (locationLabel: string | undefined): string | undefined =>
  normalizeMailTextLine(locationLabel) ? `Ort: ${locationLabel}` : undefined;
const buildDoiConfirmationSection = (
  buttonLabel: string,
  confirmUrl: string | undefined
): string | undefined => (buttonLabel ? `${buttonLabel}: ${confirmUrl}` : confirmUrl);
const buildOptionalDoiLabelSection = (
  label: 'Service' | 'Verantwortlich',
  value: string | undefined
): string | undefined => (value ? `${label}: ${value}` : undefined);

const buildDoiText = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly templatePayload: MailDispatchPayload['templatePayload'];
  readonly templateContext: DoiTemplateContext;
}): string =>
  joinMailTextSections([
    renderOptionalDoiTemplate(input.config.doiPreheader, input.templateContext.values),
    renderTemplate(input.config.doiIntroText, input.templateContext.values),
    buildDoiLocationSection(input.templatePayload.locationLabel),
    buildDoiConfirmationSection(input.config.doiButtonLabel, input.templatePayload.confirmUrl),
    renderOptionalDoiTemplate(input.config.doiFallbackText, input.templateContext.values),
    renderOptionalDoiTemplate(input.config.doiExpiryNoticeText, input.templateContext.values),
    buildOptionalDoiLabelSection('Service', input.templateContext.serviceLabel),
    buildOptionalDoiLabelSection('Verantwortlich', input.templateContext.dataControllerLabel),
    `Datenschutz: ${input.templatePayload.privacyPolicyUrl}`,
    `Impressum: ${input.templatePayload.imprintUrl}`,
  ]);

const resolveOptionalDoiEnvelopeAddresses = (
  addresses: ReturnType<typeof mapPayloadAddresses>,
  replyTo: readonly MailDispatchMessageAddress[] | undefined
): Readonly<Pick<MailDispatchMessage, 'cc' | 'bcc' | 'replyTo'>> => ({
  ...(addresses.cc.length > 0 ? { cc: addresses.cc } : {}),
  ...(addresses.bcc.length > 0 ? { bcc: addresses.bcc } : {}),
  ...(replyTo ? { replyTo } : {}),
});
const resolveDoiEnvelopeAddresses = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): Readonly<Pick<MailDispatchMessage, 'from' | 'to' | 'cc' | 'bcc' | 'replyTo'>> => {
  const addresses = mapPayloadAddresses(input.payload);
  const replyTo = resolveReminderReplyToAddresses(input.config, input.transport, input.payload);

  return {
    from: resolveReminderFromAddress(input.config, input.transport),
    to: addresses.to,
    ...resolveOptionalDoiEnvelopeAddresses(addresses, replyTo),
  };
};
const buildDoiEnvelope = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
  readonly subject: string;
  readonly text: string;
}): MailDispatchMessage => ({
  ...resolveDoiEnvelopeAddresses(input),
  subject: input.subject,
  text: input.text,
});

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

const buildReminderDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage => {
  const { templatePayload } = input.payload;
  const bulletLine = normalizeMailTextLine(templatePayload.fractionName)
    ? `- ${templatePayload.fractionName}${normalizeMailTextLine(templatePayload.pickupDate) ? ` (${templatePayload.pickupDate})` : ''}`
    : undefined;
  const serviceLabel = normalizeMailTextLine(
    templatePayload.serviceLabel ?? input.config.serviceLabel
  );
  const text = joinMailTextSections([
    templatePayload.introText,
    templatePayload.listIntroText,
    bulletLine,
    templatePayload.outroText,
    templatePayload.reasonText,
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
    subject: templatePayload.subject,
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
