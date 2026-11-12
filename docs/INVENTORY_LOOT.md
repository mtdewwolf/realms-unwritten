# Inventory and Wolf Rewards — v1

When the shared Bun wolf dies, each still-connected player who successfully damaged it receives one Wolf Pelt, one Wolf Fang, and five coins. Bystanders do not receive loot. The client cannot forge awards or quantities.

## Persistence
- New SQLite tables: inventory_stacks, wallets, reward_receipts.
- Each kill has a UUID event ID, avoiding collisions after restart.
- For each eligible character a single database transaction inserts a unique event/character receipt and increments item stacks and coins. Retrying the same event is ignored.
- Inventory is sent on login, on explicit client request, and after successful grants. Existing guest tokens and DBs remain compatible.

## Not implemented
No item capacity, gear, ground pickups, trading, crafting, XP or quests. Offline wolf combat never grants server items. Only the shared starter wolf yields rewards. The server process and guest authentication remain prototypes.

## Manual QA
With two distinct online guests, both hit and kill the wolf, then open BAG: both receive items. A bystander receives none. Disconnect and reconnect, and restart Bun: balances should survive. Run the automated SQLite idempotency test. Do not delete a real database during QA.
