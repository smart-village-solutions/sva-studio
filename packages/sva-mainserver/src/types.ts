// fallow-ignore-file code-duplication
export type SvaMainserverProviderKey = 'sva_mainserver';
export type SvaMainserverVerificationStatus = 'ok' | 'error' | 'disabled';

export type SvaMainserverErrorCode =
  | 'config_not_found'
  | 'integration_disabled'
  | 'invalid_config'
  | 'database_unavailable'
  | 'identity_provider_unavailable'
  | 'missing_credentials'
  | 'organization_mainserver_credentials_missing'
  | 'token_request_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'network_error'
  | 'graphql_error'
  | 'invalid_response'
  | 'not_found';

export type SvaMainserverInstanceConfig = {
  readonly instanceId: string;
  readonly providerKey: SvaMainserverProviderKey;
  readonly graphqlBaseUrl: string;
  readonly oauthTokenUrl: string;
  readonly enabled: boolean;
  readonly lastVerifiedAt?: string;
  readonly lastVerifiedStatus?: SvaMainserverVerificationStatus;
};

export type SvaMainserverConnectionStatus = {
  readonly status: 'connected' | 'error';
  readonly checkedAt: string;
  readonly config?: SvaMainserverInstanceConfig;
  readonly queryRootTypename?: string;
  readonly mutationRootTypename?: string;
  readonly errorCode?: SvaMainserverErrorCode;
  readonly errorMessage?: string;
};

export type SvaMainserverConnectionInput = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

export type SvaMainserverStaticContentInput = {
  readonly name: string;
  readonly content: string;
};

export type SvaMainserverListQuery = {
  readonly page: number;
  readonly pageSize: number;
};

export type SvaMainserverNewsListInput = SvaMainserverListQuery & {
  readonly includeInvisible?: boolean;
  readonly visibilityFilter?: 'all' | 'visible' | 'hidden';
  readonly editorialStatusFilter?: 'all' | 'draft' | 'scheduled' | 'published';
};

export type SvaMainserverListPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly total?: number;
};

export type SvaMainserverListResult<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: SvaMainserverListPagination;
  readonly credentialSource?: 'organization' | 'user';
};

export type SvaMainserverNewsPayload = {
  readonly teaser?: string;
  readonly body?: string;
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
};

export type SvaMainserverWebUrl = {
  readonly id?: string;
  readonly url: string;
  readonly description?: string;
};

export type SvaMainserverWebUrlInput = {
  readonly url: string;
  readonly description?: string;
};

export type SvaMainserverGeoLocation = {
  readonly latitude?: number;
  readonly longitude?: number;
};

export type SvaMainserverAddress = {
  readonly id?: string;
  readonly addition?: string;
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly kind?: string;
  readonly geoLocation?: SvaMainserverGeoLocation;
};

export type SvaMainserverAddressInput = Omit<SvaMainserverAddress, 'id'> & {
  readonly id?: number;
};

export type SvaMainserverCategoryInput = {
  readonly name: string;
  readonly payload?: unknown;
  readonly children?: readonly SvaMainserverCategoryInput[];
};

export type SvaMainserverCategory = {
  readonly id?: string;
  readonly name: string;
  readonly iconName?: string;
  readonly position?: number;
  readonly tagList?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly children: readonly SvaMainserverCategory[];
};

export type SvaMainserverCategoriesListItem = Omit<SvaMainserverCategory, 'id' | 'children'> & {
  readonly id: string;
  readonly parent?: {
    readonly name: string;
  };
};

export type SvaMainserverMediaContentInput = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly height?: number | string;
  readonly width?: number | string;
  readonly contentType?: string;
  readonly sourceUrl?: SvaMainserverWebUrlInput;
};

export type SvaMainserverMediaContent = Omit<SvaMainserverMediaContentInput, 'sourceUrl'> & {
  readonly id?: string;
  readonly height?: number;
  readonly width?: number;
  readonly sourceUrl?: SvaMainserverWebUrl;
};

