

// Paid verification feature
const handleStoreVerification = async (storeId, tier = "premium") => {
  const store = await StoreModel.findById(storeId);
  const owner = await UserModel.findById(store.owner);
  
  const verificationFee = tier === "premium" ? 5000 : 0; // NGN
  
  if (verificationFee > 0) {
    // Deduct from marketer wallet
    owner.wallets.marketer.balance -= verificationFee;
    owner.wallets.marketer.transactions.push({
      amount: verificationFee,
      type: 'debit',
      category: 'store_verification',
      description: `Store ${tier} verification fee`,
      status: 'successful'
    });
    
    await owner.save();
  }
  
  store.isVerified = true;
  store.verificationTier = tier;
  await store.save();
};