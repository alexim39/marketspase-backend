
// src/apps/user/controllers/profile-update.controller.js

import mongoose from 'mongoose';
import { UserModel } from './../models/user/index.js';

// Country phone list (ADJUST this path to your backend location)
import { COUNTRY_PHONE_MAP } from '../utils/country-phones.js';

/**
 * We store phone as digits-only E.164 (no '+'), e.g.:
 *   "+2348051234567" -> "2348051234567"
 *   "+14155552671"   -> "14155552671"
 *
 * phoneDetails is populated for convenience:
 *   {
 *     countryCode: "<E.164 country calling code>",   // e.g., "234", "1", "44"
 *     nationalNumber: "<national significant number>",// e.g., "8051234567"
 *     fullNumber: "+<countryCode><nationalNumber>",   // e.g., "+2348051234567"
 *     iso2: "<ISO2>",                                 // e.g., "NG", "US", "GB"
 *     lastUpdated: Date
 *   }
 */

// ----------------- Country list helpers -----------------
const norm = (v) => (v == null ? '' : String(v).trim());
const digitsOnly = (v) => norm(v).replace(/\D/g, '');

// Build lookups from [country-phones.js](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/country-phones.js?EntityRepresentationId=102562f9-0a96-47a7-a1cf-ab94fe28b645) (normalize hyphen codes like "1-264") [1](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/country-phones.js)
const DIAL_BY_ISO2 = new Map();          // "US" -> "1", "AI" -> "1264"
const ISO2_BY_NAME = new Map();          // "anguilla" -> "AI"
const ISO2S_BY_DIAL = new Map();         // "1" -> ["US","CA",...], "1264" -> ["AI"], "234" -> ["NG"]

for (const c of COUNTRY_PHONE_MAP) {
  const iso2 = String(c.iso2 || '').toUpperCase();
  const nameKey = String(c.name || '').toLowerCase();
  const dialDigits = digitsOnly(c.dialCode);   // "1-264" => "1264"

  if (iso2) DIAL_BY_ISO2.set(iso2, dialDigits);
  if (nameKey) ISO2_BY_NAME.set(nameKey, iso2);
  if (dialDigits) {
    if (!ISO2S_BY_DIAL.has(dialDigits)) ISO2S_BY_DIAL.set(dialDigits, []);
    ISO2S_BY_DIAL.get(dialDigits).push(iso2);
  }
}


// Keep-leading-zero exceptions (countries where '0' is significant in E.164)
const KEEP_LEADING_ZERO_ISO2 = new Set(['IT']);  // Italy
const KEEP_LEADING_ZERO_CC   = new Set(['39']);  // Country calling code for Italy


/**
 * Remove national trunk prefix '0' from local (national) numbers
 * for most countries *before* composing E.164. Keep it for exceptions.
 */
function sanitizeLocalForE164(ccDigits, iso2, localDigits) {
  if (!localDigits) return localDigits;
  const iso = (iso2 || '').toUpperCase();
  const keepZero =
    KEEP_LEADING_ZERO_ISO2.has(iso) || KEEP_LEADING_ZERO_CC.has(ccDigits);

  if (keepZero) {
    // Example: Italy landline keeps the leading 0 in the NSN
    return localDigits;
  }

  // For most countries (NG, GH, GB, KE, etc.), remove leading trunk '0'
  return localDigits.replace(/^0+/, '');
}


// Longest-prefix match: find the ISO2 whose dialDigits are the longest prefix of the canonical E.164
function detectIso2FromCanonical(canonicalDigits) {
  let bestIso = null;
  let bestLen = 0;
  for (const [dial, isoList] of ISO2S_BY_DIAL.entries()) {
    if (canonicalDigits.startsWith(dial) && dial.length > bestLen) {
      bestIso = isoList[0]; // first ISO2 for that dial; for "1" this will be ambiguous (default later)
      bestLen = dial.length;
    }
  }
  // Default ambiguity for "1": US if nothing else is known
  if (!bestIso && canonicalDigits.startsWith('1')) return 'US';
  return bestIso;
}

// Compose canonical digits-only E.164 from country code and local digits.
// Handles NANP "1" and variants like "1-264" from the list.

