import { COUNTRY_PHONE_MAP } from '../../utils/country-phones.js';

export const norm = (value) => (value == null ? '' : String(value).trim());
export const digitsOnly = (value) => norm(value).replace(/\D/g, '');

const DIAL_BY_ISO2 = new Map();
const ISO2_BY_NAME = new Map();
const ISO2S_BY_DIAL = new Map();

for (const country of COUNTRY_PHONE_MAP) {
  const iso2 = String(country.iso2 || '').toUpperCase();
  const nameKey = String(country.name || '').toLowerCase();
  const dialDigits = digitsOnly(country.dialCode);

  if (iso2) DIAL_BY_ISO2.set(iso2, dialDigits);
  if (nameKey) ISO2_BY_NAME.set(nameKey, iso2);
  if (dialDigits) {
    if (!ISO2S_BY_DIAL.has(dialDigits)) ISO2S_BY_DIAL.set(dialDigits, []);
    ISO2S_BY_DIAL.get(dialDigits).push(iso2);
  }
}

const KEEP_LEADING_ZERO_ISO2 = new Set(['IT']);
const KEEP_LEADING_ZERO_CC = new Set(['39']);

const sanitizeLocalForE164 = (ccDigits, iso2, localDigits) => {
  if (!localDigits) return localDigits;
  const iso = (iso2 || '').toUpperCase();
  const keepZero = KEEP_LEADING_ZERO_ISO2.has(iso) || KEEP_LEADING_ZERO_CC.has(ccDigits);

  return keepZero ? localDigits : localDigits.replace(/^0+/, '');
};

const detectIso2FromCanonical = (canonicalDigits) => {
  let bestIso = null;
  let bestLen = 0;
  for (const [dial, isoList] of ISO2S_BY_DIAL.entries()) {
    if (canonicalDigits.startsWith(dial) && dial.length > bestLen) {
      bestIso = isoList[0];
      bestLen = dial.length;
    }
  }

  if (!bestIso && canonicalDigits.startsWith('1')) return 'US';
  return bestIso;
};

const composeCanonicalFromCCAndLocal = (ccInput, localDigitsInput, isoHint, nameHint) => {
  const ccDigits = digitsOnly(ccInput);
  if (!ccDigits) return null;

  let iso2 = (isoHint || ISO2_BY_NAME.get(norm(nameHint).toLowerCase()) || '').toUpperCase();
  let localDigits = digitsOnly(localDigitsInput);
  localDigits = sanitizeLocalForE164(ccDigits, iso2, localDigits);

  if (!localDigits) return null;

  let dialForIso = iso2 ? DIAL_BY_ISO2.get(iso2) : null;

  if (!dialForIso && ccDigits === '1' && nameHint) {
    const nameIso = ISO2_BY_NAME.get(norm(nameHint).toLowerCase());
    if (nameIso) dialForIso = DIAL_BY_ISO2.get(nameIso);
  }

  const canonical = dialForIso
    ? dialForIso.startsWith('1') && dialForIso.length > 1
      ? `1${dialForIso.slice(1)}${localDigits}`
      : `${dialForIso}${localDigits}`
    : `${ccDigits}${localDigits}`;

  if (canonical.length < 8 || canonical.length > 15) return null;

  if (!iso2) {
    iso2 = detectIso2FromCanonical(canonical) || null;
  }

  let ccForDetails = null;
  if (iso2) {
    const dial = DIAL_BY_ISO2.get(iso2);
    ccForDetails = dial?.startsWith('1') && dial.length > 1 ? '1' : dial || ccDigits;
  } else {
    for (let len = 1; len <= 3; len += 1) {
      const ccCandidate = canonical.slice(0, len);
      if (ISO2S_BY_DIAL.has(ccCandidate)) {
        ccForDetails = ccCandidate;
        break;
      }
    }
    if (!ccForDetails) ccForDetails = ccDigits;
  }

  const nationalNumber = canonical.slice(ccForDetails.length);
  return { canonical, iso2, cc: ccForDetails, nn: nationalNumber };
};

