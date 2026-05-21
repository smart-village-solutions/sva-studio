import {
  IAM_DELETED_CONTENT_AUTHOR_TOKEN,
  IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN,
} from '@sva/core';

import { t } from '../i18n';

export const formatContentAuthor = (author: string) => {
  switch (author) {
    case IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN:
      return t('content.meta.authorPseudonymized');
    case IAM_DELETED_CONTENT_AUTHOR_TOKEN:
      return t('content.meta.authorDeleted');
    default:
      return author;
  }
};
