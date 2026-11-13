import {describe,expect,test} from "bun:test";
import {GAME_TABS,isGameTab,nextMenuView,type MenuView} from "../apps/client/src/ui/menuState";
describe("single-modal game menu state",()=>{
  test("menu opens, routes to tools, returns and closes",()=>{
    let state:MenuView="closed";
    state=nextMenuView(state,"toggle");expect(state).toBe("menu");
    state=nextMenuView(state,"bag");expect(state).toBe("bag");
    state=nextMenuView(state,"toggle");expect(state).toBe("menu");
    state=nextMenuView(state,"map");expect(state).toBe("map");
    state=nextMenuView(state,"close");expect(state).toBe("closed");
  });
  test("selecting an already open panel returns to menu",()=>{
    for(const tab of GAME_TABS){
      expect(nextMenuView(tab,tab)).toBe("menu");
      expect(nextMenuView("menu",tab)).toBe(tab);
    }
  });
  test("recognizes only registered tabs",()=>{
    expect(GAME_TABS).toHaveLength(5);
    expect(isGameTab("network")).toBe(true);
    expect(isGameTab("bag")).toBe(true);
    expect(isGameTab("inventory")).toBe(false);
  });
});
