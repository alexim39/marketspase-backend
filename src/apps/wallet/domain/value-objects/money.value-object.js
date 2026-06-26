// Domain value object — immutable Money representation
export class Money {
  constructor(amount, currency = 'NGN') {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error('Money amount must be a finite number.');
    }
    this._amount = Math.round(amount * 100) / 100; // round to 2 decimals
    this._currency = String(currency).toUpperCase();
  }

  get amount() { return this._amount; }
  get currency() { return this._currency; }

  add(other) {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other) {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  isGreaterThan(other) {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  isGreaterThanOrEqual(other) {
    this.assertSameCurrency(other);
    return this._amount >= other._amount;
  }

  isZero() { return this._amount === 0; }
  isNegative() { return this._amount < 0; }

  assertSameCurrency(other) {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: ${this._currency} vs ${other._currency}`);
    }
  }

  toJSON() { return { amount: this._amount, currency: this._currency }; }
  toString() { return `${this._currency} ${this._amount.toFixed(2)}`; }
}
