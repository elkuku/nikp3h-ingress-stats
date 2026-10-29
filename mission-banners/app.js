const M=window.MISSIONS, B=window.BANNERS, done=new Map(M.done.banners.map(d=>[d.id,d]));
// The banner numbers shown: the oldest banner (last rows of the screenshot) is #1; single missions get none.
// data.js counts i from 0, newest first. ORDER sorts by number, with single missions between their neighbours.
const NO=new Map(), ORDER=new Map();
for(let i=B.length-1,n=0;i>=0;i--){if(!B[i].single)NO.set(i,++n);ORDER.set(i,B[i].single?n+.5:n)}
const no=i=>NO.get(i);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dur=m=>m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`;
const CAT={
  done:['Done','On the medal list and the Bannergress done list.'],
  doneonly:['Done list only','On the Bannergress done list, but no medal was matched to it.'],
  disabled:['All disabled','All missions are disabled on Bannergress and it is not on the done list.'],
  likely:['Uncertain match','The medal list matched it only as "likely".'],
  missing:['Not marked done','Matched and not all missions disabled, but not on the done list.'],
  nobg:['Not on Bannergress','No Bannergress banner was found for these medals.'],
  single:['Single missions','Single missions, not a banner (single: true in data.js).'],
};

// Similar Bannergress titles for different medals: one of them may be a wrong match.
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\batacames\b/g,'').replace(/\s+/g,' ').trim();
const similar={};
B.filter(b=>b.id).forEach(b=>(similar[norm(b.title)]??=[]).push(b.i));

const items=B.map(b=>{
  const d=b.id?done.get(b.id):null, r=b.rows.split(',').map(x=>x.split('-').map(Number));
  const cat=b.single?'single':d?'done':!b.id?'nobg':b.disabled&&b.disabled>=b.missions?'disabled':b.status==='likely'?'likely':'missing';
  const notes=[];
  if(b.count<b.missions) notes.push(`Fewer medals (${b.count}) than missions (${b.missions})${d?', but on the done list':''}.`);
  if(b.disabled&&b.disabled<b.missions) notes.push(`${b.disabled} of ${b.missions} missions disabled.`);
  if(b.offline) notes.push(`Offline: ${b.offline}`);
  if(b.warning) notes.push(`Warning: ${b.warning}`);
  // b.checked: the match was checked by hand (picture, mission titles), so no warning
  const sim=b.checked?[]:(similar[norm(b.title)]||[]).filter(i=>i!==b.i);
  if(b.id&&sim.length) notes.push(`Similar Bannergress title as ${sim.map(i=>'#'+no(i)).join(', ')}: check the match.`);
  const note=M.notes[b.id||'medal:'+b.name]; if(note) notes.push(note);
  return {key:'b'+b.i,i:b.i,name:b.name,img:b.img,rows:r,count:b.count,status:b.status,score:b.score,id:b.id,title:b.title?.trim(),addr:b.addr,
    missions:b.missions,disabled:b.disabled||0,order:b.order,km:b.km,dur:b.dur,lat:b.lat,lng:b.lng,event:b.event,desc:b.desc,
    pos:d?.pos??null,doneAt:d?.doneAt??null,cat,notes};
});
// Done list only: numbered D1, D2, … in done list order (changes when the done list does)
M.done.banners.filter(d=>!B.some(b=>b.id===d.id)).forEach((d,n)=>items.push({key:'d'+d.pos,i:null,no:'D'+(n+1),name:null,img:null,rows:null,count:null,status:null,score:null,
  id:d.id,title:d.title,addr:null,missions:d.missions,disabled:null,order:null,km:null,dur:null,lat:d.lat,lng:d.lng,event:null,desc:null,
  pos:d.pos,doneAt:d.doneAt,picture:d.picture,cat:'doneonly',notes:M.notes[d.id]?[M.notes[d.id]]:[]}));

const byKey=new Map(items.map(it=>[it.key,it]));
const counts={};items.forEach(it=>counts[it.cat]=(counts[it.cat]||0)+1);
// The Ingress SpecOps medal (unique missions completed) the mission count has reached
const SPECOPS=[[500,'black','Onyx'],[200,'platinum','Platinum'],[100,'gold','Gold'],[25,'silver','Silver'],[5,'bronze','Bronze']];
// and, as in AgentTools, "X n" when the onyx value was reached n times (from 2)
const missionCount=B.reduce((a,b)=>a+b.count,0), specops=SPECOPS.find(([n])=>missionCount>=n);
const onyx=Math.floor(missionCount/SPECOPS[0][0]);
document.getElementById('stats').innerHTML=[[B.filter(b=>!b.single).length,'banners'],[missionCount,'missions']]
  .map(([n,l])=>`<div><b>${n.toLocaleString()}</b><small>${l}</small></div>`).join('')
  +(specops?`<img class="medal" src="medals/specops-${specops[1]}.webp" width="150" height="150" alt="SpecOps ${specops[2]}" title="SpecOps ${specops[2]}: ${specops[0]}+ missions${onyx>1?` (${onyx} × ${SPECOPS[0][0]})`:''}">${onyx>1?`<b class="medal-count">X ${onyx}</b>`:''}`:'');

// Screenshot with a box per banner
const shotIn=document.getElementById('shotIn'), H=M.shot.h;
shotIn.innerHTML=M.shot.tiles.map(t=>`<img src="${t.src}" width="540" height="${t.h}" alt="" loading="lazy">`).join('')+
  items.filter(it=>it.rows).flatMap(it=>it.rows.map(r=>{
    const top=M.rows[r[0]][0]-5, bottom=M.rows[r[r.length-1]][1]+5;
    return `<button type="button" class="mark c-${it.cat}" data-k="${it.key}" style="top:${top/H*100}%;height:${(bottom-top)/H*100}%" title="${no(it.i)?'#'+no(it.i)+' ':''}${esc(it.title||it.name)} · ${CAT[it.cat][0]}">${no(it.i)?`<span>#${no(it.i)}</span>`:''}</button>`;
  })).join('');
shotIn.firstElementChild.alt='Screenshot of the mission medals in Ingress';

// The number of missions: orange when medals are missing or missions are disabled; the tooltip says how many
const missions=it=>it.count!=null&&it.count<it.missions?`<span class="warn">${it.count} / ${it.missions}</span>`
  :it.disabled?`<span class="warn" title="${it.disabled} of ${it.missions} disabled">${it.missions}</span>`:it.missions;
// Table (the numbers shown count down from the newest banner, see no())
const COLS=[
  ['i','#','n',it=>`<span class="num">${it.no??no(it.i)??''}</span>`],
  ['missions','Missions','n',it=>it.missions!=null?missions(it):''],
  // Without a medal (done list only), the Bannergress picture. The medal pictures are 330 px wide and 55 px per row;
  // their size is set so that the table keeps its height while they load (scrolling to a row lands right).
  [null,'Medals','',it=>it.img?`<img class="medals" src="${it.img}" width="330" height="${55*it.rows.reduce((n,[a,b])=>n+(b??a)-a+1,0)}" alt="" loading="lazy">`
    :it.picture?`<img class="medals" src="https://api.bannergress.com${encodeURI(it.picture)}" alt="" loading="lazy" title="Bannergress picture">`:'<span class="muted">no medal</span>'],
  ['cat','Analysis','',it=>`<span class="pill">${CAT[it.cat][0]}</span>`],
  // Without a medal (done list only), the Bannergress title, greyed out
  ['name','Ingress medal','',it=>it.name?`<div class="t">${esc(it.name)}</div>`:it.title?`<div class="t muted" title="Bannergress title">${esc(it.title)}</div>`:'<span class="muted">–</span>'],
  // The place, with a link to the start point on Google Maps under it
  ['addr','Place','',it=>`<div class="place">${esc(it.addr??'')}${it.lat!=null?`<span class="map-link"><a href="https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lng}" target="_blank" rel="noopener" title="${it.lat.toFixed(5)}, ${it.lng.toFixed(5)}">Map ↗</a></span>`:''}</div>`],
  ['event','Event','',it=>it.event?esc(it.event.filter(Boolean).filter((v,k,a)=>a.indexOf(v)===k).join(' – ')):''],
  [null,'','nw',it=>`<button type="button" class="more-btn" aria-expanded="${expanded.has(it.key)}" aria-controls="m-${it.key}">Details</button>`],
];
// The details row: the Bannergress facts, the analysis notes and the Bannergress description
const FACTS=[
  ['Bannergress',it=>it.id?`<a href="https://bannergress.com/banner/${encodeURIComponent(it.id)}" target="_blank" rel="noopener" title="${esc(it.title)}">Bannergress ↗</a>`:'<span class="muted">not found</span>'],
  ['Length',it=>it.km!=null?it.km+' km':''],
  ['Duration',it=>it.dur?dur(it.dur):''],
];
const expanded=new Set();
const facts=it=>FACTS.map(([l,f])=>[l,f(it)]).filter(([,v])=>v!=='').map(([l,v])=>`<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');
const more=it=>`<tr class="more c-${it.cat}" id="m-${it.key}"${expanded.has(it.key)?'':' hidden'}><td colspan="${COLS.length}"><div class="more-in">`+
  `<dl class="facts">${facts(it)}</dl>`+
  (it.notes.length?`<div class="note"><h3>Analysis</h3>${it.notes.map(n=>`<p class="${it.cat==='done'?'':'warn'}">${esc(n)}</p>`).join('')}</div>`:'')+
  (it.desc?`<div><h3>Description</h3><div class="desc">${esc(it.desc)}</div></div>`:'')+'</div></td></tr>';
