// Financial domain — Transaction aggregate for payment tracking

export class Transaction {
  constructor({ id, userId, type, amount, currency = 'NGN', status = 'pending', reference, metadata = {} }) {
    this.id = id;
    this.userId = userId;
    this._type = type; // 'deposit' | 'withdrawal' | 'transfer' | 'refund'
    this._amount = amount;
    this._currency = currency;
    this._status = status;
    this.reference = reference;
    this.metadata = metadata;
    this._events = [];
  }

  get type() { return this._type; }
  get amount() { return this._amount; }
  get currency() { return this._currency; }
  get status() { return this._status; }
  get domainEvents() { return [...this._events]; }
  clearEvents() { this._events = []; }

  markProcessing() {
    if (this._status !== 'pending') throw new FinancialError('Only pending transactions can be processed.');
    this._status = 'processing';
    return this;
  }

  markCompleted() {
    if (this._status !== 'processing') throw new FinancialError('Only processing transactions can be completed.');
    this._status = 'completed';
    this._events.push(new TransactionCompleted(this.id, this._type, this._amount));
    return this;
  }

  markFailed(reason) {
    if (this._status === 'completed') throw new FinancialError('Completed transactions cannot be marked failed.');
    this._status = 'failed';
    this._events.push(new TransactionFailed(this.id, this._type, this._amount, reason));
    return this;
  }

  markRefunded() {
    if (this._status !== 'completed') throw new FinancialError('Only completed transactions can be refunded.');
    this._status = 'refunded';
    this._events.push(new TransactionRefunded(this.id, this._type, this._amount));
    return this;
  }
}

export class TransactionCompleted {
  constructor(transactionId, type, amount) { this.eventType = 'TransactionCompleted'; this.transactionId = transactionId; this.type = type; this.amount = amount; this.occurredAt = new Date(); }
}
export class TransactionFailed {
  constructor(transactionId, type, amount, reason) { this.eventType = 'TransactionFailed'; this.transactionId = transactionId; this.type = type; this.amount = amount; this.reason = reason; this.occurredAt = new Date(); }
}
export class TransactionRefunded {
  constructor(transactionId, type, amount) { this.eventType = 'TransactionRefunded'; this.transactionId = transactionId; this.type = type; this.amount = amount; this.occurredAt = new Date(); }
}

export class FinancialError extends Error {
  constructor(message) { super(message); this.name = 'FinancialError'; }
}
