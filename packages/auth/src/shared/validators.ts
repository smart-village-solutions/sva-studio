import { z } from 'zod';

export const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidLikeString = (message: string) => z.string().regex(UUID_LIKE_PATTERN, message);
