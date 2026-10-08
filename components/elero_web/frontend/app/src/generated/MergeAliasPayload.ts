
/**
 * Explicit saved-cover merge. Canonical settings survive; duplicate is deleted after saving the alias. Rejections emit error; success emits device_upserted and device_removed.
 */
interface MergeAliasPayload {
  'type': 'merge_alias';
  'canonical': string;
  'duplicate': string;
  'additionalProperties'?: Map<string, any>;
}
export { MergeAliasPayload };