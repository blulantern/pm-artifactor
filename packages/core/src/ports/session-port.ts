export type SessionStatus = "unconfigured" | "locked" | "unlocked";

/** The app's lock/identity abstraction. Local now (process memory); a server session store later. */
export interface SessionPort {
  status(): Promise<SessionStatus>;
  configure(passphrase: string): Promise<void>; // first run: set the passphrase, create the vault
  unlock(passphrase: string): Promise<boolean>; // false on wrong passphrase; true unlocks
  lock(): Promise<void>; // "logout" — drop the in-memory key
}
