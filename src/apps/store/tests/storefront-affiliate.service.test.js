// tests/storefront-affiliate.service.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { calculateCommissionForAmount, roundMoney } from "../services/storefront-affiliate.service.js";

test("calculateCommissionForAmount - percentage commission", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 10 });
  assert.strictEqual(result, 500); // 5000 * 10% = 500
});

test("calculateCommissionForAmount - fixed commission", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "fixed", fixedCommission: 300 });
  assert.strictEqual(result, 300);
});

test("calculateCommissionForAmount - fixed commission capped at sale amount", () => {
  const result = calculateCommissionForAmount(200, { commissionType: "fixed", fixedCommission: 500 });
  assert.strictEqual(result, 200);
});

test("calculateCommissionForAmount - percentage capped at 100%", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 150 });
  assert.strictEqual(result, 5000); // capped at full sale amount
});

test("calculateCommissionForAmount - zero amount returns zero", () => {
  const result = calculateCommissionForAmount(0, { commissionType: "percentage", commissionRate: 10 });
  assert.strictEqual(result, 0);
});

test("calculateCommissionForAmount - negative amount returns zero", () => {
  const result = calculateCommissionForAmount(-100, { commissionType: "percentage", commissionRate: 10 });
  assert.strictEqual(result, 0);
});

test("calculateCommissionForAmount - gold tier bonus adds 10%", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 10 }, "gold");
  assert.strictEqual(result, 1000); // 5000 * 20% = 1000
});

test("calculateCommissionForAmount - silver tier bonus adds 5%", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 10 }, "silver");
  assert.strictEqual(result, 750); // 5000 * 15% = 750
});

test("calculateCommissionForAmount - bronze tier bonus adds 2%", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 10 }, "bronze");
  assert.strictEqual(result, 600); // 5000 * 12% = 600
});

test("calculateCommissionForAmount - unranked tier gets no bonus", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 10 }, "unranked");
  assert.strictEqual(result, 500); // 5000 * 10% = 500
});

test("calculateCommissionForAmount - unknown tier gets no bonus", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 10 }, "platinum");
  assert.strictEqual(result, 500);
});

test("calculateCommissionForAmount - tier bonus does not affect fixed commission", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "fixed", fixedCommission: 300 }, "gold");
  assert.strictEqual(result, 300);
});

test("calculateCommissionForAmount - defaults to DEFAULT_COMMISSION_RATE when no rate given", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage" });
  assert.strictEqual(result, 500); // 5000 * 10% default = 500
});

test("calculateCommissionForAmount - tier bonus capped at 100% total", () => {
  const result = calculateCommissionForAmount(5000, { commissionType: "percentage", commissionRate: 95 }, "gold");
  assert.strictEqual(result, 5000); // 95% + 10% = 105% → capped at 100%
});

test("roundMoney - rounds to 2 decimal places", () => {
  assert.strictEqual(roundMoney(10.125), 10.13);
  assert.strictEqual(roundMoney(10.124), 10.12);
  assert.strictEqual(roundMoney(10), 10.00);
  assert.strictEqual(roundMoney(0), 0.00);
});

test("roundMoney - handles string input", () => {
  assert.strictEqual(roundMoney("10.125"), 10.13);
  assert.strictEqual(roundMoney("0"), 0.00);
});

test("calculateCommissionForAmount - real world example: ₦15,000 product at 10% + gold tier", () => {
  const result = calculateCommissionForAmount(15000, { commissionType: "percentage", commissionRate: 10 }, "gold");
  assert.strictEqual(result, 3000); // 15000 * 20% = 3000
});

test("calculateCommissionForAmount - real world example: ₦50,000 product at 5% + silver tier", () => {
  const result = calculateCommissionForAmount(50000, { commissionType: "percentage", commissionRate: 5 }, "silver");
  assert.strictEqual(result, 5000); // 50000 * 10% = 5000
});