export type SvaMainserverContentBlockInput = {
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents?: readonly SvaMainserverMediaContentInput[];
};

export type SvaMainserverContentBlock = {
  readonly id?: string;
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type SvaMainserverDataProvider = {
  readonly id?: string;
  readonly name?: string;
  readonly dataType?: string;
  readonly description?: string;
  readonly notice?: string;
  readonly logo?: SvaMainserverWebUrl;
  readonly address?: SvaMainserverAddress;
};

export type SvaMainserverSetting = {
  readonly alwaysRecreateOnImport?: string;
  readonly displayOnlySummary?: string;
  readonly onlySummaryLinkText?: string;
};

export type SvaMainserverAnnouncementSummary = {
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly likeCount: number;
  readonly likedByMe: boolean;
};

export type SvaMainserverNewsItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: 'news.article';
  readonly payload: SvaMainserverNewsPayload;
  readonly status: 'published';
  readonly author: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly fullVersion?: boolean;
  readonly charactersToBeShown?: number;
  readonly newsType?: string;
  readonly publicationDate?: string;
  readonly showPublishDate?: boolean;
  readonly categoryName?: string;
  readonly categories: readonly SvaMainserverCategory[];
  readonly sourceUrl?: SvaMainserverWebUrl;
  readonly address?: SvaMainserverAddress;
  readonly contentBlocks: readonly SvaMainserverContentBlock[];
  readonly dataProvider?: SvaMainserverDataProvider;
  readonly settings?: SvaMainserverSetting;
  readonly announcements: readonly SvaMainserverAnnouncementSummary[];
  readonly likeCount: number;
  readonly likedByMe: boolean;
  readonly pushNotificationsSentAt?: string;
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string;
};

export type SvaMainserverNewsInput = {
  readonly title: string;
  readonly author?: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly fullVersion?: boolean;
  readonly charactersToBeShown?: number;
  readonly newsType?: string;
  readonly publicationDate?: string;
  readonly publishedAt: string;
  readonly showPublishDate?: boolean;
  readonly categoryName?: string;
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly sourceUrl?: SvaMainserverWebUrlInput;
  readonly address?: SvaMainserverAddressInput;
  readonly contentBlocks?: readonly SvaMainserverContentBlockInput[];
  readonly pointOfInterestId?: string;
  readonly pushNotification?: boolean;
};

export type SvaMainserverDateInput = {
  readonly weekday?: string;
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly timeDescription?: string;
  readonly useOnlyTimeDescription?: boolean;
};

export type SvaMainserverDate = Omit<SvaMainserverDateInput, 'useOnlyTimeDescription'> & {
  readonly id?: string;
  readonly useOnlyTimeDescription?: string;
};

export type SvaMainserverContactInput = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly fax?: string;
  readonly email?: string;
  readonly webUrls?: readonly SvaMainserverWebUrlInput[];
};

export type SvaMainserverContact = Omit<SvaMainserverContactInput, 'webUrls'> & {
  readonly id?: string;
  readonly webUrls: readonly SvaMainserverWebUrl[];
};

export type SvaMainserverLocationInput = {
  readonly name?: string;
  readonly department?: string;
  readonly district?: string;
  readonly regionName?: string;
  readonly state?: string;
  readonly geoLocation?: SvaMainserverGeoLocation;
};

export type SvaMainserverLocation = SvaMainserverLocationInput & {
  readonly id?: string;
};

export type SvaMainserverOperatingCompanyInput = {
  readonly name?: string;
  readonly address?: SvaMainserverAddressInput;
  readonly contact?: SvaMainserverContactInput;
};

export type SvaMainserverOperatingCompany = {
  readonly id?: string;
  readonly name?: string;
  readonly address?: SvaMainserverAddress;
  readonly contact?: SvaMainserverContact;
};

