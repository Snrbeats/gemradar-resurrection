const API='https://api.audius.co/v1'
const DAY_MS=24*60*60*1000

const state={
  key:localStorage.getItem('audius_api_key')||'',
  handle:localStorage.getItem('audius_handle')||'',
  liked:JSON.parse(localStorage.getItem('liked_tracks_v2')||'[]'),
  picks:JSON.parse(localStorage.getItem('scout_picks_v1')||'[]'),
  queue:[],
  queueIndex:-1,
  shuffle:false,
  currentArtistId:null,
  currentArtistHandle:'',
  currentArtistName:''
}

const $=s=>document.querySelector(s)
const $$=s=>Array.from(document.querySelectorAll(s))
$('#apiKey').value=state.key
$('#handleInput').value=state.handle
$('#authStatus').textContent=state.handle?`Connected as @${state.handle}`:'Not connected'

function save(){
  localStorage.setItem('audius_api_key',state.key)
  localStorage.setItem('audius_handle',state.handle)
  localStorage.setItem('liked_tracks_v2',JSON.stringify(state.liked.slice(-500)))
  localStorage.setItem('scout_picks_v1',JSON.stringify(state.picks.slice(-500)))
}

$('#saveKey').onclick=()=>{state.key=$('#apiKey').value.trim();save();bootstrap()}
$('#saveHandle').onclick=()=>{state.handle=$('#handleInput').value.trim();$('#authStatus').textContent=state.handle?`Connected as @${state.handle}`:'Not connected';save()}

$$('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab))
$('#searchBtn').onclick=()=>search($('#searchInput').value.trim())
$('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')search($('#searchInput').value.trim())})
$('#nextBtn').onclick=()=>nextTrack()
$('#prevBtn').onclick=()=>prevTrack()
$('#shuffleBtn').onclick=()=>{state.shuffle=!state.shuffle;$('#shuffleBtn').style.opacity=state.shuffle?1:.6}
$('#audio').addEventListener('ended',()=>nextTrack())

document.addEventListener('keydown',(e)=>{
  if(e.code!=='Space') return
  const tag=(e.target?.tagName||'').toUpperCase()
  const typing = tag==='INPUT' || tag==='TEXTAREA' || e.target?.isContentEditable
  if(typing) return
  e.preventDefault()
  const a=$('#audio')
  if(!a.src) return
  if(a.paused) a.play().catch(()=>{})
  else a.pause()
})

function setTab(tab){
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))
  ;['home','search','library','smart','dailymix','picks','artist'].forEach(id=>$('#'+id).classList.toggle('hidden',id!==tab))
  $('#title').textContent = tab==='home' ? 'Resurrection Feed' : (tab==='dailymix' ? 'Daily Discovery Reroll' : (tab[0].toUpperCase()+tab.slice(1)))
  if(tab==='library') renderLibrary()
  if(tab==='picks') renderPicks()
  if(tab==='smart') renderSmart()
  if(tab==='dailymix') renderDailyMix()
  if(tab==='artist') renderArtistPanel()
}

async function get(path){
  if(!state.key) throw new Error('Set API key first')
  const url=`${API}${path}`
  const r=await fetch(url,{headers:{'x-api-key':state.key}})
  if(!r.ok){
    const body = await r.text().catch(()=> '')
    throw new Error(`API ${r.status} on ${path}${body?` | ${body.slice(0,160)}`:''}`)
  }
  return r.json()
}

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)) }

function getGemMetrics(t){
  const plays=Number(t.play_count||t.playCount||0)
  const favorites=Number(t.favorite_count||t.favoriteCount||0)
  const reposts=Number(t.repost_count||t.repostCount||0)
  const followers=Number(t.user?.follower_count||t.user?.followerCount||0)
  const created=t.createdAt||t.created_at||t.releaseDate||null

  const engagementRaw=(favorites + reposts*1.5) / Math.max(plays,1)
  const engagement=clamp(engagementRaw*100,0,100)

  let freshness=30
  if(created){
    const ageDays=(Date.now()-new Date(created).getTime())/DAY_MS
    freshness=clamp(100 - ageDays*3,0,100)
  }

  // higher score for lower-followed artists
  const underdog=clamp(100 - Math.log10(Math.max(followers,1))*20,0,100)

  const mainstreamPenalty=plays>250000?20:0
  const scoreRaw=0.4*engagement + 0.4*freshness + 0.2*underdog - mainstreamPenalty
  const score=Math.round(clamp(scoreRaw,0,100))

  return { score, engagement, freshness, underdog, plays, followers }
}

