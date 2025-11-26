
const calculatePromoterCommission = (basePayout, productSales) => {
  const commissionRate = 0.10; // 10% commission on sales
  const salesCommission = productSales * commissionRate;
  return basePayout + salesCommission;
};