export type SvaMainserverPriceInput = {
  readonly name?: string;
  readonly amount?: number;
  readonly groupPrice?: boolean;
  readonly ageFrom?: number;
  readonly ageTo?: number;
  readonly minAdultCount?: number;
  readonly maxAdultCount?: number;
  readonly minChildrenCount?: number;
  readonly maxChildrenCount?: number;
  readonly description?: string;
  readonly category?: string;
};

export type SvaMainserverPrice = SvaMainserverPriceInput & {
  readonly id?: string;
};

export type SvaMainserverAccessibilityInformationInput = {
  readonly description?: string;
  readonly types?: string;
  readonly urls?: readonly SvaMainserverWebUrlInput[];
};

export type SvaMainserverAccessibilityInformation = Omit<SvaMainserverAccessibilityInformationInput, 'urls'> & {
  readonly id?: string;
  readonly urls: readonly SvaMainserverWebUrl[];
};

export type SvaMainserverRepeatDurationInput = {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly everyYear?: boolean;
};

export type SvaMainserverRepeatDuration = SvaMainserverRepeatDurationInput & {
  readonly id?: string;
};

export type SvaMainserverOpeningHourInput = {
  readonly weekday?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly timeFrom?: string;
  readonly timeTo?: string;
  readonly sortNumber?: number;
  readonly open?: boolean;
  readonly useYear?: boolean;
  readonly description?: string;
};

export type SvaMainserverOpeningHour = SvaMainserverOpeningHourInput & {
  readonly id?: string;
};

export type SvaMainserverCertificateInput = {
  readonly name: string;
};

export type SvaMainserverCertificate = SvaMainserverCertificateInput & {
  readonly id?: string;
};

