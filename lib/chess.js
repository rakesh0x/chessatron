// Minimal chess.js-compatible implementation (FEN, move gen, legality, SAN).
// Supports full legal move generation incl. castling, en passant, promotion.
(function (root) {
'use strict';
const FILES='abcdefgh';
function sq(f,r){return r*8+f;}
function fr(s){return [s%8, Math.floor(s/8)];}
function alg(s){const[f,r]=fr(s);return FILES[f]+(r+1);}
function fromAlg(a){return sq(FILES.indexOf(a[0]), parseInt(a[1],10)-1);}
const KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const K8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const R4=[[1,0],[-1,0],[0,1],[0,-1]];
const B4=[[1,1],[1,-1],[-1,1],[-1,-1]];
class Chess {
  constructor(fen){ this.reset(); if(fen) this.load(fen); }
  reset(){ this.b=new Array(64).fill(null); this.turn='w'; this.castling={K:0,Q:0,k:0,q:0};
    this.ep=-1; this.half=0; this.full=1;
    const order=['r','n','b','q','k','b','n','r'];
    for(let f=0;f<8;f++){ this.b[sq(f,1)]={t:'p',c:'w'}; this.b[sq(f,6)]={t:'p',c:'b'};
      this.b[sq(f,0)]={t:order[f],c:'w'}; this.b[sq(f,7)]={t:order[f],c:'b'}; }
    this.castling={K:1,Q:1,k:1,q:1}; }
  load(fen){
    try{ const p=fen.trim().split(/\s+/); this.b=new Array(64).fill(null);
      const rows=p[0].split('/'); if(rows.length!==8) return false;
      for(let r=0;r<8;r++){ let f=0;
        for(const ch of rows[r]){ if(/\d/.test(ch)){ f+=+ch; }
          else { const c=ch===ch.toUpperCase()?'w':'b'; this.b[sq(f,7-r)]={t:ch.toLowerCase(),c}; f++; } } }
      this.turn=p[1]||'w';
      this.castling={K:0,Q:0,k:0,q:0};
      if(p[2]&&p[2]!=='-') for(const c of p[2]) if(c in this.castling) this.castling[c]=1;
      this.ep=(p[3]&&p[3]!=='-')?fromAlg(p[3]):-1;
      this.half=+(p[4]||0); this.full=+(p[5]||1); return true;
    }catch(e){ return false; }
  }
  fen(){ let rows=[];
    for(let r=7;r>=0;r--){ let s='',e=0;
      for(let f=0;f<8;f++){ const p=this.b[sq(f,r)];
        if(!p) e++; else { if(e){s+=e;e=0;} s+=p.c==='w'?p.t.toUpperCase():p.t; } }
      if(e)s+=e; rows.push(s); }
    let c=''; for(const k of['K','Q','k','q']) if(this.castling[k])c+=k; if(!c)c='-';
    return `${rows.join('/')} ${this.turn} ${c} ${this.ep>=0?alg(this.ep):'-'} ${this.half} ${this.full}`;
  }
  turnColor(){return this.turn;}
  _attacked(s,by){ const[f,r]=fr(s);
    const dir=by==='w'?1:-1;
    for(const df of[-1,1]){ const ff=f+df,rr=r-dir; if(ff>=0&&ff<8&&rr>=0&&rr<8){const p=this.b[sq(ff,rr)]; if(p&&p.c===by&&p.t==='p')return true;} }
    for(const[df,dr]of KN){const ff=f+df,rr=r+dr; if(ff<0||ff>7||rr<0||rr>7)continue; const p=this.b[sq(ff,rr)]; if(p&&p.c===by&&p.t==='n')return true;}
    for(const[df,dr]of K8){const ff=f+df,rr=r+dr; if(ff<0||ff>7||rr<0||rr>7)continue; const p=this.b[sq(ff,rr)]; if(p&&p.c===by&&p.t==='k')return true;}
    for(const[dirs,ts]of[[R4,['r','q']],[B4,['b','q']]]){ for(const[df,dr]of dirs){let ff=f+df,rr=r+dr;
      while(ff>=0&&ff<8&&rr>=0&&rr<8){const p=this.b[sq(ff,rr)]; if(p){if(p.c===by&&ts.includes(p.t))return true; break;} ff+=df;rr+=dr;}}}
    return false; }
  _king(c){ for(let i=0;i<64;i++){const p=this.b[i]; if(p&&p.c===c&&p.t==='k')return i;} return -1; }
  _pseudo(){ const ms=[]; const me=this.turn, op=me==='w'?'b':'w';
    for(let s=0;s<64;s++){ const p=this.b[s]; if(!p||p.c!==me)continue; const[f,r]=fr(s);
      const push=(from,to,flags,promo)=>ms.push({from,to,flags:flags||0,promo:promo||null,piece:p.t});
      if(p.t==='p'){ const d=me==='w'?1:-1, start=me==='w'?1:6, last=me==='w'?7:0;
        const one=sq(f,r+d);
        if(r+d>=0&&r+d<8&&!this.b[one]){ if(r+d===last){for(const pr of['q','r','b','n'])push(s,one,0,pr);} else {push(s,one);
          if(r===start){const two=sq(f,r+2*d); if(!this.b[two])push(s,two,1);} } }
        for(const df of[-1,1]){ const ff=f+df,rr=r+d; if(ff<0||ff>7||rr<0||rr>7)continue; const t=sq(ff,rr);
          const tp=this.b[t];
          if(tp&&tp.c===op){ if(rr===last){for(const pr of['q','r','b','n'])push(s,t,0,pr);} else push(s,t); }
          else if(t===this.ep) push(s,t,2); } }
      else if(p.t==='n'||p.t==='k'){ const ds=p.t==='n'?KN:K8;
        for(const[df,dr]of ds){const ff=f+df,rr=r+dr; if(ff<0||ff>7||rr<0||rr>7)continue; const t=sq(ff,rr);
          const tp=this.b[t]; if(!tp||tp.c===op)push(s,t);} }
      else { const ds=p.t==='r'?R4:p.t==='b'?B4:R4.concat(B4);
        for(const[df,dr]of ds){let ff=f+df,rr=r+dr;
          while(ff>=0&&ff<8&&rr>=0&&rr<8){const t=sq(ff,rr); const tp=this.b[t];
            if(!tp)push(s,t); else {if(tp.c===op)push(s,t); break;} ff+=df;rr+=dr;}} }
    }
    // castling
    const k=this._king(me); if(k>=0&&!this._attacked(k,op)){
      const home=me==='w'?0:7;
      const canK=me==='w'?this.castling.K:this.castling.k, canQ=me==='w'?this.castling.Q:this.castling.q;
      if(canK&&!this.b[sq(5,home)]&&!this.b[sq(6,home)]&&!this._attacked(sq(5,home),op)) ms.push({from:k,to:sq(6,home),flags:4,piece:'k'});
      if(canQ&&!this.b[sq(3,home)]&&!this.b[sq(2,home)]&&!this.b[sq(1,home)]===false){}
      if(canQ&&!this.b[sq(3,home)]&&!this.b[sq(2,home)]&&!this._attacked(sq(3,home),op)) ms.push({from:k,to:sq(2,home),flags:4,piece:'k'});
    }
    return ms; }
  _apply(m){ const undo={m,cap:null,ep:this.ep,cast:{...this.castling},half:this.half};
    const p=this.b[m.from]; undo.moved=p;
    if(m.flags===2){ const[f,r]=fr(m.to); const capSq=sq(f,r+(this.turn==='w'?-1:1)); undo.cap=this.b[capSq]; undo.capSq=capSq; this.b[capSq]=null; }
    else { undo.cap=this.b[m.to]; }
    this.b[m.to]=m.promo?{t:m.promo,c:p.c}:{t:p.t,c:p.c}; this.b[m.from]=null;
    if(m.flags===4){ const home=this.turn==='w'?0:7;
      if(m.to===sq(6,home)){ this.b[sq(5,home)]=this.b[sq(7,home)]; this.b[sq(7,home)]=null; }
      if(m.to===sq(2,home)){ this.b[sq(3,home)]=this.b[sq(0,home)]; this.b[sq(0,home)]=null; } }
    // update castling rights
    const kill=(sqx,key)=>{ if(m.from===sqx||m.to===sqx) this.castling[key]=0; };
    kill(sq(4,0),'K');kill(sq(4,0),'Q');kill(sq(7,0),'K');kill(sq(0,0),'Q');
    kill(sq(4,7),'k');kill(sq(4,7),'q');kill(sq(7,7),'k');kill(sq(0,7),'q');
    this.ep=m.flags===1?sq(fr(m.from)[0],(fr(m.from)[1]+fr(m.to)[1])/2):-1;
    this.half=(p.t==='p'||undo.cap)?0:this.half+1;
    if(this.turn==='b')this.full++;
    this.turn=this.turn==='w'?'b':'w';
    return undo; }
  _unapply(u){ const m=u.m;
    this.turn=this.turn==='w'?'b':'w';
    if(this.turn==='b')this.full--;
    this.castling=u.cast; this.ep=u.ep; this.half=u.half;
    const p=this.b[m.to]; this.b[m.from]=u.moved; this.b[m.to]=null;
    if(m.flags===2){ this.b[u.capSq]=u.cap; }
    else this.b[m.to]=u.cap;
    if(m.flags===4){ const home=this.turn==='w'?0:7;
      if(m.to===sq(6,home)){ this.b[sq(7,home)]=this.b[sq(5,home)]; this.b[sq(5,home)]=null; }
      if(m.to===sq(2,home)){ this.b[sq(0,home)]=this.b[sq(3,home)]; this.b[sq(3,home)]=null; } } }
  moves(o){ o=o||{}; const legal=this._legal(); if(o.verbose)return legal;
    return legal.map(m=>this._toSan(m,legal)); }
  _legal(){ const me=this.turn, op=me==='w'?'b':'w'; const out=[];
    for(const m of this._pseudo()){ const u=this._apply(m);
      const k=this._king(me); if(k>=0&&!this._attacked(k,op)) out.push(m);
      this._unapply(u); }
    return out; }
  _toSan(m,legal){ if(m.flags===4) return m.to%8===6?'O-O':'O-O-O';
    let s=''; const dest=alg(m.to);
    if(m.piece==='p'){ const cap=m.from%8!==m.to%8; if(cap)s+=FILES[m.from%8]+'x';
      s+=dest; if(m.promo)s+='='+m.promo.toUpperCase(); }
    else { s+=m.piece.toUpperCase().replace('N','N');
      const others=(legal||[]).filter(x=>x.piece===m.piece&&x.to===m.to&&x.from!==m.from);
      if(others.length){ const sameF=others.some(x=>x.from%8===m.from%8), sameR=others.some(x=>Math.floor(x.from/8)===Math.floor(m.from/8));
        if(!sameF)s+=FILES[m.from%8]; else if(!sameR)s+=(Math.floor(m.from/8)+1); else s+=alg(m.from); }
      const tp=this.b[m.to]; if(tp)s+='x'; s+=dest; }
    const u=this._apply(m); const op=this.turn; const k=this._king(op);
    // check / mate
    let check=false; if(k>=0){ const me=op==='w'?'b':'w';
      // attacked by side that just moved
      const save=this.turn; this.turn=me; const atk=this._attacked(k,me); this.turn=save; check=atk; }
    if(check){ s+='+'; const opp=this._legal().length===0 ? true : false; if(opp)s+='+'.slice(0,0),s=s.slice(0,-1)+'#'; }
    this._unapply(u); return s; }
  move(mv){ const legal=this._legal();
    let m=null;
    if(typeof mv==='string'){ const s=mv.replace(/[+#x=]/g,'');
      // try UCI
      if(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(mv)){ const f=fromAlg(mv.slice(0,2)),t=fromAlg(mv.slice(2,4));
        const pr=mv[4]||null; m=legal.find(x=>x.from===f&&x.to===t&&(x.promo||null)===pr)||null; }
      if(!m){ // SAN match
        for(const x of legal){ if(this._toSan(x,legal).replace(/[+#x=]/g,'')===s){m=x;break;} }
        if(!m) m=legal.find(x=>this._toSan(x,legal).replace(/[+#]/g,'')===mv)||null; } }
    else { m=legal.find(x=>x.from===mv.from&&x.to===mv.to)||null; }
    if(!m) return null;
    const san=this._toSan(m,legal); this._apply(m);
    return {from:alg(m.from),to:alg(m.to),san,promotion:m.promo||undefined,flags:m.flags}; }
  history(o){ return this._hist||[]; }
  // apply list of SAN/UCI for tracking
  applyMoves(list){ this._hist=[]; for(const mv of list){ const r=this.move(mv); if(!r)break; this._hist.push(r.san);} }
  // FEN piece placement -> 8x8 array helper for adapters
  static algToSq(a){return fromAlg(a);} static sqToAlg(s){return alg(s);}
}
root.Chess=Chess;
})(typeof self!=='undefined'?self:globalThis);
