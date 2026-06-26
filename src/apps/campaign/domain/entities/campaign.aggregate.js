// Campaign aggregate — manages campaign lifecycle with budget validation
const VALID_TRANSITIONS = {
  pending: ['active', 'rejected', 'draft'],
  draft: ['pending', 'active'],
  active: ['paused', 'completed', 'exhausted'],
  paused: ['active', 'completed'],
  completed: [],
  rejected: [],
  exhausted: ['active'],
};

export class Campaign {
  constructor({ id, ownerId, title, status = 'pending', budget = 0, spentBudget = 0, promotionGoal = 'awareness' }) {
    this.id = id;
    this.ownerId = ownerId;
    this.title = title;
    this._status = status;
    this._budget = budget;
    this._spentBudget = spentBudget;
    this._promotionGoal = promotionGoal;
    this._events = [];
  }

  get status() { return this._status; }
  get budget() { return this._budget; }
  get spentBudget() { return this._spentBudget; }
  get remainingBudget() { return this._budget - this._spentBudget; }
  get promotionGoal() { return this._promotionGoal; }
  get domainEvents() { return [...this._events]; }
  clearEvents() { this._events = []; }

  canTransitionTo(target) { return VALID_TRANSITIONS[this._status]?.includes(target) ?? false; }

  transition(target) {
    if (!this.canTransitionTo(target)) throw new CampaignError(`Invalid transition: ${this._status} → ${target}`);
    this._status = target;
    this._events.push(new CampaignStatusChanged(this.id, this.title, target));
    return this;
  }

  activate() { return this.transition('active'); }
  pause() { return this.transition('paused'); }
  complete() { return this.transition('completed'); }
  reject() { return this.transition('rejected'); }

  spend(amount) {
    if (amount <= 0) throw new CampaignError('Spend amount must be positive.');
    if (this._spentBudget + amount > this._budget) throw new CampaignBudgetExceededError(this.id, this._budget, this._spentBudget + amount);
    this._spentBudget += amount;
    if (this._spentBudget >= this._budget) this._status = 'exhausted';
    this._events.push(new CampaignSpendRecorded(this.id, amount, this._spentBudget));
    return this;
  }

  topUp(additionalBudget) {
    if (additionalBudget <= 0) throw new CampaignError('Top-up amount must be positive.');
    this._budget += additionalBudget;
    if (this._status === 'exhausted') this._status = 'active';
    this._events.push(new CampaignBudgetToppedUp(this.id, additionalBudget, this._budget));
    return this;
  }
}

export class CampaignStatusChanged {
  constructor(campaignId, title, newStatus) { this.eventType = 'CampaignStatusChanged'; this.campaignId = campaignId; this.title = title; this.newStatus = newStatus; this.occurredAt = new Date(); }
}
export class CampaignSpendRecorded {
  constructor(campaignId, amount, totalSpent) { this.eventType = 'CampaignSpendRecorded'; this.campaignId = campaignId; this.amount = amount; this.totalSpent = totalSpent; this.occurredAt = new Date(); }
}
export class CampaignBudgetToppedUp {
  constructor(campaignId, amount, newBudget) { this.eventType = 'CampaignBudgetToppedUp'; this.campaignId = campaignId; this.amount = amount; this.newBudget = newBudget; this.occurredAt = new Date(); }
}

export class CampaignError extends Error {
  constructor(message) { super(message); this.name = 'CampaignError'; }
}
export class CampaignBudgetExceededError extends CampaignError {
  constructor(campaignId, budget, attempted) { super(`Campaign ${campaignId} budget exceeded: ${attempted} > ${budget}`); this.name = 'CampaignBudgetExceededError'; }
}