export type SvaMainserverEventInput = {
  readonly title: string;
  readonly description?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly parentId?: number;
  readonly dates?: readonly SvaMainserverDateInput[];
  readonly repeat?: boolean;
  readonly repeatDuration?: SvaMainserverRepeatDurationInput;
  readonly categoryName?: string;
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly addresses?: readonly SvaMainserverAddressInput[];
  readonly location?: SvaMainserverLocationInput;
  readonly contacts?: readonly SvaMainserverContactInput[];
  readonly urls?: readonly SvaMainserverWebUrlInput[];
  readonly mediaContents?: readonly SvaMainserverMediaContentInput[];
  readonly organizer?: SvaMainserverOperatingCompanyInput;
  readonly priceInformations?: readonly SvaMainserverPriceInput[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformationInput;
  readonly tags?: readonly string[];
  readonly recurring?: string;
  readonly recurringWeekdays?: readonly string[];
  readonly recurringType?: string;
  readonly recurringInterval?: string;
  readonly pointOfInterestId?: string;
  readonly pushNotification?: boolean;
};

export type SvaMainserverEventItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: 'events.event-record';
  readonly status: 'published';
  readonly description?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly parentId?: number;
  readonly dates: readonly SvaMainserverDate[];
  readonly listDate?: string;
  readonly sortDate?: string;
  readonly repeat?: boolean;
  readonly repeatDuration?: SvaMainserverRepeatDuration;
  readonly recurring?: boolean;
  readonly recurringType?: number;
  readonly recurringInterval?: number;
  readonly recurringWeekdays: readonly number[];
  readonly categoryName?: string;
  readonly categories: readonly SvaMainserverCategory[];
  readonly addresses: readonly SvaMainserverAddress[];
  readonly location?: SvaMainserverLocation;
  readonly contacts: readonly SvaMainserverContact[];
  readonly urls: readonly SvaMainserverWebUrl[];
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly organizer?: SvaMainserverOperatingCompany;
  readonly priceInformations: readonly SvaMainserverPrice[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformation;
  readonly tags: readonly string[];
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SvaMainserverPoiInput = {
  readonly name: string;
  readonly description?: string;
  readonly mobileDescription?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly active?: boolean;
  readonly categoryName?: string;
  readonly payload?: unknown;
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly addresses?: readonly SvaMainserverAddressInput[];
  readonly contact?: SvaMainserverContactInput;
  readonly priceInformations?: readonly SvaMainserverPriceInput[];
  readonly openingHours?: readonly SvaMainserverOpeningHourInput[];
  readonly operatingCompany?: SvaMainserverOperatingCompanyInput;
  readonly webUrls?: readonly SvaMainserverWebUrlInput[];
  readonly mediaContents?: readonly SvaMainserverMediaContentInput[];
  readonly location?: SvaMainserverLocationInput;
  readonly certificates?: readonly SvaMainserverCertificateInput[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformationInput;
  readonly tags?: readonly string[];
};

export type SvaMainserverPoiItem = {
  readonly id: string;
  readonly name: string;
  readonly contentType: 'poi.point-of-interest';
  readonly status: 'published';
  readonly description?: string;
  readonly mobileDescription?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly active: boolean;
  readonly categoryName?: string;
  readonly payload?: unknown;
  readonly categories: readonly SvaMainserverCategory[];
  readonly addresses: readonly SvaMainserverAddress[];
  readonly contact?: SvaMainserverContact;
  readonly priceInformations: readonly SvaMainserverPrice[];
  readonly openingHours: readonly SvaMainserverOpeningHour[];
  readonly operatingCompany?: SvaMainserverOperatingCompany;
  readonly webUrls: readonly SvaMainserverWebUrl[];
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly location?: SvaMainserverLocation;
  readonly certificates: readonly SvaMainserverCertificate[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformation;
  readonly tags: readonly string[];
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SvaMainserverLocalizedText = Readonly<Record<string, string>>;

export type SvaMainserverSurveyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SvaMainserverSurveyQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FREE_TEXT'
  | 'SINGLE_CHOICE_WITH_TEXT'
  | 'MULTIPLE_CHOICE_WITH_TEXT';

export type SvaMainserverSurveyFreeTextStatus = 'INTERNAL' | 'PUBLIC';

export type SvaMainserverSurveyResultVisibility = 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';

export type SvaMainserverSurveyMutationAction = 'CREATED' | 'UPDATED' | 'DELETED';

export type SvaMainserverSurveyMutationErrorCode =
  | 'VALIDATION_ERROR'
  | 'SURVEY_NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'DELETE_REQUIRES_ID'
  | 'CONFLICTING_INPUT'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';

export type SvaMainserverSurveySubmissionErrorCode =
  | 'VALIDATION_ERROR'
  | 'SURVEY_NOT_FOUND'
  | 'SURVEY_NOT_ACTIVE'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';

export type SvaMainserverSurveyFilterInput = {
  readonly ids?: readonly string[];
  readonly statuses?: readonly SvaMainserverSurveyStatus[];
  readonly targetAreaIds?: readonly string[];
  readonly includeArchived?: boolean;
  readonly ongoingOnly?: boolean;
};

export type SvaMainserverSurveyListInput = SvaMainserverListQuery & SvaMainserverSurveyFilterInput;

export type SvaMainserverSurveyQuestionOptionInput = {
  readonly id?: string;
  readonly delete?: boolean;
  readonly title?: SvaMainserverLocalizedText;
  readonly position?: number;
  readonly enablesFreeText?: boolean;
};

export type SvaMainserverSurveyQuestionInput = {
  readonly id?: string;
  readonly delete?: boolean;
  readonly title?: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly type?: SvaMainserverSurveyQuestionType;
  readonly required?: boolean;
  readonly position?: number;
  readonly options?: readonly SvaMainserverSurveyQuestionOptionInput[];
};

export type SvaMainserverSurveyFreeTextInput = {
  readonly id: string;
  readonly status?: SvaMainserverSurveyFreeTextStatus;
  readonly delete?: boolean;
};

export type SvaMainserverSurveyInput = {
  readonly title?: SvaMainserverLocalizedText;
  readonly shortDescription?: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly status?: SvaMainserverSurveyStatus;
  readonly startAt?: string;
  readonly endAt?: string;
  readonly resultVisibility?: SvaMainserverSurveyResultVisibility;
  readonly targetAreaIds?: readonly string[];
  readonly showResultsInApp?: boolean;
  readonly isAnonymous?: boolean;
  readonly privacyNotice?: SvaMainserverLocalizedText;
  readonly transparencyNotice?: SvaMainserverLocalizedText;
  readonly questions?: readonly SvaMainserverSurveyQuestionInput[];
  readonly freeTextResponses?: readonly SvaMainserverSurveyFreeTextInput[];
};

export type SvaMainserverSurveyQuestionOption = {
  readonly id: string;
  readonly questionId: string;
  readonly title: SvaMainserverLocalizedText;
  readonly position: number;
  readonly enablesFreeText: boolean;
};

export type SvaMainserverSurveyQuestion = {
  readonly id: string;
  readonly surveyId: string;
  readonly title: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly type: SvaMainserverSurveyQuestionType;
  readonly required: boolean;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly options: readonly SvaMainserverSurveyQuestionOption[];
};

export type SvaMainserverSurveyFreeTextResult = {
  readonly id: string;
  readonly text: string;
  readonly status: SvaMainserverSurveyFreeTextStatus;
  readonly createdAt: string;
};

export type SvaMainserverSurveyOptionResult = {
  readonly optionId: string;
  readonly title: SvaMainserverLocalizedText;
  readonly votes: number;
  readonly percentage?: number;
  readonly freeTextResponses: readonly SvaMainserverSurveyFreeTextResult[];
};

export type SvaMainserverSurveyQuestionResults = {
  readonly questionId: string;
  readonly type: SvaMainserverSurveyQuestionType;
  readonly totalResponses: number;
  readonly optionResults: readonly SvaMainserverSurveyOptionResult[];
  readonly freeTextResponses: readonly SvaMainserverSurveyFreeTextResult[];
};

export type SvaMainserverSurveyResults = {
  readonly surveyId: string;
  readonly participationCount: number;
  readonly submissionCount: number;
  readonly questions: readonly SvaMainserverSurveyQuestionResults[];
};

export type SvaMainserverSurveyItem = {
  readonly id: string;
  readonly title: SvaMainserverLocalizedText;
  readonly shortDescription?: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly status: SvaMainserverSurveyStatus;
  readonly startAt?: string;
  readonly endAt?: string;
  readonly resultVisibility: SvaMainserverSurveyResultVisibility;
  readonly targetAreaIds: readonly string[];
  readonly showResultsInApp: boolean;
  readonly isAnonymous: boolean;
  readonly privacyNotice?: SvaMainserverLocalizedText;
  readonly transparencyNotice?: SvaMainserverLocalizedText;
  readonly questions: readonly SvaMainserverSurveyQuestion[];
  readonly questionCount: number;
  readonly participationCount: number;
  readonly submissionCount: number;
  readonly results?: SvaMainserverSurveyResults;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
  readonly archivedAt?: string;
};

export type SvaMainserverSurveyMutationError = {
  readonly code: SvaMainserverSurveyMutationErrorCode;
  readonly message: string;
  readonly field?: string;
};

export type SvaMainserverSurveyMutationPayload = {
  readonly success: boolean;
  readonly action?: SvaMainserverSurveyMutationAction;
  readonly survey?: SvaMainserverSurveyItem;
  readonly deletedSurveyId?: string;
  readonly errors: readonly SvaMainserverSurveyMutationError[];
};

export type SvaMainserverSurveySubmissionError = {
  readonly code: SvaMainserverSurveySubmissionErrorCode;
  readonly message: string;
  readonly field?: string;
};