const internationalDetailsFromCanonical = (canonical, iso2FromDetails = null) => {
  if (canonical.length < 8 || canonical.length > 15) throw new Error('INVALID_PHONE');

  const iso2 = detectIso2FromCanonical(canonical) || iso2FromDetails || null;
  const countryCode = iso2
    ? (DIAL_BY_ISO2.get(iso2)?.startsWith('1') && DIAL_BY_ISO2.get(iso2).length > 1
      ? '1'
      : DIAL_BY_ISO2.get(iso2))
    : null;
  const ccDigits = countryCode || canonical.slice(0, Math.min(3, canonical.length));
  const nationalNumber = canonical.slice(ccDigits.length);

  return {
    digits: canonical,
    e164Plus: `+${canonical}`,
    iso2,
    countryCode: ccDigits,
    nationalNumber,
  };
};

export const normalizePhoneWithoutLib = (rawPhone, phoneDetails, addressCountryName) => {
  if (rawPhone === undefined || rawPhone === null) return null;
  const raw = norm(rawPhone);
  if (!raw) return null;

  const fullFromDetails = norm(phoneDetails?.fullNumber);
  const iso2FromDetails = norm(phoneDetails?.iso2).toUpperCase();
  const ccFromDetails = digitsOnly(phoneDetails?.countryCode);
  const localDigits = digitsOnly(raw);
  const nameHint = norm(addressCountryName);

  if (fullFromDetails.startsWith('+')) {
    return internationalDetailsFromCanonical(digitsOnly(fullFromDetails), iso2FromDetails || null);
  }

  if (raw.startsWith('+')) {
    return internationalDetailsFromCanonical(digitsOnly(raw), iso2FromDetails || null);
  }

  if (ccFromDetails) {
    const composed = composeCanonicalFromCCAndLocal(ccFromDetails, localDigits, iso2FromDetails, nameHint);
    if (!composed) throw new Error('INVALID_PHONE');
    const { canonical, iso2, cc, nn } = composed;
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: cc,
      nationalNumber: nn,
    };
  }

  if (iso2FromDetails) {
    const dial = DIAL_BY_ISO2.get(iso2FromDetails);
    if (!dial) throw new Error('INVALID_PHONE');

    const sanitizedLocal = sanitizeLocalForE164(dial, iso2FromDetails, localDigits);
    const composed = composeCanonicalFromCCAndLocal(dial, sanitizedLocal, iso2FromDetails, null);
    if (!composed) throw new Error('INVALID_PHONE');

    const { canonical, iso2, cc, nn } = composed;
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: cc,
      nationalNumber: nn,
    };
  }

  const nameIso = ISO2_BY_NAME.get(nameHint.toLowerCase());
  if (nameIso) {
    const dial = DIAL_BY_ISO2.get(nameIso);
    const composed = composeCanonicalFromCCAndLocal(dial || '', localDigits, nameIso, null);
    if (composed) {
      const { canonical, iso2, cc, nn } = composed;
      return {
        digits: canonical,
        e164Plus: `+${canonical}`,
        iso2,
        countryCode: cc,
        nationalNumber: nn,
      };
    }
  }

  const onlyDigits = digitsOnly(raw);
  if (/^234\d{10}$/.test(onlyDigits)) {
    return {
      digits: onlyDigits,
      e164Plus: `+${onlyDigits}`,
      iso2: 'NG',
      countryCode: '234',
      nationalNumber: onlyDigits.slice(3),
    };
  }

  throw new Error('INVALID_PHONE');
};

export const buildClearedPhoneDetails = (lastUpdated) => ({
  countryCode: null,
  nationalNumber: null,
  fullNumber: null,
  iso2: null,
  lastUpdated,
});

export const buildCanonicalPhoneDetails = (canonical, lastUpdated) => ({
  countryCode: canonical.countryCode,
  nationalNumber: canonical.nationalNumber,
  fullNumber: canonical.e164Plus,
  iso2: canonical.iso2,
  lastUpdated,
});
