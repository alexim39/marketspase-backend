export class CollaborationReviewGateway {
  isValidObjectId(_value) {
    throw new Error('CollaborationReviewGateway.isValidObjectId must be implemented');
  }

  async getReviewEligibility(_query = {}) {
    throw new Error('CollaborationReviewGateway.getReviewEligibility must be implemented');
  }

  async listReceivedReviews(_query = {}) {
    throw new Error('CollaborationReviewGateway.listReceivedReviews must be implemented');
  }

  async listGivenReviews(_query = {}) {
    throw new Error('CollaborationReviewGateway.listGivenReviews must be implemented');
  }

  async listAdminReviews(_query = {}) {
    throw new Error('CollaborationReviewGateway.listAdminReviews must be implemented');
  }

  async createReview(_command = {}) {
    throw new Error('CollaborationReviewGateway.createReview must be implemented');
  }

  async getReviewById(_reviewId) {
    throw new Error('CollaborationReviewGateway.getReviewById must be implemented');
  }

  async recomputeCollaborationRating(_userId) {
    throw new Error('CollaborationReviewGateway.recomputeCollaborationRating must be implemented');
  }

  async notifyReviewReceived(_userId, _review) {
    throw new Error('CollaborationReviewGateway.notifyReviewReceived must be implemented');
  }

  async findReviewForFlag(_reviewId) {
    throw new Error('CollaborationReviewGateway.findReviewForFlag must be implemented');
  }

  async flagReview(_command = {}) {
    throw new Error('CollaborationReviewGateway.flagReview must be implemented');
  }

  async getAdminNotificationRecipients() {
    throw new Error('CollaborationReviewGateway.getAdminNotificationRecipients must be implemented');
  }

  async notifyReviewFlagged(_adminId, _review, _reason) {
    throw new Error('CollaborationReviewGateway.notifyReviewFlagged must be implemented');
  }

  async findReviewById(_reviewId) {
    throw new Error('CollaborationReviewGateway.findReviewById must be implemented');
  }

  async updateReviewModeration(_command = {}) {
    throw new Error('CollaborationReviewGateway.updateReviewModeration must be implemented');
  }
}