function composeCanonicalFromCCAndLocal(ccInput, localDigitsInput, isoHint, nameHint) {
  const ccDigits = digitsOnly(ccInput);
  if (!ccDigits) return null;

  // Resolve ISO2 (from hint or country name)
  let iso2 = (isoHint || ISO2_BY_NAME.get(norm(nameHint).toLowerCase()) || '').toUpperCase();

  // ❶ Sanitize local number with trunk rules BEFORE compose
  let localDigits = digitsOnly(localDigitsInput);
  localDigits = sanitizeLocalForE164(ccDigits, iso2, localDigits);

  if (!localDigits) return null;

  let dialForIso = iso2 ? DIAL_BY_ISO2.get(iso2) : null;

  // If NANP (cc "1") and address name implies a "1-xxx" territory, prefer that
  if (!dialForIso && ccDigits === '1' && nameHint) {
    const nameIso = ISO2_BY_NAME.get(norm(nameHint).toLowerCase());
    if (nameIso) dialForIso = DIAL_BY_ISO2.get(nameIso);
  }

  let canonical = null;

  if (dialForIso) {
    // dialForIso may be "234" or "1" or "1264", etc.
    if (dialForIso.startsWith('1') && dialForIso.length > 1) {
      // NANP territory like "1264": treat as "1" + "264" + localDigits
      canonical = '1' + dialForIso.slice(1) + localDigits;
    } else {
      canonical = dialForIso + localDigits;
    }
  } else {
    // Fallback: just <ccDigits> + sanitized local
    canonical = ccDigits + localDigits;
  }

  // E.164 sanity bounds
  if (canonical.length < 8 || canonical.length > 15) return null;

  // Deduce ISO2 if still missing (longest-prefix match)
  if (!iso2) {
    iso2 = detectIso2FromCanonical(canonical) || null;
  }

  // Derive *pure* E.164 country calling code for details:
  let ccForDetails = null;
  if (iso2) {
    const dial = DIAL_BY_ISO2.get(iso2);
    ccForDetails = dial?.startsWith('1') && dial.length > 1 ? '1' : dial || ccDigits;
  } else {
    for (let len = 1; len <= 3; len++) {
      const ccCandidate = canonical.slice(0, len);
      if (ISO2S_BY_DIAL.has(ccCandidate)) { ccForDetails = ccCandidate; break; }
    }
    if (!ccForDetails) ccForDetails = ccDigits;
  }

  const nationalNumber = canonical.slice(ccForDetails.length);
  return { canonical, iso2, cc: ccForDetails, nn: nationalNumber };
}


/* function composeCanonicalFromCCAndLocal(ccInput, localDigits, isoHint, nameHint) {
  const ccDigits = digitsOnly(ccInput);
  if (!ccDigits) return null;

  // If we know ISO2 (or name), prefer exact dial for that ISO2
  let iso2 = (isoHint || ISO2_BY_NAME.get(norm(nameHint).toLowerCase()) || '').toUpperCase();
  let dialForIso = iso2 ? DIAL_BY_ISO2.get(iso2) : null;

  // If no ISO2, but CC is "1" (NANP) and name resolves to a "1-xxx" dial (e.g., AI => "1264")
  if (!dialForIso && ccDigits === '1' && nameHint) {
    const nameIso = ISO2_BY_NAME.get(norm(nameHint).toLowerCase());
    if (nameIso) dialForIso = DIAL_BY_ISO2.get(nameIso);
  }

  // If we have a full NANP dial like "1264" (Anguilla), the real E.164 country code is still "1".
  // We'll treat "1264" as "1"+"264" (area) + 7-digit local (typical), but we DON'T enforce strict area lengths.
  let canonical = null;

  if (dialForIso) {
    // dialForIso could be "234" or "1" or "1264" etc.
    if (dialForIso.startsWith('1') && dialForIso.length > 1) {
      // NANP variant: "1264" (1 + area 264)
      canonical = '1' + dialForIso.slice(1) + localDigits;
    } else {
      // Regular country: use dialForIso directly
      canonical = dialForIso + localDigits;
    }
  } else {
    // Fall back to just CC + local
    canonical = ccDigits + localDigits;
  }

  // Basic length guards (E.164 max 15)
  if (canonical.length < 8 || canonical.length > 15) return null;

  // Deduce ISO2 if missing (longest-prefix match against canonical)
  if (!iso2) {
    iso2 = detectIso2FromCanonical(canonical) || null;
  }

  // Derive E.164 country calling code (pure CC, not NANP area prefixes)
  // If we have an ISO2 with dial "1264", its CC is "1".
  let ccForDetails = null;
  if (iso2) {
    const dial = DIAL_BY_ISO2.get(iso2);
    ccForDetails = dial?.startsWith('1') && dial.length > 1 ? '1' : dial || ccDigits;
  } else {
    // No ISO2: try to infer CC by progressively chopping from canonical
    // (pick the shortest plausible CC that yields national <= 14)
    // We’ll prefer 1..3 digits typical CCs; if ambiguous, keep provided ccDigits.
    for (let len = 1; len <= 3; len++) {
      const ccCandidate = canonical.slice(0, len);
      if (ISO2S_BY_DIAL.has(ccCandidate)) { ccForDetails = ccCandidate; break; }
    }
    if (!ccForDetails) ccForDetails = ccDigits;
  }

  const nationalNumber = canonical.slice(ccForDetails.length);
  return {
    canonical,      // digits-only E.164
    iso2,
    cc: ccForDetails,
    nn: nationalNumber
  };
} */

