import type { MethodologyKey } from "../shared/enums.js";
import type { MethodologyProfile } from "./methodology-profile.js";
import { ScrumProfile } from "./scrum-profile.js";
import { WaterfallProfile } from "./waterfall-profile.js";

export interface MethodologyRegistry {
  resolve(key: MethodologyKey): MethodologyProfile;
}

/** Registry map (Factory, D10) — deliberately NOT a switch. SAFe/DMAIC register when seeded. */
export class DefaultMethodologyRegistry implements MethodologyRegistry {
  private readonly factories = new Map<MethodologyKey, () => MethodologyProfile>([
    ["SCRUM", () => new ScrumProfile()],
    ["WATERFALL", () => new WaterfallProfile()],
  ]);

  register(key: MethodologyKey, make: () => MethodologyProfile): void {
    this.factories.set(key, make);
  }

  resolve(key: MethodologyKey): MethodologyProfile {
    const make = this.factories.get(key);
    if (!make) throw new Error(`No methodology profile registered for '${key}'`);
    return make();
  }
}
