// src/payments/paystackClient.js
import axios from "axios";

const base = "https://api.paystack.co";
const SECRET = process.env.PAYSTACKTOKEN;
const headers = { Authorization: `Bearer ${SECRET}` };

export const paystackClient = {
  async verifyCharge(reference) {
    const { data } = await axios.get(`${base}/transaction/verify/${reference}`, { headers });
    return data?.data;
  },
  async verifyTransfer(reference) {
    const { data } = await axios.get(`${base}/transfer/verify/${reference}`, { headers });
    return data?.data;
  },
};