/**
 * Normalize any phone input to canonical digits-only E.164 using only COUNTRY_PHONE_MAP.
 * Returns:
 *  - { digits, e164Plus, iso2, countryCode, nationalNumber } if valid
 *  - null if raw was empty (clear)
 *  - throws Error('INVALID_PHONE') if non-empty but invalid
 */
function normalizePhoneWithoutLib(rawPhone, phoneDetails, addressCountryName) {
  if (rawPhone === undefined || rawPhone === null) return null;
  const raw = norm(rawPhone);
  if (!raw) return null;

  const fullFromDetails = norm(phoneDetails?.fullNumber);
  const iso2FromDetails = norm(phoneDetails?.iso2).toUpperCase();
  const ccFromDetails   = digitsOnly(phoneDetails?.countryCode);
  const localDigits     = digitsOnly(raw);
  const nameHint        = norm(addressCountryName);

  // 1) If a full international number was provided in details, accept it directly
  if (fullFromDetails.startsWith('+')) {
    const canonical = digitsOnly(fullFromDetails);
    if (canonical.length < 8 || canonical.length > 15) throw new Error('INVALID_PHONE');
    const iso2 = detectIso2FromCanonical(canonical) || iso2FromDetails || null;
    const countryCode = iso2 ? (DIAL_BY_ISO2.get(iso2)?.startsWith('1') && DIAL_BY_ISO2.get(iso2).length > 1 ? '1' : DIAL_BY_ISO2.get(iso2)) : null;
    const ccDigits = countryCode || canonical.slice(0, Math.min(3, canonical.length)); // best-effort
    const nn = canonical.slice(ccDigits.length);
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: ccDigits,
      nationalNumber: nn
    };
  }

  // 2) Raw starts with "+": treat as international directly
  if (raw.startsWith('+')) {
    const canonical = digitsOnly(raw);
    if (canonical.length < 8 || canonical.length > 15) throw new Error('INVALID_PHONE');
    const iso2 = detectIso2FromCanonical(canonical) || iso2FromDetails || null;
    const countryCode = iso2 ? (DIAL_BY_ISO2.get(iso2)?.startsWith('1') && DIAL_BY_ISO2.get(iso2).length > 1 ? '1' : DIAL_BY_ISO2.get(iso2)) : null;
    const ccDigits = countryCode || canonical.slice(0, Math.min(3, canonical.length)); // best-effort
    const nn = canonical.slice(ccDigits.length);
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: ccDigits,
      nationalNumber: nn
    };
  }

  // 3) Have explicit countryCode: compose and validate
  if (ccFromDetails) {
    const composed = composeCanonicalFromCCAndLocal(ccFromDetails, localDigits, iso2FromDetails, nameHint);
    if (!composed) throw new Error('INVALID_PHONE');
    const { canonical, iso2, cc, nn } = composed;
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: cc,
      nationalNumber: nn
    };
  }

  // 4) Have explicit iso2: get its dial and compose
  if (iso2FromDetails) {
    const dial = DIAL_BY_ISO2.get(iso2FromDetails);
    if (!dial) throw new Error('INVALID_PHONE');

    // sanitize here too
    const sanitizedLocal = sanitizeLocalForE164(dial, iso2FromDetails, localDigits);
    const composed = composeCanonicalFromCCAndLocal(dial, sanitizedLocal, iso2FromDetails, null);
    if (!composed) throw new Error('INVALID_PHONE');

    const { canonical, iso2, cc, nn } = composed;
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: cc,
      nationalNumber: nn
    };
  }


 /*  if (iso2FromDetails) {
    const dial = DIAL_BY_ISO2.get(iso2FromDetails);
    if (!dial) throw new Error('INVALID_PHONE');
    const composed = composeCanonicalFromCCAndLocal(dial, localDigits, iso2FromDetails, null);
    if (!composed) throw new Error('INVALID_PHONE');
    const { canonical, iso2, cc, nn } = composed;
    return {
      digits: canonical,
      e164Plus: `+${canonical}`,
      iso2,
      countryCode: cc,
      nationalNumber: nn
    };
  } */

  // 5) Use address country name
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
        nationalNumber: nn
      };
    }
  }

  // 6) Legacy NG fallback: "234XXXXXXXXXX"
  const onlyDigits = digitsOnly(raw);
  if (/^234\d{10}$/.test(onlyDigits)) {
    return {
      digits: onlyDigits,
      e164Plus: `+${onlyDigits}`,
      iso2: 'NG',
      countryCode: '234',
      nationalNumber: onlyDigits.slice(3)
    };
  }

  throw new Error('INVALID_PHONE');
}

