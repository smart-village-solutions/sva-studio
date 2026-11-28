export const ssfInterfaceResources = {
  saveFirst: 'Save the configuration before checking the connection.',
  origin: 'SSF server HTTPS address',
  checking: 'Checking Smart Speech Flow …',
  errors: {
    ssf_translation_disable_before_cutover:
      'Disable the SSF interface during the pilot transition.',
    ssf_translation_origin_key_required:
      'Enter the API key for the new SSF server when changing its address.',
    ssf_translation_invalid_config:
      'Check the HTTPS server address, API key and selected languages.',
    ssf_translation_rejected:
      'Smart Speech Flow could not be verified. Check the address and API key.',
    ssf_translation_invalid_response: 'Smart Speech Flow returned an invalid response.',
    ssf_translation_languages_unavailable:
      'Smart Speech Flow did not report supported target languages.',
    ssf_translation_unavailable: 'Smart Speech Flow is currently unavailable.',
  },
};

export const ssfInterfaceTypeResources = {
  label: 'Smart Speech Flow',
  description: 'Translate app content with your own Smart Speech Flow server.',
};
