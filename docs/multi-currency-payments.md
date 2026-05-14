# Multi-Currency Payments and Withdrawals

## Overview

MarketSpase now supports multi-currency payment presentation across wallet funding and storefront checkout while preserving the existing Paystack-based settlement flow.

The implementation keeps backward compatibility by:

- preserving legacy wallet balance fields
- recording both native transaction currency and base reporting currency
- allowing currency selection on funding, checkout, and withdrawal flows
- locking quotes with signed snapshots for auditability

## Important Paystack Constraint

Paystack supports passing a transaction `currency` during transaction initialization and supports multiple currencies in specific markets, but this codebase does **not** rely on a Paystack exchange-rate quote API because no public official FX quote endpoint is currently used in Paystack's public developer docs.

Because of that:

- MarketSpase computes quotes through the configurable payment currency service
- Paystack remains the charge and transfer rail
- withdrawals in this environment are operationally constrained to NGN bank payouts through the current `nuban` transfer flow

## Core Backend Pieces

### Configuration

- `src/apps/wallet/models/payment-currency-config.model.js`
- `src/apps/wallet/services/payment-currency.service.js`

These files control:

- base currency
- supported currencies
- capability flags per currency
- rate source
- refresh interval
- quote lock duration

### Wallet Ledger Compatibility Layer

- `src/apps/wallet/services/wallet-ledger.service.js`

This service preserves:

- `wallet.balance`
- `wallet.reserved`

while also tracking:

- `balancesByCurrency`
- `reservedByCurrency`

## New / Updated Data Shape

### Wallet

Each role wallet can now store:

- `baseCurrency`
- `balancesByCurrency`
- `reservedByCurrency`

Legacy fields remain available for compatibility.

### Transactions

Wallet transactions now store:

- `currency`
- `baseCurrency`
- `settlementCurrency`
- `baseAmount`
- `settlementAmount`
- `exchangeRate`

### Storefront Orders and Payments

Orders can now store:

- `checkoutCurrency`
- `checkoutTotalAmount`
- `checkoutExchangeRate`

Payments can now store:

- `baseCurrency`
- `chargeAmount`
- `chargeCurrency`
- `exchangeRate`
- `quoteSnapshot`

## API Endpoints

### Public

- `GET /wallet/currencies/config`
- `GET /wallet/currencies/quote`
- `POST /wallet/currencies/validate-quote`

### Authenticated

- `GET /wallet/wallet-overview`
- `PUT /wallet/display-currency`

### Admin

- `GET /wallet/admin/payment-config`
- `PUT /wallet/admin/payment-config`

## Quote Model

Quotes are signed and time-bound. Each quote includes:

- source currency and amount
- target currency and amount
- base currency and amount
- exchange rate
- quote timestamp
- expiry timestamp
- signature

This prevents stale or tampered client-side conversions from being trusted during funding, withdrawal, or checkout.

## Frontend Coverage

### Platform App

- wallet funding dialog supports charge currency selection
- withdrawal flow supports source currency selection and payout estimate
- storefront product checkout supports buyer currency selection
- storefront cart checkout supports buyer currency selection

### Admin App

Admins can now manage:

- base currency
- rate source
- quote lock window
- refresh interval
- supported currencies
- Paystack charge and transfer capability flags
- display / deposit / checkout / withdrawal flags

## Withdrawal Behavior

In the current live environment:

- users can hold value in supported display currencies
- withdrawal requests can start from the selected wallet currency
- final bank payout is still processed in NGN through the existing Paystack bank transfer rail

This is intentional and matches the live transfer setup.

## Operational Notes

- If automatic rates are enabled, ensure outbound access to the configured exchange-rate provider is available.
- If rates cannot refresh, the last saved rates remain in use.
- For production finance review, confirm regulatory and tax treatment for multi-currency balances and conversion disclosure in each target market before enabling additional withdrawal currencies.

## Recommended QA

1. Fund wallet in NGN
2. Fund wallet in USD
3. Create storefront order in product currency
4. Pay checkout in alternate supported currency
5. Confirm order payment and escrow reservation
6. Submit withdrawal from marketer or promoter wallet
7. Verify transaction history records native and base amounts
8. Change display currency and confirm wallet overview updates
