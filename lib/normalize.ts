// Phone number normalization for deduplication.
//
// The school is in Tunisia (country code +216), so we normalize numbers toward
// the canonical +216XXXXXXXX form. We keep BOTH the raw extracted value (for
// display) and the normalized value (for matching), per the dedup spec.

export interface NormalizedPhone {
  raw: string | null;
  normalized: string | null;
}

/**
 * Normalize a phone number string:
 *  - strip spaces, dashes, parentheses, dots
 *  - drop a leading "00" international prefix (equivalent to "+")
 *  - Tunisian numbers (216 / +216 + 8 digits) → "+216XXXXXXXX"
 *  - bare 8-digit local numbers are assumed Tunisian → "+216XXXXXXXX"
 *  - foreign numbers given with a "+" keep their "+CC..." form
 *  - otherwise return the digits as-is (best effort)
 */
export function normalizePhone(raw: string | null | undefined): NormalizedPhone {
  if (raw == null) return { raw: null, normalized: null };
  const original = raw.trim();
  if (!original) return { raw: null, normalized: null };

  const hadPlus = original.includes('+');
  // Keep digits only.
  let digits = original.replace(/\D/g, '');

  // "00" international access prefix behaves like a leading "+".
  let international = hadPlus;
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (!digits) return { raw: original, normalized: null };

  // Tunisian country code already present (216 + 8 national digits).
  if (digits.startsWith('216') && digits.length === 11) {
    return { raw: original, normalized: `+216${digits.slice(3)}` };
  }

  // Strip national trunk leading zeros.
  const national = digits.replace(/^0+/, '');

  // Bare 8-digit local number → assume Tunisian mobile/landline.
  if (national.length === 8) {
    return { raw: original, normalized: `+216${national}` };
  }

  // Explicit international number that isn't Tunisian: preserve "+CC...".
  if (international) {
    return { raw: original, normalized: `+${national}` };
  }

  // Fallback: digits as-is.
  return { raw: original, normalized: national || null };
}
