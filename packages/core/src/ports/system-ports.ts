export interface KeychainPort {
  get(ref: string): Promise<string | null>;
  set(ref: string, secret: string): Promise<void>;
}
export type Clock = () => Date;
