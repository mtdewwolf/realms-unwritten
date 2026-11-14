/** Retry only transient WebSocket transport failures, never policy/auth failures. */
export const MAX_RECONNECT_ATTEMPTS=6;
export const HELLO_TIMEOUT_MS=8000;
export function reconnectDelay(attempt:number):number{
  if(!Number.isSafeInteger(attempt)||attempt<1)return 0;
  return Math.min(12_000,500*2**Math.min(5,attempt-1));
}
export function shouldReconnect(closeCode:number,attempt:number,enabled:boolean):boolean{
  if(!enabled||attempt>=MAX_RECONNECT_ATTEMPTS)return false;
  // Normal, going-away, auth/policy, invalid packet and application-incompatible errors.
  return ![1000,1008,1009,1011,4001,4003,4004].includes(closeCode);
}
