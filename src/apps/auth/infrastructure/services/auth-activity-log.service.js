export class AuthActivityLogService {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async record(userId, activity) {
    try {
      await this.userRepository.appendActivity(userId, activity);
    } catch (error) {
      console.warn("Activity log failed:", error.message);
    }
  }
}
