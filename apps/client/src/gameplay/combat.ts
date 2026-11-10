export const PLAYER_MAX_STAMINA = 100;
export const WOLF_MAX_HEALTH = 60;
export const ATTACK_STAMINA = 16;
export const DODGE_STAMINA = 26;
export const ATTACK_RANGE = 3.25;
export function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
export function regenerateStamina(current: number, dt: number): number {
  return Math.min(PLAYER_MAX_STAMINA, Math.max(0, current + 18 * Math.max(0, dt)));
}
export function withinAttackRange(ax: number, az: number, bx: number, bz: number): boolean {
  return (ax-bx)**2+(az-bz)**2 <= ATTACK_RANGE**2;
}
export function useStamina(current: number, cost: number): number | null {
  return current >= cost ? current - cost : null;
}
