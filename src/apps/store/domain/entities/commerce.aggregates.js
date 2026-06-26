// Domain entities and aggregates for Store commerce context

// Store aggregate — manages store lifecycle and verification
export class Store {
  constructor({ id, ownerId, name, storeLink, status = 'pending', isActive = true }) {
    this.id = id;
    this.ownerId = ownerId;
    this.name = name;
    this.storeLink = storeLink;
    this._status = status;
    this._isActive = isActive;
    this._events = [];
  }

  get status() { return this._status; }
  get isActive() { return this._isActive; }
  get domainEvents() { return [...this._events]; }
  clearEvents() { this._events = []; }

  activate() {
    if (this._status === 'active') throw new StoreError('Store is already active.');
    this._status = 'active';
    this._isActive = true;
    this._events.push(new StoreActivated(this.id, this.name));
    return this;
  }

  suspend(reason) {
    if (!this._isActive) throw new StoreError('Store is already suspended.');
    this._isActive = false;
    this._events.push(new StoreSuspended(this.id, this.name, reason));
    return this;
  }

  restore() {
    if (this._isActive) throw new StoreError('Store is already active.');
    this._isActive = true;
    this._events.push(new StoreRestored(this.id, this.name));
    return this;
  }

  verify() {
    if (this._status === 'verified') throw new StoreError('Store is already verified.');
    this._status = 'verified';
    this._events.push(new StoreVerified(this.id, this.name));
    return this;
  }
}

// Product aggregate — manages product lifecycle and pricing
export class Product {
  constructor({ id, storeId, name, price, currency = 'NGN', status = 'active' }) {
    this.id = id;
    this.storeId = storeId;
    this.name = name;
    this._price = price;
    this._currency = currency;
    this._status = status;
    this._events = [];
  }

  get price() { return this._price; }
  get status() { return this._status; }
  get domainEvents() { return [...this._events]; }
  clearEvents() { this._events = []; }

  updatePrice(newPrice) {
    if (newPrice <= 0) throw new StoreError('Price must be greater than zero.');
    const oldPrice = this._price;
    this._price = newPrice;
    this._events.push(new ProductPriceChanged(this.id, this.name, oldPrice, newPrice));
    return this;
  }

  deactivate() {
    if (this._status === 'inactive') throw new StoreError('Product is already inactive.');
    this._status = 'inactive';
    this._events.push(new ProductDeactivated(this.id, this.name));
    return this;
  }

  activate() {
    if (this._status === 'active') throw new StoreError('Product is already active.');
    this._status = 'active';
    this._events.push(new ProductActivated(this.id, this.name));
    return this;
  }
}

// Domain events
export class StoreActivated {
  constructor(storeId, name) { this.eventType = 'StoreActivated'; this.storeId = storeId; this.name = name; this.occurredAt = new Date(); }
}
export class StoreSuspended {
  constructor(storeId, name, reason) { this.eventType = 'StoreSuspended'; this.storeId = storeId; this.name = name; this.reason = reason; this.occurredAt = new Date(); }
}
export class StoreRestored {
  constructor(storeId, name) { this.eventType = 'StoreRestored'; this.storeId = storeId; this.name = name; this.occurredAt = new Date(); }
}
export class StoreVerified {
  constructor(storeId, name) { this.eventType = 'StoreVerified'; this.storeId = storeId; this.name = name; this.occurredAt = new Date(); }
}
export class ProductPriceChanged {
  constructor(productId, name, oldPrice, newPrice) { this.eventType = 'ProductPriceChanged'; this.productId = productId; this.name = name; this.oldPrice = oldPrice; this.newPrice = newPrice; this.occurredAt = new Date(); }
}
export class ProductDeactivated {
  constructor(productId, name) { this.eventType = 'ProductDeactivated'; this.productId = productId; this.name = name; this.occurredAt = new Date(); }
}
export class ProductActivated {
  constructor(productId, name) { this.eventType = 'ProductActivated'; this.productId = productId; this.name = name; this.occurredAt = new Date(); }
}

export class StoreError extends Error {
  constructor(message) { super(message); this.name = 'StoreError'; }
}
