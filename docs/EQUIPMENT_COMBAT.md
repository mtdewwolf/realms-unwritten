# Equipment and Combat Stats — First Vertical Slice

## Implemented
- Default virtual Worn Sword, equipped on all characters (no free inventory stack to exploit).
- Wolf Hunt quest turn-in grants exactly one Fangblade stack within the same SQLite transaction as the quest's one-time coins and XP.
- Fangblade is a weapon with +8 damage. The BAG panel displays the equipped weapon and offers switching to owned gear.
- Bun verifies Fangblade ownership and persists the chosen weapon in the SQLite equipment table. Clients cannot manufacture or equip an unowned weapon.
- Online wolf damage = **20 + floor((Strength−5)/2) + weapon bonus**, clamped to a safe integer interval in the combat simulation. Strength is derived from the character's server XP; at level 2 it is 7.
- Worn Sword at level 1: 20 damage. Fangblade at level 1: 28 damage. Fangblade at level 2: 29 damage.
- Damage values in a client attack message are discarded and never used.
- Protocol **v6**; both client and Bun server must be updated.

## Not yet implemented
- No armor or accessory slots, level requirements, durability, trading, item disposal, weapon visuals, armor-based damage reduction, or crafting.
- Vitality/Agility are display attributes only. Enemy health, loot and XP rules remain prototype values.
- SQLite guest characters still use bearer tokens without production-grade authentication.

## Testing
Run `bun run check`, `bun test`, `bun tools/smoke-server.ts`, and the Android CI APK build. On Android defeat the wolf three times after accepting Wolf Hunt, claim the reward, open BAG and equip Fangblade. Verify 29-damage hits at level 2, and that reconnecting restores the equipped sword. Fresh characters cannot equip Fangblade. Repeat quest turn-in attempts must not create extra swords. Use two separate guest devices to confirm consistent shared wolf HP.
