import axios from 'axios';

export const verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.query;
    
    const response = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, // Safe on server
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: 'Server Error' });
  }
};
