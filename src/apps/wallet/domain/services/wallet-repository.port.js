// Domain repository port — defines the contract for wallet persistence
export class WalletRepositoryPort {
  /** Load a wallet aggregate for a user + side. Returns null if not found. */
  async load(userId, side) { throw new Error('Not implemented'); }

  /** Persist wallet state changes. Must run within a provided session. */
  async save(wallet, session) { throw new Error('Not implemented'); }
}