function getGemReason(m){
  if(m.engagement>18 && m.plays<60000) return 'High engagement on relatively low-play track'
  if(m.freshness>75) return 'Fresh release with early momentum'
  if(m.underdog>65) return 'Underrated artist signal (low follower base)'
  if(m.plays<120000) return 'Emerging track with room to break out'
  return 'Balanced momentum across discovery signals'
}

function trackCard(t,{showGem=true, listContext=null}={}){
  const img=t.artwork?.['480x480']||t.artwork?.['150x150']||''
  const artist=t.user?.name||t.user?.handle||'Unknown'
  const liked=state.liked.some(x=>x.id===t.id)
  const picked=state.picks.some(x=>String(x.id)===String(t.id))
  const gem=getGemMetrics(t)
  const reason=getGemReason(gem)
  
  // Pivot: Check for Solana Artist Coin
  const badge = t.user?.artist_coin_badge
  const mint = badge?.mint
  const ticker = badge?.ticker || 'COIN'
  const hasCoin = !!mint

  const d=document.createElement('div');d.className='card'
  d.innerHTML=`
    <img src="${img}" onerror="this.style.opacity=.2"/>
    ${hasCoin ? `<a href="https://jup.ag/swap/SOL-${mint}" target="_blank" class="coin-badge" title="Buy $${ticker} on Jupiter">$${ticker}</a>` : ''}
    <h4>${t.title||'Untitled'}</h4>
    <p>${artist}</p>
    ${showGem ? `<p class='gemline'>💎 Gem Score: <strong>${gem.score}</strong></p><p class='whyline'>Why: ${reason}</p>` : ''}
    <div class='row'><button data-play>Play</button><button data-like>${liked?'♥':'♡'}</button></div>
    <div class='row'><button data-queue>Queue</button><button data-artist>Artist</button></div>
    <div class='row'><button data-pick>${picked?'✅ Discovered':'🎯 Resurrect'}</button></div>`
  d.querySelector('[data-play]').onclick=()=>playNow(t, listContext)
  d.querySelector('[data-like]').onclick=()=>toggleLike(t)
  d.querySelector('[data-queue]').onclick=()=>addQueue(t)
  d.querySelector('[data-artist]').onclick=()=>openArtist(t.user?.id,t.user?.handle,t.user?.name)
  d.querySelector('[data-pick]').onclick=e=>scoutPick(t, e.target)
  return d
}

function renderList(el,arr,msg='No items',opts={showGem:true}){
  el.innerHTML=''
  if(!arr?.length){el.innerHTML=`<div class='notice'>${msg}</div>`;return}
  arr.forEach(t=>el.appendChild(trackCard(t,{...opts, listContext:arr})))
}

function addQueue(t){state.queue.push(t); if(state.queueIndex<0) state.queueIndex=0}
function playNow(t, listContext=null){
  if(listContext) state.queue = [...listContext]
  if(!state.queue.some(q=>q.id===t.id)) addQueue(t)
  state.queueIndex=state.queue.findIndex(q=>q.id===t.id)
  const a=$('#audio')
  a.src=`${API}/tracks/${t.id}/stream`
  a.play().catch(()=>{})
  $('#cover').src=t.artwork?.['150x150']||''
  $('#nowTitle').textContent=t.title||'Untitled'
  $('#nowArtist').textContent=t.user?.name||t.user?.handle||'Unknown'
}
function nextTrack(){
  if(!state.queue.length) return
  if(state.shuffle){state.queueIndex=Math.floor(Math.random()*state.queue.length)}
  else state.queueIndex=(state.queueIndex+1)%state.queue.length
  playNow(state.queue[state.queueIndex])
}
function prevTrack(){
  if(!state.queue.length) return
  state.queueIndex=(state.queueIndex-1+state.queue.length)%state.queue.length
  playNow(state.queue[state.queueIndex])
}

