// Promotion aggregate — manages promotion lifecycle with state machine
// Lifecycle: accepted → downloaded → submitted → validated → paid (or rejected at any point)

const VALID_TRANSITIONS = {
  accepted: ['downloaded', 'rejected'],
  downloaded: ['submitted', 'rejected'],
  submitted: ['validated', 'rejected'],
  validated: ['paid', 'rejected'],
  paid: [],
  rejected: [],
};

export class Promotion {
  constructor({ id, campaignId, promoterId, status = 'accepted', isActive = true, upi = null }) {
    this.id = id;
    this.campaignId = campaignId;
    this.promoterId = promoterId;
    this._status = status;
    this._isActive = isActive;
    this.upi = upi;
    this._events = [];
  }

  get status() { return this._status; }
  get isActive() { return this._isActive; }
  get domainEvents() { return [...this._events]; }
  clearEvents() { this._events = []; }

  canTransitionTo(target) {
    return VALID_TRANSITIONS[this._status]?.includes(target) ?? false;
  }

  transition(target) {
    if (!this.canTransitionTo(target)) {
      throw new PromotionError(`Invalid transition: ${this._status} → ${target}`);
    }
    this._status = target;
    this._events.push(new PromotionStatusChanged(this.id, this.campaignId, this.promoterId, target));
    return this;
  }

  download() { return this.transition('downloaded'); }
  submit() { return this.transition('submitted'); }
  validate() { return this.transition('validated'); }
  pay() { return this.transition('paid'); }
  reject() { return this.transition('rejected'); }

  suspend() {
    if (!this._isActive) throw new PromotionError('Promotion is already suspended.');
    this._isActive = false;
    this._events.push(new PromotionSuspended(this.id));
    return this;
  }

  restore() {
    if (this._isActive) throw new PromotionError('Promotion is already active.');
    this._isActive = true;
    this._events.push(new PromotionRestored(this.id));
    return this;
  }
}

export class PromotionStatusChanged {
  constructor(promotionId, campaignId, promoterId, newStatus) {
    this.eventType = 'PromotionStatusChanged';
    this.promotionId = promotionId;
    this.campaignId = campaignId;
    this.promoterId = promoterId;
    this.newStatus = newStatus;
    this.occurredAt = new Date();
  }
}

export class PromotionSuspended {
  constructor(promotionId) { this.eventType = 'PromotionSuspended'; this.promotionId = promotionId; this.occurredAt = new Date(); }
}

export class PromotionRestored {
  constructor(promotionId) { this.eventType = 'PromotionRestored'; this.promotionId = promotionId; this.occurredAt = new Date(); }
}

export class PromotionError extends Error {
  constructor(message) { super(message); this.name = 'PromotionError'; }
}
