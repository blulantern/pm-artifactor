export interface AIResult {
  readonly output: unknown;
  readonly groundedOn: string[];
  readonly confidence: number;
}
export interface AIPort {
  run(task: string, input: unknown): Promise<AIResult>;
}