/**
 * @desc Update a user's profile details (international; no external libs)
 * @route PATCH /api/users/profile
 * @access Private
 */
export const UpdateProfile = async (req, res) => {
  try {
    const {
      email,
      phone,
      gender,
      street,
      city,
      state,
      country,
      biography,
      dob,
      phoneDetails
    } = req.body;

    const targetUserId = req.userId;

    //console.log('Profile update request body:', req.body);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required to update the profile.' });
    }
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    const existingUser = await UserModel.findById(targetUserId).lean();
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updateData = {};

    // ---- Email (validate + unique) ----
    if (email !== undefined && email !== null) {
      const cleanedEmail = norm(email).toLowerCase();
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (cleanedEmail && !emailRegex.test(cleanedEmail)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
      }
      if (cleanedEmail) {
        const existingUserWithEmail = await UserModel.findOne({
          email: cleanedEmail,
          _id: { $ne: targetUserId },
        }).lean();
        if (existingUserWithEmail) {
          return res.status(409).json({
            success: false,
            message: 'This email address is already registered with another account.',
          });
        }
        updateData.email = cleanedEmail;
      } else {
        updateData.email = null;
      }
    }

    // ---- Phone (normalize + unique) ----
    if (phone !== undefined) {
      const rawStr = norm(phone);
      if (!rawStr) {
        updateData['personalInfo.phone'] = null;
        updateData['personalInfo.phoneDetails'] = {
          countryCode: null,
          nationalNumber: null,
          fullNumber: null,
          iso2: null,
          lastUpdated: new Date()
        };
      } else {
        let canonical;
        try {
          // Use country name and phoneDetails to compose canonical without external libs
          canonical = normalizePhoneWithoutLib(rawStr, phoneDetails, country);
        } catch (e) {
          if (e?.message === 'INVALID_PHONE') {
            return res.status(400).json({
              success: false,
              message:
                'Invalid phone number. Use a valid local number with its country (e.g., 0803… + NG) or an international number (e.g., +234803…, +1415…, +4479…).',
            });
          }
          throw e;
        }

        // Uniqueness pre-check on canonical digits-only
        const existingUserWithPhone = await UserModel.findOne({
          'personalInfo.phone': canonical.digits,
          _id: { $ne: targetUserId },
        }).lean();
        if (existingUserWithPhone) {
          return res.status(409).json({
            success: false,
            message: 'This phone number is already registered with another account.',
          });
        }

        // Persist canonical
        updateData['personalInfo.phone'] = canonical.digits;
        updateData['personalInfo.phoneDetails'] = {
          countryCode: canonical.countryCode,
          nationalNumber: canonical.nationalNumber,
          fullNumber: canonical.e164Plus,
          iso2: canonical.iso2,
          lastUpdated: new Date()
        };
      }
    }

    // ---- Other personal info ----
    if (biography !== undefined) updateData['personalInfo.biography'] = biography;
    if (gender !== undefined) updateData['personalInfo.gender'] = gender;
    if (dob !== undefined) updateData['personalInfo.dob'] = dob;

    // ---- Address merge ----
    const addressUpdate = {};
    if (street !== undefined) addressUpdate.street = street;
    if (city !== undefined) addressUpdate.city = city;
    if (state !== undefined) addressUpdate.state = state;
    if (country !== undefined) addressUpdate.country = country;
    if (Object.keys(addressUpdate).length > 0) {
      const existingAddress = existingUser?.personalInfo?.address ?? {};
      updateData['personalInfo.address'] = { ...existingAddress, ...addressUpdate };
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update.' });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      targetUserId,
      updateData,
      { new: true, runValidators: true, context: 'query' }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found after update attempt.' });
    }

    if (typeof updatedUser.logActivity === 'function') {
      await updatedUser.logActivity('profile_update', `You updated your profile details`, {});
    }

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully.',
      data: {
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          personalInfo: updatedUser.personalInfo,
        },
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);

    if (error && error.code === 11000) {
      const field = Object.keys(error.keyValue ?? {})[0] ?? '';
      const fieldName = field.replace('personalInfo.', '');
      const fieldMessages = {
        email: 'email address',
        phone: 'phone number',
        username: 'username',
        uid: 'user ID',
      };
      return res.status(409).json({
        success: false,
        message: `This ${fieldMessages[fieldName] ?? fieldName} is already registered.`,
      });
    }

    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ success: false, message: `Validation error: ${messages.join(', ')}` });
    }

    if (error?.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }

    return res.status(500).json({ success: false, message: 'Server error. Failed to update profile.' });
  }
};
