


export function transformTransaction(user, transaction, walletType) {
  return {
    id: transaction._id?.toString() || `TXN-${Date.now()}`,
    userId: user._id.toString(),
    userName: user.displayName,
    userRole: walletType,
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
    description: transaction.description || `${transaction.category} transaction`,
    status: transaction.status,
    createdAt: transaction.createdAt,
    processedAt: transaction.processedAt,
    reference: transaction.reference || `REF-${Date.now()}`,
    relatedCampaign: transaction.relatedCampaign?.toString(),
    relatedPromotion: transaction.relatedPromotion?.toString()
  };
}
