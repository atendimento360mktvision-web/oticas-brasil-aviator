(function(){
  var KEY='ob_painel', k='';
  var h=location.hash.match(/k=([a-f0-9]+)/i);
  try{ if(h){ localStorage.setItem(KEY,h[1]); history.replaceState(null,'',location.pathname) } k=localStorage.getItem(KEY)||'' }catch(e){ if(h)k=h[1] }
  var app=document.getElementById('app'), login=document.getElementById('login'), T;
  function $(id){return document.getElementById(id)}
  function n(v){return (v||0).toLocaleString('pt-BR')}
  function rows(el,items,cls){
    var max=Math.max.apply(null,items.map(function(x){return x[1]}).concat([1]));
    el.innerHTML=items.map(function(x){return '<div class="row '+(x[2]||'')+'"><span>'+x[0]+'</span><div class="bar"><i style="width:'+(x[1]/max*100)+'%"></i></div><b>'+n(x[1])+'</b></div>'}).join('');
  }
  var NM={mg:'Âmbar',m1:'Esmeralda',mh:'Ametista',outro:'Outra'};
  function fmtDay(d){ var p=d.split('-'); return p[2]+'/'+p[1] }
  function render(d){
    var t=d.days[0]||{};
    $('kLive').textContent=n(d.live); $('kPeak').textContent=n(Math.max(t.peak||0,d.live));
    $('kUv').textContent=n(t.uv); $('kPv').textContent=n(t.pv)+' visualizações'; $('kSold').textContent=n(d.sold);
    rows($('intent'),[['Viram a página',t.uv||0],['Escolheram cor',(t.ev_cor_mg||0)+(t.ev_cor_m1||0)+(t.ev_cor_mh||0)],['Adicionaram ao carrinho',t.ev_cart||0],['Clicaram em comprar',t.ev_buy||0],['Chamaram no WhatsApp',t.ev_wa||0],['Abriram os stories',t.ev_story||0]]);
    rows($('colors'),[['Âmbar',t.ev_cor_mg||0,'c-mg'],['Esmeralda',t.ev_cor_m1||0,'c-m1'],['Ametista',t.ev_cor_mh||0,'c-mh']]);
    var sc=d.soldByColor||{};
    rows($('soldc'),[['Âmbar',sc.mg||0,'c-mg'],['Esmeralda',sc.m1||0,'c-m1'],['Ametista',sc.mh||0,'c-mh']]);
    $('sales').innerHTML=(d.sales||[]).slice(0,8).map(function(s){
      var cs=Object.keys(s.c||{}).map(function(c){return Math.abs(+s.c[c]||0)+'x '+(NM[c]||c)}).join(', ');
      var dt=new Date(s.at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
      return '<li'+(s.x?' class="x"':'')+'><span>Pedido '+esc(s.id)+' · '+esc(cs)+(s.x?' (cancelado)':'')+'</span><span>'+esc(dt)+'</span></li>'
    }).join('')||'<li class="empty">As vendas aparecem aqui assim que os pedidos forem pagos.</li>';
    var hs=d.hours||{}, max=1, nowH=new Date(Date.now()-3*3600e3).getUTCHours(), html='';
    for(var i=0;i<24;i++){ max=Math.max(max,hs[(i<10?'0':'')+i]||0) }
    for(i=0;i<24;i++){ var v=hs[(i<10?'0':'')+i]||0; html+='<div title="'+i+'h: '+v+' visitas" class="'+(i===nowH?'now':'')+'" style="height:'+(v/max*100)+'%"></div>' }
    $('hours').innerHTML=html;
    $('days').innerHTML=d.days.map(function(x){return '<tr><td>'+fmtDay(x.day)+'</td><td>'+n(x.uv)+'</td><td>'+n(x.pv)+'</td><td>'+n(x.peak)+'</td><td>'+n(x.ev_buy)+'</td><td>'+n(x.ev_cart)+'</td><td>'+n(x.ev_wa)+'</td></tr>'}).join('');
    var R={'sem-chave':'chave secreta ainda não configurada, venda não contada','assinatura-invalida':'assinatura inválida, venda não contada','nao-pago':'pedido ainda não pago','dup':'pedido já contado','no-launch-items':'pedido sem o Aviator','not-counted':'cancelamento de pedido que não estava contado','erro-interno':'erro ao gravar'};
    var hk=(d.hook||[])[0];
    $('hookSt').textContent=hk?('Última chamada da Yampi: '+new Date(hk.at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})+(hk.n?' · pedido '+hk.n:'')+' · '+(R[hk.r]||hk.r)):'A Yampi ainda não enviou nenhum pedido para o painel.';
    renderMap(d);
    $('upd').classList.remove('off');
    $('updT').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  // Mapa ao vivo
  var map, layerToday, layerOnline, fitted=false;
  function brl(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function esc(t){return String(t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function initMap(){
    if(map||!window.L)return;
    map=L.map('map',{zoomControl:false,attributionControl:true,scrollWheelZoom:false}).setView([-15.5,-52],4);
    L.control.zoom({position:'topright'}).addTo(map); map.attributionControl.setPrefix('Leaflet');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
    layerToday=L.layerGroup().addTo(map); layerOnline=L.layerGroup().addTo(map);
    map.on('click',function(){ map.scrollWheelZoom.enable() });
  }
  function renderMap(d){
    initMap();
    var t=d.days[0]||{};
    $('mLive').textContent=n(d.live); $('mCart').textContent=n(t.ev_cart); $('mBuy').textContent=n(t.ev_buy);
    var start=Date.parse(d.today+'T00:00:00-03:00'), q=0;
    (d.sales||[]).forEach(function(s){ if(s.at>=start) q+=s.q });
    q=Math.max(q,0); $('mSoldV').textContent=brl(q*1410); $('mSoldQ').textContent=(q===1?'1 par vendido':n(q)+' pares vendidos')+' hoje no lançamento';
    var on={}; (d.online||[]).forEach(function(c){ on[c.city+'|'+c.uf]=c.n });
    var list=(d.cities||[]).slice(); (d.online||[]).forEach(function(c){ if(!list.some(function(x){return x.city===c.city&&x.uf===c.uf})) list.push({city:c.city,uf:c.uf,cc:c.cc,lat:c.lat,lon:c.lon,n:0}) });
    list.sort(function(a,b){ return (on[b.city+'|'+b.uf]||0)-(on[a.city+'|'+a.uf]||0) || b.n-a.n });
    $('mCities').innerHTML=list.length?list.map(function(c){ var o=on[c.city+'|'+c.uf]; var uf=c.cc&&c.cc!=='BR'?c.cc:(c.uf||'·');
      return '<li><span class="uf">'+esc(uf)+'</span><span class="ct">'+esc(c.city)+'</span><span>'+(o?'<span class="on">● '+o+' agora</span>':'')+'<b>'+n(c.n)+'</b></span></li>' }).join(''):'<li><span></span><span class="sm">Os acessos aparecem aqui ao longo do dia.</span><span></span></li>';
    if(!map)return;
    layerToday.clearLayers(); layerOnline.clearLayers();
    var max=Math.max.apply(null,(d.cities||[]).map(function(c){return c.n}).concat([1])), pts=[];
    (d.cities||[]).forEach(function(c){ if(c.lat==null)return; if(c.cc==='BR')pts.push([c.lat,c.lon]);
      L.circleMarker([c.lat,c.lon],{radius:4+Math.sqrt(c.n/max)*14,color:'#241E33',weight:1,fillColor:'#241E33',fillOpacity:.28}).bindTooltip(esc(c.city)+(c.uf?' · '+esc(c.uf):'')+': '+n(c.n)+(c.n===1?' visitante hoje':' visitantes hoje')).addTo(layerToday) });
    (d.online||[]).forEach(function(c){ if(c.lat==null)return; if(c.cc==='BR')pts.push([c.lat,c.lon]); var sz=Math.min(16+c.n*3,40);
      L.marker([c.lat,c.lon],{icon:L.divIcon({className:'pin',html:'<b style="width:'+sz+'px;height:'+sz+'px"></b>'+(c.n>1?'<em>'+c.n+'</em>':''),iconSize:[0,0]}),zIndexOffset:1000})
       .bindTooltip(esc(c.city)+(c.uf?' · '+esc(c.uf):'')+': '+c.n+(c.n===1?' pessoa agora':' pessoas agora')).addTo(layerOnline) });
    if(!fitted&&pts.length>2){ fitted=true; map.fitBounds(pts,{paddingTopLeft:[innerWidth>860?320:40,60],paddingBottomRight:[60,60],maxZoom:6}) }
  }
  function load(){
    fetch('/api/stats',{headers:{'x-k':k},cache:'no-store'}).then(function(r){
      if(r.status===401){ app.hidden=true; login.hidden=false; $('lerr').hidden=!k; clearInterval(T); return null }
      return r.json();
    }).then(function(d){ if(!d)return; if(d.error)throw 0; login.hidden=true; app.hidden=false; render(d) })
    .catch(function(){ $('upd').classList.add('off'); $('updT').textContent='Sem conexão, tentando de novo…' });
  }
  function start(){ load(); clearInterval(T); T=setInterval(function(){ if(!document.hidden) load() },15000) }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) load() });
  $('lf').addEventListener('submit',function(e){ e.preventDefault(); k=$('lk').value.trim(); try{localStorage.setItem(KEY,k)}catch(err){} start() });
  if(k) start(); else login.hidden=false;
})();