const head=document.getElementById('head');
head.innerHTML=COLS.map(([k,l,c])=>`<th class="${c}"${k?` data-k="${k}" aria-sort="none"`:''}>${k?`<button type="button">${l}</button>`:l}</th>`).join('');
let sort={k:'i',dir:-1}, filter='all', sel=null;
const CATORDER=Object.keys(CAT);
// By number: done list only rows (no number) after the banners, in done list order
const val=(it,k)=>k==='cat'?CATORDER.indexOf(it.cat):k==='i'?(it.i!=null?ORDER.get(it.i):-it.pos):it[k];

function render(){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const shown=items.filter(it=>(filter==='all'||it.cat===filter)&&(!q||[it.no,it.name,it.title,it.id,it.addr,it.desc,...it.notes].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=>{const x=val(a,sort.k),y=val(b,sort.k);
      if(x==null||x==='') return 1; if(y==null||y==='') return -1;
      return (typeof x==='string'?x.localeCompare(y):x-y)*sort.dir||(a.i??999)-(b.i??999)});
  document.getElementById('count').textContent=`${shown.length} of ${items.length}`;
  document.getElementById('body').innerHTML=shown.map(it=>`<tr id="r-${it.key}" class="c-${it.cat}${it.key===sel?' sel':''}" data-k="${it.key}">${COLS.map(([,,c,f])=>`<td class="${c}">${f(it)}</td>`).join('')}</tr>${more(it)}`).join('');
  head.querySelectorAll('th[data-k]').forEach(th=>th.setAttribute('aria-sort',th.dataset.k===sort.k?(sort.dir>0?'ascending':'descending'):'none'));
  const vis=new Set(shown.map(it=>it.key));
  shotIn.querySelectorAll('.mark').forEach(m=>m.style.opacity=vis.has(m.dataset.k)?'':'.25');
  for(const [k,m] of markers) vis.has(k)?dots.addLayer(m):dots.removeLayer(m);
}
head.addEventListener('click',e=>{const th=e.target.closest('th[data-k]');if(!th)return;
  sort=sort.k===th.dataset.k?{k:sort.k,dir:-sort.dir}:{k:th.dataset.k,dir:1};render()});

const chips=document.getElementById('chips');
// Filters without banners are hidden
chips.innerHTML=[['all','All',items.length],...CATORDER.filter(c=>counts[c]).map(c=>[c,CAT[c][0],counts[c]])]
  .map(([c,l,n])=>`<button class="chip c-${c}" type="button" data-f="${c}" aria-pressed="${c==='all'}"${CAT[c]?` title="${esc(CAT[c][1])}"`:''}>${l}<i>${n}</i></button>`).join('');
chips.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;filter=b.dataset.f;
  chips.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c===b));render()});
