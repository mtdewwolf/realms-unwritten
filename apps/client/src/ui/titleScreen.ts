export type AuthMode="account_register"|"account_login";
export interface LoginRequest{mode:AuthMode;username:string;password:string}
export class TitleScreen{
 readonly element:HTMLElement;
 readonly url:HTMLInputElement;
 private readonly status:HTMLElement;
 private pending:LoginRequest|null=null;
 constructor(host:HTMLElement,private readonly connect:(url:string,mode:"account"|"guest",freshAuth:boolean)=>void,private readonly sendAuth:(req:LoginRequest)=>boolean,private readonly offline:()=>void){
  const el=document.createElement("section");
  el.id="realm-title";el.setAttribute("aria-label","Realms Unwritten account and character selection");
  el.innerHTML=[
   '<div class="realm-atmosphere" aria-hidden="true"><div class="realm-moon"></div><div class="realm-spire spire-one"></div><div class="realm-spire spire-two"></div><div class="realm-spire spire-three"></div><div class="realm-ridge"></div></div>',
   '<div class="realm-title-inner"><div class="realm-crest">✦</div><p class="realm-overline">AN ORIGINAL FANTASY WORLD</p>',
   '<h1>REALMS<em>UNWRITTEN</em></h1><p class="realm-tagline">Two kingdoms. Four bloodlines. One unwritten fate.</p>',
   '<section class="realm-auth-card" aria-label="Account entry"><h2>Enter the Realm</h2>',
   '<p class="realm-description">Create an account or sign in to return to your hero. The realm server must be running to create an online character.</p>',
   '<label for="realm-server-url">Realm server</label><input id="realm-server-url" spellcheck="false" autocomplete="url" placeholder="wss://your-server.example/ws"/>',
   '<button id="realm-connect" type="button" class="realm-secondary">CONNECT TO REALM</button>',
   '<div class="realm-auth-fields"><label for="realm-username">Account name</label><input id="realm-username" autocomplete="username" maxlength="24" placeholder="3–24 characters"/>',
   '<label for="realm-password">Password</label><input id="realm-password" type="password" autocomplete="current-password" placeholder="At least 10 characters"/>',
   '<div class="realm-auth-actions"><button id="realm-register" type="button">CREATE ACCOUNT</button><button id="realm-login" type="button" class="realm-secondary">SIGN IN</button></div></div>',
   '<p id="realm-login-status" role="status" aria-live="polite">Choose a realm server to begin.</p>',
   '<div class="realm-alt-actions"><button id="realm-guest" type="button">CONTINUE LEGACY GUEST</button><button id="realm-offline" type="button">OFFLINE DEMO</button></div></section>',
   '<p class="realm-disclaimer">Prototype accounts · No email recovery yet · Use a unique password. Plain ws:// is for trusted local development only.</p></div>'
  ].join("");
  host.appendChild(el);this.element=el;
  this.url=el.querySelector<HTMLInputElement>("#realm-server-url")!;
  this.status=el.querySelector<HTMLElement>("#realm-login-status")!;
  const username=el.querySelector<HTMLInputElement>("#realm-username")!;
  const password=el.querySelector<HTMLInputElement>("#realm-password")!;
  el.querySelector("#realm-connect")!.addEventListener("click",()=>{this.pending=null;this.begin("account");});
  for(const [selector,mode] of [["#realm-register","account_register"],["#realm-login","account_login"]] as const){
   el.querySelector(selector)!.addEventListener("click",()=>{
    if(!/^[a-zA-Z][a-zA-Z0-9_-]{2,23}$/.test(username.value)||password.value.length<10||password.value.length>128){
      this.message("Use a 3–24 character account name and a password of at least 10 characters.");return;
    }
    this.pending={mode,username:username.value,password:password.value};
    this.begin("account");
   });
  }
  el.querySelector("#realm-guest")!.addEventListener("click",()=>{this.pending=null;this.begin("guest");});
  el.querySelector("#realm-offline")!.addEventListener("click",()=>{this.pending=null;this.hide();this.offline();});
  try{this.url.value=localStorage.getItem("realms-unwritten-server-url")??"";}catch{/* no storage */}
 }
 private begin(mode:"account"|"guest"):void{
  const value=this.url.value.trim();
  if(!/^wss?:\/\/\S+$/i.test(value)){this.message("Enter the full ws:// or wss:// realm URL.");return;}
  this.message("Connecting to realm…");
  try{localStorage.setItem("realms-unwritten-server-url",value);}catch{/* storage unavailable */}
  this.connect(value,mode,!!this.pending);
 }
 authRequired():void{
  if(!this.pending){this.message("Connected. Create an account or sign in.");return;}
  const request=this.pending;this.pending=null;
  if(!this.sendAuth(request))this.message("Connection unavailable. Connect again.");
  else this.message(request.mode==="account_register"?"Creating your account…":"Signing in…");
 }
 message(value:string):void{this.status.textContent=value;}
 show():void{this.element.hidden=false;}
 hide():void{this.element.hidden=true;}
 get visible():boolean{return !this.element.hidden;}
}
