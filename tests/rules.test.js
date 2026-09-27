const {test}=require('node:test');const assert=require('node:assert/strict');const D=require('../rules.js');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function H(str){const used=new Map();return [...str.replace(/\s/g,'')].map(ch=>{const r={T:10,J:11,Q:12,K:13,A:14,'2':15,s:16,b:17}[ch]||Number(ch),n=used.get(r)||0;used.set(r,n+1);if(r===16)return 52;if(r===17)return 53;return (r-3)*4+n;});}
function assertConserved(g){const all=g.players.flatMap(p=>p.hand).concat(g.played.flatMap(m=>m.cards));if(g.landlord==null)all.push(...g.kitty);assert.equal(all.length,54);assert.equal(new Set(all).size,54);assert.deepEqual(all.slice().sort((a,b)=>a-b),Array.from({length:54},(_,i)=>i));}
const signature=m=>[m.type,m.main,m.chain,m.count].join(':');
test('one deck 54, deal 17 each and three bottom cards',()=>{const g=new D.Game({random:rng(1)});assert.deepEqual(g.players.map(p=>p.hand.length),[17,17,17]);assert.equal(g.kitty.length,3);assertConserved(g);});
test('recognizes all fourteen supported card types',()=>{for(const [str,type] of Object.entries({'3':'single','33':'pair','333':'triple','3334':'tripleSingle','33344':'triplePair','34567':'straight','334455':'pairStraight','333444':'airplane','33344456':'airplaneSingle','3334445566':'airplanePair','333345':'fourSingle','33334455':'fourPair','3333':'bomb','sb':'rocket'}))assert.equal(D.classify(H(str))?.type,type,str);});
test('rejects malformed combinations, short sequences, duplicates and illegal wings',()=>{for(const str of ['3456','3344','JQKA2','QQQKKKAAA222','33344455','3333sb','333444sb','3334444567','333344'])assert.equal(D.classify(H(str)),null,str);assert.equal(D.classify([0,0]),null);assert.equal(D.classify([54]),null);assert.equal(D.classify([]),null);});
test('all straights stop at A, wings may include 2 but cannot reuse main ranks',()=>{assert.equal(D.classify(H('TJQKA')).main,14);assert.equal(D.classify(H('3334442s')).type,'airplaneSingle');assert.equal(D.classify(H('33344422AA')).type,'airplanePair');assert.equal(D.classify(H('333444555678')).chain,3);});
test('same type/count required; compare main rank, not kickers or suit',()=>{
  assert.equal(D.beats(D.classify(H('4443')),D.classify(H('3332'))),true);
  assert.equal(D.beats(D.classify(H('45678')),D.classify(H('345678'))),false);
  assert.equal(D.beats(D.classify(H('44455567')),D.classify(H('33344422AA'))),false);
  assert.equal(D.beats(D.classify([1]),D.classify([0])),false);
  assert.equal(D.beats(D.classify(H('2')),D.classify(H('A'))),true);
});
test('bomb beats all ordinary types, larger bomb wins, rocket highest; four-with-two is ordinary',()=>{
  const bomb=D.classify(H('3333')),rocket=D.classify(H('sb'));
  assert.equal(D.beats(bomb,D.classify(H('222'))),true);assert.equal(D.beats(D.classify(H('4444')),bomb),true);assert.equal(D.beats(rocket,bomb),true);assert.equal(D.beats(bomb,rocket),false);assert.equal(D.beats(rocket,rocket),false);assert.equal(D.beats(D.classify(H('AAAA34')),bomb),false);
});
test('auction requires higher score; 3 ends immediately; landlord gets all three bottom cards',()=>{
  const g=new D.Game({random:rng(2)}),bottom=g.kitty.slice();assert.equal(g.bid(2),true);assert.equal(g.bid(1),false);assert.equal(g.bid(2),false);assert.equal(g.bid(3),true);assert.equal(g.landlord,1);assert.equal(g.phase,'play');assert.equal(g.turn,1);assert.equal(g.highBid,3);assert.equal(g.players[1].hand.length,20);assert.ok(bottom.every(id=>g.players[1].hand.includes(id)));assertConserved(g);
});
test('three passes redeal, rotate starter, retain round and table totals',()=>{const g=new D.Game({random:rng(3),totals:[2,-1,-1]});const old=g.players[0].hand.join(',');g.bid(0);g.bid(0);g.bid(0);assert.equal(g.phase,'bid');assert.equal(g.redeals,1);assert.equal(g.turn,1);assert.equal(g.round,1);assert.deepEqual(g.totals,[2,-1,-1]);assert.notEqual(g.players[0].hand.join(','),old);assertConserved(g);});
test('new leader cannot pass; two consecutive passes reset trick and permit a new type',()=>{
  const g=new D.Game({random:rng(4)});g.bid(3);assert.equal(g.pass(),false);const id=g.players[0].hand.at(-1);assert.equal(g.play([id]),true);assert.equal(g.pass(),true);assert.equal(g.pass(),true);assert.equal(g.turn,0);assert.equal(g.target,null);assert.equal(g.pass(),false);assertConserved(g);
});
test('invalid/out-of-hand play is rejected without mutating state',()=>{const g=new D.Game({random:rng(5)});g.bid(3);const hand=g.players[0].hand.slice(),alien=g.players[1].hand[0];assert.equal(g.play([alien]),false);assert.equal(g.play([hand[0],hand[0]]),false);assert.equal(g.play([]),false);assert.deepEqual(g.players[0].hand,hand);});
test('bomb and rocket each double, four-with-two does not',()=>{const g=new D.Game();g.bid(3);g.players[0].hand=H('3333sb4');g.players[1].hand=H('5555');g.players[2].hand=H('678');assert.equal(g.play(H('3333')),true);assert.equal(g.multiplier,2);g.pass();g.pass();assert.equal(g.play(H('sb')),true);assert.equal(g.multiplier,4);assert.equal(g.bombs,2);const other=new D.Game();other.bid(3);other.players[0].hand=H('3333456');other.play(H('333345'));assert.equal(other.multiplier,1);});
test('landlord spring, farmer anti-spring, and zero-sum scoring including both farmers',()=>{
  const g=new D.Game();g.bid(3);g.players[0].hand=H('3');g.players[1].hand=H('4');g.players[2].hand=H('5');g.play(H('3'));assert.equal(g.spring,'春天');assert.equal(g.multiplier,2);assert.deepEqual(g.players.map(p=>p.delta),[12,-6,-6]);
  const f=new D.Game();f.bid(2);f.bid(0);f.bid(0);f.players[0].hand=H('35');f.players[1].hand=H('4');f.players[2].hand=H('6');f.play(H('3'));f.play(H('4'));assert.equal(f.spring,'反春天');assert.deepEqual(f.players.map(p=>p.delta),[-8,4,4]);assert.equal(f.winner,1);
});
test('AI passes on farmer teammate lead unless able to finish, without examining hidden ranks',()=>{
  const g=new D.Game({random:rng(6)});g.bid(3);g.turn=1;g.leader=2;g.target=D.classify(H('3'));g.players[1].hand=H('456');assert.equal(D.chooseMove(g,1),null);g.players[1].hand=H('4');assert.deepEqual(D.chooseMove(g,1).cards,H('4'));
  const h=new D.Game({random:rng(7)});h.bid(3);const move=D.chooseMove(h,0);h.players[1].hand.fill(0);h.players[2].hand.fill(53);assert.deepEqual(D.chooseMove(h,0)?.cards,move.cards);
});
test('move generator contains every legal shape in small hands (brute-force oracle)',()=>{
  for(let seed=1;seed<=15;seed++){
    const hand=D.shuffle(rng(seed)).slice(0,10),generated=new Set(D.moves(hand).map(signature));
    for(let mask=1;mask<(1<<hand.length);mask++){const subset=hand.filter((_,i)=>mask&(1<<i)),c=D.classify(subset);if(c)assert.ok(generated.has(signature(c)),seed+':'+subset.map(D.label).join(','));}
    for(const m of D.moves(hand))assert.deepEqual(signature(m),signature(D.classify(m.cards)));
  }
});
test('AI delay is independently sampled inside 500–1500 ms',()=>{const random=rng(10),ds=Array.from({length:100},()=>D.delay(random));assert.ok(ds.every(n=>n>=500&&n<=1500));assert.ok(new Set(ds).size>80);});
test('100 full AI games terminate with legal moves, 54-card conservation and zero-sum totals',()=>{
  for(let seed=1;seed<=100;seed++){
    const g=new D.Game({random:rng(seed),starter:seed%3});let turns=0;assertConserved(g);
    while(g.phase!=='ended'&&turns++<600){if(g.phase==='bid')assert.equal(g.bid(D.chooseBid(g)),true);else{const m=D.chooseMove(g);assert.equal(m?g.play(m.cards):g.pass(),true);}assertConserved(g);}
    assert.equal(g.phase,'ended','seed '+seed);assert.equal(g.players.reduce((n,p)=>n+p.delta,0),0);assert.equal(g.totals.reduce((n,v)=>n+v,0),0);assert.equal(g.players[g.winner].hand.length,0);
  }
});
