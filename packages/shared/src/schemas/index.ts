export {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
} from './auth.schemas.js';
export {
  contentTypeSchema,
  searchQuerySchema,
  discoverQuerySchema,
  type SearchQuery,
  type DiscoverQuery,
} from './content.schemas.js';
export {
  updatePreferencesSchema,
  debridKeySchema,
  type UpdatePreferencesInput,
  type DebridKeyInput,
} from './user.schemas.js';