function toggleLike(t){
  state.liked=state.liked.some(x=>x.id===t.id)?state.liked.filter(x=>x.id!==t.id):[...state.liked,t]
  save(); renderLibrary(); bootstrap(false)
}

function scoutPick(t, btn){
  const exists=state.picks.some(x=>String(x.id)===String(t.id))
  if(exists){
    window.alert('Already in My Picks ✅')
    return
  }
  const m=getGemMetrics(t)
  state.picks.push({
    id:t.id,
    title:t.title||'Untitled',
    artist:t.user?.name||t.user?.handle||'Unknown',
    artistHandle:t.user?.handle||'',
    artwork:t.artwork?.['150x150']||t.artwork?.['480x480']||'',
    pickedAt:new Date().toISOString(),
    pickedGemScore:m.score,
    pickedPlays:m.plays
  })
  save()
  if(btn) btn.innerHTML='✅ Picked'
  // window.alert('Added to My Picks 🎯')
  if(!$('#picks').classList.contains('hidden')) renderPicks()
}

async function renderSmart(){
  $('#title').textContent = '💎 80-90 Percentile Gems'
  const el=$('#smart')
  el.innerHTML="<div class='notice'>Loading...</div>"
  try{
    const r=await fetch('./scouts/gems-80-90.json')
    if(!r.ok) throw new Error('Run "node scripts/scout.js" to generate playlist.')
    const data=await r.json()
    renderList(el,data,'No gems found.')
  }catch(e){
    el.innerHTML=`<div class='notice'>${e.message}</div>`
  }
}

async function renderDailyMix(){
  $('#title').textContent = '🎲 GemRadar Daily Mix'
  const el=$('#dailymix')
  el.innerHTML="<div class='notice'>Mixing your daily gems...</div>"
  try{
    const r=await fetch('./scouts/gems-80-90.json')
    if(!r.ok) throw new Error('Run "node scripts/scout.js" first.')
    const data=await r.json()
    if(!data?.length) { el.innerHTML="<div class='notice'>No gems available to mix.</div>"; return; }
    
    // Shuffle and pick 15
    const shuffled = data.sort(() => 0.5 - Math.random())
    const mix = shuffled.slice(0, 15)
    
    renderList(el,mix,'Mix failed.')
    const btn = document.createElement('button')
    btn.textContent = '🔄 Re-roll Mix'
    btn.className = 'notice'
    btn.style.cursor = 'pointer'
    btn.onclick = () => renderDailyMix()
    el.prepend(btn)
  }catch(e){
    el.innerHTML=`<div class='notice'>${e.message}</div>`
  }
}

function renderLibrary(){ renderList($('#library'),state.liked.slice().reverse(),'Your library is empty',{showGem:false}) }

async function fetchTrackPlays(trackId){
  try{
    const r=await get(`/tracks/${trackId}`)
    const t=r.data||r
    return Number(t.play_count||t.playCount||0)
  }catch{
    return null
  }
}

function fmtDate(iso){
  try{return new Date(iso).toLocaleString()}catch{return iso}
}

