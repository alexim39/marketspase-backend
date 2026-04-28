export const setupOrderVirtuals = (schema) => {
  // Virtual for is paid
  schema.virtual('isPaid').get(function() {
    return this.paymentStatus === 'paid';
  });

  // Virtual for is delivered
  schema.virtual('isDelivered').get(function() {
    return this.orderStatus === 'delivered';
  });

  // Virtual for is cancelled
  schema.virtual('isCancelled').get(function() {
    return this.orderStatus === 'cancelled';
  });

  // Virtual for can be cancelled
  schema.virtual('canBeCancelled').get(function() {
    return ['pending', 'processing'].includes(this.orderStatus) && 
           this.paymentStatus !== 'paid';
  });

  // Virtual for can be refunded
  schema.virtual('canBeRefunded').get(function() {
    return this.orderStatus === 'delivered' && 
           this.paymentStatus === 'paid';
  });

  // Virtual for item count
  schema.virtual('itemCount').get(function() {
    return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  });

  // Virtual for unique product count
  schema.virtual('uniqueProductCount').get(function() {
    return this.items?.length || 0;
  });

  // Virtual for formatted total
  schema.virtual('formattedTotal').get(function() {
    return `${this.currency} ${this.totalAmount.toLocaleString()}`;
  });

  // Virtual for time ago
  schema.virtual('timeAgo').get(function() {
    const seconds = Math.floor((new Date() - this.createdAt) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
      }
    }
    
    return 'just now';
  });

  // Virtual for has promoter commission
  schema.virtual('hasPromoterCommission').get(function() {
    return this.totalPromoterCommission > 0;
  });

  // Virtual for items summary
  schema.virtual('itemsSummary').get(function() {
    return this.items.map(item => ({
      productId: item.product,
      name: item.name,
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.totalPrice
    }));
  });
};