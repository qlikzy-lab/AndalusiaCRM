import type { Lead } from './types';

/**
 * CRM integration placeholder.
 *
 * This is called once per lead after the user confirms on the review screen.
 * `lead` contains every field from the Lead interface (lib/types.ts):
 *   - id                    UUID of the saved lead
 *   - phoneNumber           phone as displayed (or null)
 *   - displayName           WhatsApp display name (or null)
 *   - childName             child's name if mentioned (or null)
 *   - childAge              age / grade if mentioned (or null)
 *   - notes                 AI-generated English summary of the conversation
 *   - status                new | interested | hot | cold | enrolled | unknown
 *   - source                inbox_screenshot | chat_screenshot | manual
 *   - screenshotFilenames   filenames this lead was extracted from
 *   - firstSeenAt           when the lead was first created
 *   - lastUpdatedAt         when the lead was last updated
 *   - rawExtraction         raw JSON Claude returned, for debugging
 *
 * TODO: Wire this up to your CRM. Make the real API call here (e.g. POST to the
 * CRM's contacts endpoint). Throw on failure so the caller can surface an error.
 */
export async function pushToCRM(lead: Lead): Promise<void> {
  console.log('[CRM] Would push lead:', lead);
}