async function renderPicks(){
  const el=$('#picks')
  if(!state.picks.length){
    el.innerHTML="<div class='notice'>No scout picks yet. Use 🎯 Scout Pick on any track.</div>"
    return
  }

  el.innerHTML="<div class='notice'>Calculating Scout Score...</div>"
  const picks=[...state.picks].reverse()

  const scored=await Promise.all(picks.map(async p=>{
    const current=await fetchTrackPlays(p.id)
    const gain=current==null?0:Math.max(0,current-Number(p.pickedPlays||0))
    const points=Math.round(gain/50) // 1 point per 50 new streams since pick
    return {...p,currentPlays:current,streamGain:gain,scoutPoints:points}
  }))

  const total=scored.reduce((s,x)=>s+(x.scoutPoints||0),0)

  el.innerHTML=''
  const banner=document.createElement('div')
  banner.className='notice'
  banner.innerHTML=`Scout Score: <strong>${total}</strong> • Picks: <strong>${scored.length}</strong> • Rank logic: +1 point / 50 streams gained after your pick`
  el.appendChild(banner)

  scored.forEach(p=>{
    const d=document.createElement('div')
    d.className='card'
    d.innerHTML=`
      <img src="${p.artwork||''}" onerror="this.style.opacity=.2"/>
      <h4>${p.title}</h4>
      <p>${p.artist}</p>
      <p class='gemline'>Picked Gem Score: <strong>${p.pickedGemScore}</strong></p>
      <p class='whyline'>Picked at: ${fmtDate(p.pickedAt)}</p>
      <p class='whyline'>Plays then → now: ${p.pickedPlays} → ${p.currentPlays ?? 'n/a'}</p>
      <p class='gemline'>Stream gain: <strong>${p.streamGain}</strong> • Scout Points: <strong>${p.scoutPoints}</strong></p>
      <div class='row'><button data-play>Play</button><button data-artist>Artist</button></div>
    `
    d.querySelector('[data-play]').onclick=()=>playNow({
      id:p.id,
      title:p.title,
      artwork:{'150x150':p.artwork},
      user:{name:p.artist,handle:p.artistHandle}
    })
    d.querySelector('[data-artist]').onclick=()=>openArtist(null,p.artistHandle,p.artist)
    el.appendChild(d)
  })
}

async function loadHome(){
  $('#home').innerHTML="<div class='notice'>Scanning the Graveyard for Hidden Talent...</div>"
  try{
    // Search specifically for newer tracks to find the "undiscovered"
    const r=await get('/tracks/search?query=2026&limit=100')
    const all=r.data||[]

    const ranked=all
      .map(t=>({t,score:getGemMetrics(t).score}))
      // Resurrection logic: Prioritize low play count with high relative engagement
      .filter(x => x.t.play_count < 1000) 
      .sort((a,b)=>b.score-a.score)
      .slice(0,40)
      .map(x=>x.t)

    renderList($('#home'),ranked,'The Graveyard is quiet... for now.',{showGem:true})
  }catch(e){$('#home').innerHTML=`<div class='notice'>${e.message}</div>`}
}

async function search(q){
  if(!q) return
  setTab('search')
  $('#search').innerHTML="<div class='notice'>Searching...</div>"
  try{ 
    const r=await get(`/tracks/search?query=${encodeURIComponent(q)}&limit=36`)
    const arr=(r.data||[])
      .map(t=>({t,score:getGemMetrics(t).score}))
      .sort((a,b)=>b.score-a.score)
      .map(x=>x.t)
    renderList($('#search'),arr)
  }
  catch(e){$('#search').innerHTML=`<div class='notice'>${e.message}</div>`}
}

function openArtist(id,handle,name=''){
  state.currentArtistId=id||null
  state.currentArtistHandle=handle||''
  state.currentArtistName=name||''
  setTab('artist')
  renderArtistPanel(handle)
}

async function renderArtistPanel(handleHint=''){
  const el=$('#artist')
  const handle=(handleHint||state.currentArtistHandle||state.handle||'').trim()
  const name=(state.currentArtistName||'').trim()

  if(!handle && !name){
    el.innerHTML="<div class='notice'>Open an artist from any track card.</div>"
    return
  }

  el.innerHTML="<div class='notice'>Loading artist tracks...</div>"
  try{
    const query=handle||name
    const tracks=await get(`/tracks/search?query=${encodeURIComponent(query)}&limit=60`)
    const all=tracks.data||[]

    const only=all.filter(t=>{
      const h=(t.user?.handle||'').toLowerCase()
      const n=(t.user?.name||'').toLowerCase()
      return (handle && h===handle.toLowerCase()) || (name && n===name.toLowerCase())
    })

    renderList(el,only.length?only:all,`No tracks found for ${handle?('@'+handle):name}`)
  }catch(e){
    el.innerHTML=`<div class='notice'>Artist lookup failed: ${e.message}</div>`
  }
}

function bootstrap(reloadHome=true){ if(reloadHome) loadHome(); renderLibrary(); if(!$('#picks').classList.contains('hidden')) renderPicks(); }
bootstrap()

// Avoid stale-cache headaches while developing locally
if('serviceWorker' in navigator && !['localhost','127.0.0.1'].includes(location.hostname)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))
}
