/** Thrown by credential-store operations when the vault is locked or unconfigured. */
export class VaultLockedError extends Error {
  constructor(message = "vault is locked") {
    super(message);
    this.name = "VaultLockedError";
  }
}

/** Named secrets, encrypted at rest, usable only while the vault is unlocked. */
export interface CredentialStorePort {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  has(name: string): Promise<boolean>;
  remove(name: string): Promise<void>;
  names(): Promise<string[]>; // credential names only — never values
}
