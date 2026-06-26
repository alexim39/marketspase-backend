// Domain aggregate root — Wallet
// A User has two wallets: marketer and promoter. Each is a separate aggregate.
import { Money } from '../value-objects/money.value-object.js';

export class Wallet {
  constructor({ userId, side, balance = 0, reserved = 0, currency = 'NGN' }) {
    this.userId = userId;
    this.side = side; // 'marketer' | 'promoter'
    this._balance = new Money(balance, currency);
    this._reserved = new Money(reserved, currency);
    this._events = [];
  }

  get balance() { return this._balance; }
  get reserved() { return this._reserved; }
  get availableBalance() { return this._balance.subtract(this._reserved); }

  get domainEvents() { return [...this._events]; }
  clearEvents() { this._events = []; }

  /** Credit (add) funds to available balance. */
  credit(amount, source, reference) {
    const money = amount instanceof Money ? amount : new Money(amount, this._balance.currency);
    if (money.isNegative()) throw new Error('Cannot credit a negative amount.');
    this._balance = this._balance.add(money);
    this._events.push(new WalletCredited(this.userId, this.side, money, source, reference));
    return this;
  }

  /** Debit (deduct) funds from available balance. Throws if insufficient. */
  debit(amount, purpose, reference) {
    const money = amount instanceof Money ? amount : new Money(amount, this._balance.currency);
    if (!this.availableBalance.isGreaterThanOrEqual(money)) {
      throw new InsufficientFundsError(this.userId, this.side, this.availableBalance, money);
    }
    this._balance = this._balance.subtract(money);
    this._events.push(new WalletDebited(this.userId, this.side, money, purpose, reference));
    return this;
  }

  /** Reserve funds (move from balance to reserved). Throws if insufficient. */
  reserve(amount, purpose, reference) {
    const money = amount instanceof Money ? amount : new Money(amount, this._balance.currency);
    if (!this.availableBalance.isGreaterThanOrEqual(money)) {
      throw new InsufficientFundsError(this.userId, this.side, this.availableBalance, money);
    }
    this._reserved = this._reserved.add(money);
    this._events.push(new FundsReserved(this.userId, this.side, money, purpose, reference));
    return this;
  }

  /** Release reserved funds back to balance. Throws if insufficient reserved. */
  release(amount, purpose, reference) {
    const money = amount instanceof Money ? amount : new Money(amount, this._reserved.currency);
    if (!this._reserved.isGreaterThanOrEqual(money)) {
      throw new Error(`Cannot release more than reserved: ${this._reserved.toString()} < ${money.toString()}`);
    }
    this._reserved = this._reserved.subtract(money);
    this._events.push(new FundsReleased(this.userId, this.side, money, purpose, reference));
    return this;
  }

  /** Spend reserved funds (deduct from reserved). Throws if insufficient. */
  spendReserved(amount, purpose, reference) {
    const money = amount instanceof Money ? amount : new Money(amount, this._reserved.currency);
    if (!this._reserved.isGreaterThanOrEqual(money)) {
      throw new Error(`Cannot spend more reserved than available: ${this._reserved.toString()} < ${money.toString()}`);
    }
    this._reserved = this._reserved.subtract(money);
    this._events.push(new ReservedFundsSpent(this.userId, this.side, money, purpose, reference));
    return this;
  }
}

// Domain events
export class WalletCredited {
  constructor(userId, side, amount, source, reference) {
    this.eventType = 'WalletCredited';
    this.userId = userId;
    this.side = side;
    this.amount = amount;
    this.source = source;
    this.reference = reference;
    this.occurredAt = new Date();
  }
}

export class WalletDebited {
  constructor(userId, side, amount, purpose, reference) {
    this.eventType = 'WalletDebited';
    this.userId = userId;
    this.side = side;
    this.amount = amount;
    this.purpose = purpose;
    this.reference = reference;
    this.occurredAt = new Date();
  }
}

export class FundsReserved {
  constructor(userId, side, amount, purpose, reference) {
    this.eventType = 'FundsReserved';
    this.userId = userId;
    this.side = side;
    this.amount = amount;
    this.purpose = purpose;
    this.reference = reference;
    this.occurredAt = new Date();
  }
}

export class FundsReleased {
  constructor(userId, side, amount, purpose, reference) {
    this.eventType = 'FundsReleased';
    this.userId = userId;
    this.side = side;
    this.amount = amount;
    this.purpose = purpose;
    this.reference = reference;
    this.occurredAt = new Date();
  }
}

export class ReservedFundsSpent {
  constructor(userId, side, amount, purpose, reference) {
    this.eventType = 'ReservedFundsSpent';
    this.userId = userId;
    this.side = side;
    this.amount = amount;
    this.purpose = purpose;
    this.reference = reference;
    this.occurredAt = new Date();
  }
}

// Domain errors
export class InsufficientFundsError extends Error {
  constructor(userId, side, available, requested) {
    super(`Insufficient funds: ${side} wallet has ${available.toString()} available, requested ${requested.toString()}`);
    this.name = 'InsufficientFundsError';
    this.userId = userId;
    this.side = side;
    this.available = available;
    this.requested = requested;
  }
}
