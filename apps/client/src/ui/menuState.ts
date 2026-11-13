export const GAME_TABS=["map","bag","quest","hero","network"] as const;
export type GameTab=typeof GAME_TABS[number];
export type MenuView="closed"|"menu"|GameTab;
export function nextMenuView(current:MenuView,action:"toggle"|"close"|GameTab):MenuView{
  if(action==="close")return "closed";
  if(action==="toggle")return current==="menu"?"closed":"menu";
  return current===action?"menu":action;
}
export function isGameTab(value:string):value is GameTab{
  return GAME_TABS.some(x=>x===value);
}
