export class GetActivePromoDto {
  constructor({ role = 'marketer' } = {}) {
    this.role = role || 'marketer';
  }

  static fromRequest() {
    return new GetActivePromoDto({
      role: 'marketer',
    });
  }
}
