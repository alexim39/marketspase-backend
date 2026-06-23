// In-memory presence tracker for online users.
// Tracks which users are connected via Socket.IO and their last heartbeat time.

const ONLINE_TIMEOUT_MS = 75_000; // 75s — user considered offline after missing 2 heartbeats (30s interval)

class PresenceTracker {
  #users = new Map(); // userId -> { socketCount, lastHeartbeat, user }

  /**
   * Called when a socket authenticates. Increments connection count.
   */
  userConnected(userId, user) {
    const entry = this.#users.get(userId) || { socketCount: 0, lastHeartbeat: Date.now(), user };
    entry.socketCount += 1;
    entry.lastHeartbeat = Date.now();
    if (user) entry.user = user;
    this.#users.set(userId, entry);
  }

  /**
   * Called when a socket disconnects. Decrements connection count.
   * Returns true if user is now completely offline.
   */
  userDisconnected(userId) {
    const entry = this.#users.get(userId);
    if (!entry) return false;
    entry.socketCount = Math.max(0, entry.socketCount - 1);
    if (entry.socketCount <= 0) {
      this.#users.delete(userId);
      return true; // fully offline
    }
    return false;
  }

  /**
   * Updates the heartbeat timestamp for a user.
   */
  heartbeat(userId) {
    const entry = this.#users.get(userId);
    if (entry) {
      entry.lastHeartbeat = Date.now();
    }
  }

  /**
   * Returns whether a user is considered online based on heartbeat recency.
   */
  isOnline(userId) {
    const entry = this.#users.get(userId);
    if (!entry) return false;
    return Date.now() - entry.lastHeartbeat < ONLINE_TIMEOUT_MS;
  }

  /**
   * Returns the user data for a connected user (for broadcasting presence info).
   */
  getOnlineUser(userId) {
    const entry = this.#users.get(userId);
    if (!entry || !this.isOnline(userId)) return null;
    return entry.user || { _id: userId };
  }

  /**
   * Returns all currently online user IDs.
   */
  getOnlineUserIds() {
    const ids = [];
    for (const [userId] of this.#users) {
      if (this.isOnline(userId)) {
        ids.push(userId);
      }
    }
    return ids;
  }
}

// Singleton instance shared across the app
export const presenceTracker = new PresenceTracker();