document.getElementById('q').addEventListener('input',render);

const smooth=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
function select(key,from){
  sel=key;
  document.querySelectorAll('tr.sel,.mark.sel').forEach(x=>x.classList.remove('sel'));
  let row=document.getElementById('r-'+key);
  if(!row&&from==='shot'){filter='all';document.getElementById('q').value='';chips.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.f==='all'));render();row=document.getElementById('r-'+key)}
  row?.classList.add('sel');
  const marks=shotIn.querySelectorAll(`.mark[data-k="${key}"]`), mark=marks[0];
  marks.forEach(m=>m.classList.add('sel'));
  if(from==='shot'&&row){const sc=document.getElementById('scroller');
    // The table can't scroll past its end, so rows near the end stay lower down
    const top=Math.max(0,Math.min(row.offsetTop-sc.querySelector('thead').offsetHeight-8,sc.scrollHeight-sc.clientHeight));
    sc.scrollTo({top,behavior:smooth()});
    // Scroll the page too when the row would end up below the window (the map is above the table) or under the header
    const y=sc.getBoundingClientRect().top+row.offsetTop-top, hh=document.querySelector('.top').offsetHeight;
    const by=y+row.offsetHeight+16>innerHeight?y+row.offsetHeight+16-innerHeight:y<hh+8?y-hh-8:0;
    if(by) window.scrollBy({top:by,behavior:smooth()})}
  const dot=markers.get(key);
  if(dot){if(!dots.hasLayer(dot))dots.addLayer(dot);map.setView(dot.getLatLng(),Math.max(map.getZoom(),12));dot.openPopup()}
  if(from==='table'&&mark){const sh=document.getElementById('shot');
    sh.scrollTo({top:mark.offsetTop-40,behavior:smooth()})}
}
// Map of the start points, colored like the analysis
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const DOT={done:'--enl',doneonly:'--res',disabled:'--warn',likely:'--warn',missing:'--none',nobg:'--none',single:'--muted'};
const map=L.map('map',{preferCanvas:true,worldCopyJump:true,maxZoom:16,minZoom:2,zoomSnap:.5});
map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution('Banners: Bannergress');
map.createPane('base').style.zIndex=150;
// Esri's dark canvas works without an API key and also from a file:// page.
const esri='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
for(const t of [
  L.tileLayer(esri+'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,maxNativeZoom:16,attribution:'Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors'}),
  L.tileLayer(esri+'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,maxNativeZoom:16})
]){
  t.addTo(map);
  // A tile server sometimes drops a request; retry each failed tile a few times.
  t.on('tileerror',({tile,coords})=>{
    const n=+(tile.dataset.retry||0);
    if(n>=3) return;
    tile.dataset.retry=n+1;
    setTimeout(()=>{tile.src=t.getTileUrl(coords)+'?retry='+(n+1)},1500*(n+1));
  });
}
const world=window.WORLD;
L.geoJSON(topojson.feature(world,world.objects.countries),{pane:'base',interactive:false,style:{color:css('--border'),weight:.8,fillColor:css('--land'),fillOpacity:1}}).addTo(map);
const dots=L.layerGroup().addTo(map), markers=new Map();
const placed=items.filter(it=>it.lat!=null);
for(const it of placed){
  const c=css(DOT[it.cat]);
  markers.set(it.key,L.circleMarker([it.lat,it.lng],{radius:Math.min(11,4+Math.sqrt(it.missions||6)/1.6),weight:1.5,color:c,fillColor:c,fillOpacity:.45})
    .bindPopup(`<b>${it.no?it.no+' ':no(it.i)?'#'+no(it.i)+' ':''}${esc(it.title||it.name)}</b><br>${it.missions} missions${it.addr?' · '+esc(it.addr):''}<br>${CAT[it.cat][0]}<br><button type="button" data-k="${it.key}">Show in the table</button>`));
}
const all=L.latLngBounds(placed.map(it=>[it.lat,it.lng]));
map.fitBounds(all,{padding:[20,20]});
document.getElementById('map').addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(b)select(b.dataset.k,'shot')});
const regions={};
for(const it of placed){const c=it.addr?it.addr.split(',').pop().trim():'Done list only';(regions[c]??=[]).push([it.lat,it.lng])}
const rb=document.getElementById('regions');
// The country's flag (vendor/flags: flag-icons, MIT). Images, because Windows has no emoji flags.
const ISO={Germany:'de',Czechia:'cz',Ecuador:'ec','Türkiye':'tr',Greece:'gr',Colombia:'co',Spain:'es'};
const region=(label,bounds,iso)=>{const x=document.createElement('button');x.className='chip';x.type='button';x.textContent=label;
  if(iso){const f=document.createElement('img');f.className='flag';f.src=`vendor/flags/${iso}.svg`;f.alt='';x.prepend(f)}
  x.addEventListener('click',()=>map.fitBounds(bounds,{padding:[30,30],maxZoom:15}));rb.append(x)};
region('All',all);
Object.entries(regions).filter(([c])=>c!=='Done list only').sort((a,b)=>b[1].length-a[1].length).forEach(([c,p])=>region(`${c} · ${p.length}`,L.latLngBounds(p),ISO[c]));

shotIn.addEventListener('click',e=>{const m=e.target.closest('.mark');if(m)select(m.dataset.k,'shot')});
document.getElementById('body').addEventListener('click',e=>{
  const b=e.target.closest('.more-btn');
  if(b){const k=b.closest('tr').dataset.k, open=!expanded.has(k);
    open?expanded.add(k):expanded.delete(k);
    b.setAttribute('aria-expanded',open);document.getElementById('m-'+k).hidden=!open;return}
  if(e.target.closest('a')||getSelection().toString())return;
  const tr=e.target.closest('tr[data-k]');if(tr)select(tr.dataset.k,'table')});
render();
