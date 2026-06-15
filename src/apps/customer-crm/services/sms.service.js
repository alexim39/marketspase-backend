import axios from 'axios';

const BULKSMS_API_URL_HOST = 'www.bulksmsnigeria.com';
const BULKSMS_TOKEN = process.env.BULKSMS_TOKEN || 'wAW4HgFfHcbtgRRzWuYUBKQhiHdMuBBSSn6O8Nwv35JPNSrACwFlY6b0rLbS';
const BULKSMS_FROM = process.env.BULKSMS_FROM || 'async';

const formatPhone = (phone) => {
  let cleaned = String(phone || '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.length === 10 && (cleaned.startsWith('70') || cleaned.startsWith('80') || cleaned.startsWith('90') || cleaned.startsWith('81'))) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
};

export const sendSms = async (to, message, options = {}) => {
  const numbers = String(to).split(',').map(n => formatPhone(n.trim())).filter(Boolean).join(',');
  if (!numbers) throw new Error('No valid recipient phone number.');

  const token = options.apiToken || BULKSMS_TOKEN;
  const from = options.from || BULKSMS_FROM;
  const ref = options.customerReference || `MSP${Date.now()}`;

  // Strategy 1: v2 API with api_token in body
  try {
    const resp = await axios.post(`https://${BULKSMS_API_URL_HOST}/api/v2/sms`, {
      body: message, from, to: numbers, api_token: token,
      gateway: options.gateway || '0',
      customer_reference: ref,
    }, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 });
    if (resp.data?.status === 'success') return resp.data;
  } catch (e) { /* continue */ }

  // Strategy 2: v2 API with Bearer token header
  try {
    const resp = await axios.post(`https://${BULKSMS_API_URL_HOST}/api/v2/sms`, {
      body: message, from, to: numbers, gateway: options.gateway || '0', customer_reference: ref,
    }, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 });
    if (resp.data?.status === 'success') return resp.data;
  } catch (e) { /* continue */ }

  // Strategy 3: v1 API
  try {
    const resp = await axios.get(`https://${BULKSMS_API_URL_HOST}/api/v1/sms/create`, {
      params: { api_token: token, from, to: numbers, body: message, gateway: options.gateway || '0' },
      timeout: 15000,
    });
    if (resp.data?.status === 'success') return resp.data;
  } catch (e) { /* continue */ }

  throw new Error(`Failed to send SMS. The API token may be expired or invalid. Please generate a new token at https://${BULKSMS_API_URL_HOST}/dashboard/api`);
};

export const sendBulkSms = async (recipients, message, options = {}) => {
  const phones = recipients.map(r => formatPhone(typeof r === 'string' ? r : r.phone)).filter(Boolean);
  if (!phones.length) throw new Error('No valid recipient phone numbers provided.');
  return sendSms(phones.join(','), message, { ...options, customerReference: `MSPBULK${Date.now()}` });
};
