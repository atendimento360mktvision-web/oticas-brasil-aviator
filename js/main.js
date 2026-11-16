(function(){
  var root=document.documentElement, hero=document.getElementById('hero');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var P='https://seguro.lancamentooculosnayma.com/r/';
  var data={
    mh:{url:P+'NVPX5ZAC4J:1',name:'Ametista',meta:'<b>Aro dourado</b> com lente âmbar · código 001/MG'},
    mg:{url:P+'P383GE83XH:1',name:'Âmbar',meta:'<b>Aro dourado</b> com lente âmbar · código 001/MG'},
    m1:{url:P+'PC3CFCG8KG:1',name:'Esmeralda',meta:'<b>Aro prata</b> com lente esmeralda · código 003/M1'}
  };
  var cur='mg';
  function $$(q){return [].slice.call(document.querySelectorAll(q))}
  function pick(k){
    if(k===cur)return;
    $$('[data-frames]').forEach(function(f){
      [].forEach.call(f.children,function(im){
        if(im.dataset.k===cur){im.classList.remove('on');im.classList.add('out')}
        else if(im.dataset.k===k){im.classList.remove('out');im.classList.add('on')}
        else im.classList.remove('on','out');
      });
    });
    var prev=cur; setTimeout(function(){$$('[data-frames] img').forEach(function(im){if(im.dataset.k!==cur)im.classList.remove('out')})},900);
    $$('.sw,.sw-mini button').forEach(function(s){s.setAttribute('aria-pressed',s.dataset.k===k)});
    $$('[data-meta]').forEach(function(m){m.innerHTML=data[k].meta});
    ['buyHero','buyClose','buyBar'].forEach(function(id){document.getElementById(id).href=data[k].url});
    document.querySelector('[data-buylabel]').textContent='Comprar '+data[k].name+' agora';
    document.querySelector('[data-barname]').textContent='Aviator '+data[k].name;
    hero.dataset.lens=k; root.dataset.lens=k; cur=k;
  }
  $$('.sw,.sw-mini button').forEach(function(s){s.addEventListener('click',function(){pick(s.dataset.k)})});

  requestAnimationFrame(function(){requestAnimationFrame(function(){hero.classList.add('ready')})});

  // ghost parallax
  var ghost=document.getElementById('ghost');
  if(!reduce&&matchMedia('(hover:hover) and (min-width:1024px)').matches){
    var tx=0,ty=0,x=0,y=0;
    hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*-36;ty=((e.clientY-r.top)/r.height-.5)*-20});
    hero.addEventListener('pointerleave',function(){tx=0;ty=0});
    (function loop(){x+=(tx-x)*.08;y+=(ty-y)*.08;ghost.style.transform='translate(calc(-50% + '+x.toFixed(2)+'px),calc(-50% + '+y.toFixed(2)+'px))';requestAnimationFrame(loop)})();
  }

  // carousel
  var reel=document.getElementById('reel'), slides=$$('.slide'), dots=$$('.dots button'), active=0, inView=false;
  function play(v){var p=v.play(); if(p&&p.catch)p.catch(function(){})}
  function setActive(i,scroll){
    i=(i+slides.length)%slides.length; active=i;
    slides.forEach(function(s,j){
      var v=s.querySelector('video'); s.classList.toggle('active',j===i);
      if(j===i){v.currentTime=0; if(inView)play(v)} else v.pause();
    });
    dots.forEach(function(d,j){d.setAttribute('aria-current',j===i)});
    if(scroll){var s=slides[i]; reel.scrollTo({left:s.offsetLeft-(reel.clientWidth-s.offsetWidth)/2,behavior:reduce?'auto':'smooth'})}
  }
  slides.forEach(function(s,j){
    s.querySelector('video').addEventListener('ended',function(){ if(j===active){ var v=this; if(v._rep){v._rep=0; setActive(active+1,true)} else {v._rep=1; v.currentTime=0; play(v)} } });
    s.addEventListener('click',function(e){ if(j!==active&&!e.target.closest('a')){e.preventDefault(); setActive(j,true)} });
  });
  dots.forEach(function(d,j){d.addEventListener('click',function(){setActive(j,true)})});
  $$('.rbtn').forEach(function(b){b.addEventListener('click',function(){setActive(active+(+b.dataset.dir),true)})});
  var st; reel.addEventListener('scroll',function(){clearTimeout(st); st=setTimeout(function(){
    var c=reel.scrollLeft+reel.clientWidth/2, best=0, bd=1e9;
    slides.forEach(function(s,j){var m=s.offsetLeft+s.offsetWidth/2, d=Math.abs(m-c); if(d<bd){bd=d;best=j}});
    if(best!==active)setActive(best,false);
  },120)},{passive:true});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){es.forEach(function(e){inView=e.isIntersecting; var v=slides[active].querySelector('video'); if(inView)play(v); else v.pause()})},{threshold:.35}).observe(reel);
  }

  // stories
  var S=[{src:'vid/st-ambar.mp4',k:'mg',label:'Âmbar'},{src:'vid/st-esmeralda.mp4',k:'m1',label:'Esmeralda'},{src:'vid/st-ametista.mp4',k:'mh',label:'Ametista'}];
  var pre={}; function prefetch(i){ if(i<0||i>=S.length||pre[i])return; pre[i]=1; var l=document.createElement('link'); l.rel='prefetch'; l.as='video'; l.href=S[i].src; document.head.appendChild(l) }
  addEventListener('load',function(){ setTimeout(function(){prefetch(0)},1200) });
  $$('.story').forEach(function(b){ ['pointerenter','touchstart','focus'].forEach(function(ev){ b.addEventListener(ev,function(){prefetch(+b.dataset.s)},{passive:true}) }) });
  var viewer=document.getElementById('viewer'), vv=document.getElementById('vvideo'), bars=$$('.vbars b'), si=0, raf, lastFocus;
  var held=false;
  function tick(){ var d=vv.duration; if(d&&isFinite(d)){ bars[si].style.width=Math.min(100,vv.currentTime/d*100)+'%' } raf=requestAnimationFrame(tick) }
  function show(i){
    si=i; var s=S[i], d=data[s.k];
    vv.poster=s.src.replace('.mp4','.jpg'); vv.src=s.src; vv.currentTime=0; play(vv);
    viewer.querySelector('[data-vlabel]').textContent=s.label;
    viewer.querySelector('[data-vtitle]').textContent='Aviator '+d.name;
    document.getElementById('vbuy').href=d.url;
    bars.forEach(function(b,j){b.style.width=j<i?'100%':'0%'});
    $$('.story')[i].classList.add('seen');
    prefetch(i+1);
    cancelAnimationFrame(raf); raf=requestAnimationFrame(tick);
  }
  vv.addEventListener('ended',function(){ if(viewer.classList.contains('open')) go(si+1) });
  var card=viewer.querySelector('.vcard');
  card.addEventListener('pointerdown',function(e){ if(e.target.closest('a,.vclose'))return; held=true; vv.pause() });
  ['pointerup','pointercancel','pointerleave'].forEach(function(ev){ card.addEventListener(ev,function(){ if(held){ held=false; play(vv) } }) });
  function go(i){ if(i<0)i=0; if(i>=S.length){close();return} show(i) }
  function open(i){ lastFocus=document.activeElement; viewer.classList.add('open'); document.body.style.overflow='hidden'; show(i); document.getElementById('vclose').focus() }
  function close(){ cancelAnimationFrame(raf); viewer.classList.remove('open'); vv.pause(); vv.removeAttribute('src'); vv.load(); document.body.style.overflow=''; if(lastFocus)lastFocus.focus() }
  $$('.story').forEach(function(b){b.addEventListener('click',function(){open(+b.dataset.s)})});
  $$('[data-v]').forEach(function(b){b.addEventListener('click',function(){go(si+(+b.dataset.v))})});
  document.getElementById('vclose').addEventListener('click',close);
  viewer.addEventListener('click',function(e){if(e.target===viewer)close()});
  addEventListener('keydown',function(e){ if(!viewer.classList.contains('open'))return; if(e.key==='Escape')close(); if(e.key==='ArrowRight')go(si+1); if(e.key==='ArrowLeft')go(si-1) });


  // cart
  var CODES={mh:'NVPX5ZAC4J',mg:'P383GE83XH',m1:'PC3CFCG8KG'}, PRICE=1410;
  var META={mh:{img:'001mh',cw:'#EFEBF4',c:'#CEC6DE',f:'var(--gold)',cd:'Aro dourado · 001/MH'},mg:{img:'001mg',cw:'#F4EFE1',c:'#DFD8BC',f:'var(--gold)',cd:'Aro dourado · 001/MG'},m1:{img:'003m1',cw:'#E8EFEE',c:'#CCDAD9',f:'var(--silver)',cd:'Aro prata · 003/M1'}};
  var ORDER=['mg','m1','mh'], cart={mh:0,mg:0,m1:0};
  try{var saved=JSON.parse(localStorage.getItem('ob_cart')||'null'); if(saved)ORDER.forEach(function(k){cart[k]=Math.max(0,Math.min(10,saved[k]|0))})}catch(e){}
  function save(){try{localStorage.setItem('ob_cart',JSON.stringify(cart))}catch(e){}}
  function brl(n){return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
  var cartEl=document.getElementById('cart'), ov=document.getElementById('cartOverlay'), list=document.getElementById('cartItems'), chips=document.getElementById('cartChips'), lastF;
  function renderCart(bump){
    var n=0; list.innerHTML='';
    ORDER.forEach(function(k){ var q=cart[k]; if(!q)return; n+=q; var m=META[k], d=data[k];
      var li=document.createElement('li');
      li.innerHTML='<span class="th" style="--cw:'+m.cw+'"><img src="img/'+m.img+'.webp" alt=""></span><div><div class="nm">Aviator '+d.name+'</div><div class="cd">'+m.cd+'</div><div class="ln"><span class="qty"><button type="button" data-q="-1" data-k="'+k+'" aria-label="Diminuir quantidade de '+d.name+'">−</button><span aria-live="polite">'+q+'</span><button type="button" data-q="1" data-k="'+k+'" aria-label="Aumentar quantidade de '+d.name+'">+</button></span><span class="pr">'+brl(q*PRICE)+'</span></div></div>';
      list.appendChild(li);
    });
    chips.innerHTML='';
    ORDER.forEach(function(k){ var m=META[k], d=data[k]; var b=document.createElement('button'); b.type='button'; b.className='chip'; b.dataset.addchip=k; b.style.setProperty('--c',m.c); b.style.setProperty('--f',m.f); b.innerHTML='<i></i>'+d.name+' <b>+</b>'; b.setAttribute('aria-label','Adicionar '+d.name+' ao carrinho'); chips.appendChild(b); });
    document.getElementById('cartEmpty').style.display=n?'none':'block';
    document.getElementById('cartMoreLabel').textContent=n?'Adicionar mais uma cor ou unidade':'Cores do lançamento';
    var tot=n*PRICE; document.getElementById('cartTotal').textContent=brl(tot);
    document.getElementById('cartInst').textContent=n?'ou 10x de '+brl(tot/10)+' sem juros':'Adicione uma cor para continuar';
    var go=document.getElementById('cartGo'), parts=ORDER.filter(function(k){return cart[k]}).map(function(k){return CODES[k]+':'+cart[k]});
    if(parts.length){go.href=P+parts.join(','); go.removeAttribute('aria-disabled')} else {go.href='#'; go.setAttribute('aria-disabled','true')}
    $$('[data-count]').forEach(function(b){ b.textContent=n; b.hidden=!n; if(bump&&n){b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump')} });
  }
  function openCart(){ lastF=document.activeElement; ov.hidden=false; requestAnimationFrame(function(){ov.classList.add('on')}); cartEl.classList.add('open'); cartEl.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; setTimeout(function(){cartEl.querySelector('.cart-x').focus()},50) }
  function closeCart(){ ov.classList.remove('on'); cartEl.classList.remove('open'); cartEl.setAttribute('aria-hidden','true'); document.body.style.overflow=''; setTimeout(function(){ov.hidden=true},300); if(lastF&&lastF.focus)lastF.focus() }
  function addCart(k){ cart[k]=Math.min(10,(cart[k]||0)+1); save(); renderCart(true); openCart() }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-add],[data-addchip],[data-q],[data-opencart],[data-closecart]'); if(!t)return;
    if(t.dataset.add){ e.preventDefault(); addCart(t.dataset.add) }
    else if(t.dataset.addchip){ cart[t.dataset.addchip]=Math.min(10,cart[t.dataset.addchip]+1); save(); renderCart(true) }
    else if(t.dataset.q){ var k=t.dataset.k; cart[k]=Math.max(0,Math.min(10,cart[k]+(+t.dataset.q))); save(); renderCart(true) }
    else if(t.hasAttribute('data-opencart')){ renderCart(); openCart() }
    else if(t.hasAttribute('data-closecart')){ closeCart() }
  });
  ov.addEventListener('click',closeCart);
  addEventListener('keydown',function(e){ if(e.key==='Escape'&&cartEl.classList.contains('open'))closeCart() });
  renderCart();

  // Meta Pixel: eventos de venda
  var SKU={mh:'RB3791-001MH',mg:'RB3791-001MG',m1:'RB3791-003M1'};
  function px(ev,params){ try{ if(window.fbq) fbq('track',ev,params) }catch(e){} }
  function contents(map){ return ORDER.filter(function(k){return map[k]}).map(function(k){return {id:SKU[k],quantity:map[k]}}) }
  function evParams(map){ var c=contents(map), n=c.reduce(function(a,b){return a+b.quantity},0); return {content_ids:c.map(function(x){return x.id}),contents:c,content_type:'product',content_name:'Ray-Ban Aviator RB3791',num_items:n,value:n*PRICE,currency:'BRL'} }
  px('ViewContent',{content_ids:[SKU.mh,SKU.mg,SKU.m1],content_type:'product',content_name:'Ray-Ban Aviator RB3791',value:PRICE,currency:'BRL'});
  var _addCart=addCart; addCart=function(k){ k=(k==='current'?cur:k); var m={}; m[k]=1; px('AddToCart',evParams(m)); _addCart(k) };
  document.addEventListener('click',function(e){
    var ch=e.target.closest('[data-addchip]'); if(ch){ var m={}; m[ch.dataset.addchip]=1; px('AddToCart',evParams(m)); return }
    var a=e.target.closest('a[href*="seguro.lancamentooculosnayma.com/r/"]'); if(!a)return;
    var map={}; a.getAttribute('href').split('/r/')[1].split(',').forEach(function(p){ var q=p.split(':'); ORDER.forEach(function(k){ if(CODES[k]===q[0]) map[k]=(+q[1]||1) }) });
    px('InitiateCheckout',evParams(map));
  },true);

  // WhatsApp: fechar venda
  var WA_NUM='5562985823369';
  function waUrl(t){ return 'https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(t) }
  function waOne(k){ var d=data[k], m=META[k]; return 'Olá! Vim pela página do lançamento e quero comprar o Ray-Ban Aviator RB3791 na cor '+d.name+' ('+m.cd.split('· ')[1]+'), no valor de R$ 1.410,00. Pode me ajudar a finalizar o pedido?' }
  function waCart(){ var n=0, lines=ORDER.filter(function(k){return cart[k]}).map(function(k){ n+=cart[k]; return '• '+cart[k]+'x Ray-Ban Aviator RB3791 '+data[k].name+' ('+META[k].cd.split('· ')[1]+')' });
    return 'Olá! Vim pela página do lançamento e quero fechar meu pedido:\n'+lines.join('\n')+'\nTotal: '+brl(n*PRICE)+'\nPode me ajudar a finalizar a compra?' }
  function updateWa(){
    $$('[data-wa="current"]').forEach(function(a){ a.href=waUrl(waOne(cur)) });
    var c=document.getElementById('cartWa'), has=ORDER.some(function(k){return cart[k]});
    c.href=has?waUrl(waCart()):'#'; if(has)c.removeAttribute('aria-disabled'); else c.setAttribute('aria-disabled','true');
  }
  var _render=renderCart; renderCart=function(b){ _render(b); updateWa() };
  var _pick=pick; pick=function(k){ _pick(k); updateWa() };
  $$('.sw,.sw-mini button').forEach(function(sw){ sw.addEventListener('click',function(){ updateWa() }) });
  document.addEventListener('click',function(e){ var a=e.target.closest('.wa-sale'); if(!a)return; try{ if(window.fbq) fbq('track','Contact',{content_name:'Ray-Ban Aviator RB3791',currency:'BRL'}) }catch(err){} },true);
  updateWa();

  // Ao vivo: pessoas na página agora (número real) e pares vendidos (pedidos pagos na Yampi)
  var LIVE_MIN=3, SOLD_MIN=3, vid;
  try{ vid=localStorage.getItem('ob_vid'); if(!vid){ vid=(Date.now().toString(36)+Math.random().toString(36).slice(2,12)).replace(/[^a-z0-9]/g,''); localStorage.setItem('ob_vid',vid) } }catch(e){ vid=(Date.now().toString(36)+Math.random().toString(36).slice(2,12)) }
  function api(body){ return fetch('/api/live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}) }
  function track(e){ try{ api({v:vid,t:'ev',e:e}).catch(function(){}) }catch(err){} }
  function plural(n,a,b){ return n+' '+(n===1?a:b) }
  function showLive(d){
    var l=d.live||0, s=d.sold||0, okL=l>=LIVE_MIN, okS=s>=SOLD_MIN;
    $$('[data-live]').forEach(function(box){
      box.querySelector('[data-live-n]').textContent=plural(l,'pessoa','pessoas');
      box.querySelector('[data-sold-n]').textContent=plural(s,'par','pares');
      box.querySelector('[data-live-on]').hidden=!okL;
      box.querySelector('[data-sold-on]').hidden=!okS;
      box.querySelector('[data-live-sep]').hidden=!(okL&&okS);
      if(okL||okS){ if(box.hidden){ box.hidden=false; requestAnimationFrame(function(){box.classList.add('on')}) } }
      else { box.classList.remove('on'); box.hidden=true }
    });
  }
  var hbT, live0=location.protocol.indexOf('http')===0;
  function beat(t){ if(!live0)return; api({v:vid,t:t}).then(function(r){return r.json()}).then(showLive).catch(function(){}) }
  function loop(){ clearInterval(hbT); hbT=setInterval(function(){ if(!document.hidden) beat('hb') },30000) }
  beat('pv'); loop();
  document.addEventListener('visibilitychange',function(){ if(!document.hidden){ beat('hb'); loop() } });
  // eventos para o painel
  document.addEventListener('click',function(e){
    var t=e.target;
    var sw=t.closest('.sw,.sw-mini button'); if(sw&&sw.dataset.k){ track('cor_'+sw.dataset.k); return }
    if(t.closest('[data-add],[data-addchip]')){ track('cart'); return }
    if(t.closest('a[href*="seguro.lancamentooculosnayma.com/r/"]')){ track('buy'); return }
    if(t.closest('.wa-sale,#cartWa')){ track('wa'); return }
    if(t.closest('.story')){ track('story'); return }
  },true);

  // reveals
  var rv=$$('.rv');
  if('IntersectionObserver' in window&&!reduce){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15,rootMargin:'0px 0px -6% 0px'});
    rv.forEach(function(el){io.observe(el)});
  } else rv.forEach(function(el){el.classList.add('in')});
  setTimeout(function(){rv.forEach(function(el){var r=el.getBoundingClientRect();if(r.top<innerHeight)el.classList.add('in')})},2500);

  // nav + buy bar
  var nav=document.getElementById('nav'), bar=document.getElementById('buybar'), closeSec=document.getElementById('comprar');
  function onScroll(){
    var y=scrollY; nav.classList.toggle('scrolled',y>40);
    var c=closeSec.getBoundingClientRect().top;
    bar.classList.toggle('show',y>innerHeight*.75&&c>innerHeight*.6);
  }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();
})();
