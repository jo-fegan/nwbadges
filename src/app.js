import { MEMBERS, BADGES, PUBLIC_BASE, ELIGIBILITY } from './data.js';

const THEME_KEY = 'nwbadges_theme_v1';
const selectedContainer = document.getElementById('selected-container');
const floatStage = document.getElementById('float-stage');
const teamViewBtn = document.getElementById('team-view-btn');

function applyTheme(){
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
}
function toggleTheme(){
  const current = localStorage.getItem(THEME_KEY) || 'light';
  localStorage.setItem(THEME_KEY, current === 'dark' ? 'light' : 'dark');
  applyTheme();
}

function publicUrl(file){ return PUBLIC_BASE + '/' + encodeURIComponent(file); }

function renderRecent(){
  const list = document.getElementById('recent-list');
  const recent = [];
  MEMBERS.forEach(m=>{
    m.earned.forEach(e=>{
      recent.push({ member:m, badge:e, at:e.earned_at || new Date().toISOString() });
    });
  });
  recent.sort((a,b)=> new Date(b.at) - new Date(a.at));
  const top = recent.slice(0,5);
  if(top.length === 0){ list.textContent = 'No recent activity yet.'; return; }
  list.innerHTML = '';
  top.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'muted';
    row.style.marginBottom = '8px';
    row.innerHTML = `<div><strong>${item.member.initials}</strong> earned <strong>${item.badge.name}</strong></div>${item.badge.comment ? '<div>'+item.badge.comment+'</div>' : ''}`;
    list.appendChild(row);
  });
}

function renderFloating(){
  floatStage.innerHTML = '';
  const width = floatStage.clientWidth || 900;
  const height = floatStage.clientHeight || 420;
  const positions = MEMBERS.map((_,i)=>({
    left: 18 + Math.random() * (width - 130),
    top: 18 + Math.random() * (height - 150)
  }));

  MEMBERS.forEach((m,i)=>{
    const el = document.createElement('div');
    el.className = 'float-item animate';
    el.style.left = positions[i].left + 'px';
    el.style.top = positions[i].top + 'px';
    el.style.background = m.color;
    el.innerHTML = `<div class="initial">${m.initials}</div>`;
    el.addEventListener('click', ()=>selectMember(m));
    floatStage.appendChild(el);
  });
}

let selectedMember = null;

function selectMember(member){
  selectedMember = member;
  selectedContainer.classList.remove('hide');
  selectedContainer.setAttribute('aria-hidden', 'false');
  document.getElementById('team-view-btn').classList.remove('hide');
  document.getElementById('float-stage').classList.add('hide');

  document.getElementById('selected-avatar').textContent = member.initials;
  document.getElementById('selected-avatar').style.background = member.color;
  document.getElementById('selected-name').textContent = member.name;
  document.getElementById('selected-summary').textContent = `${member.earned.length} badge${member.earned.length===1?'':'s'} earned`;

  // stats
  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = '';
  const totalEarned = member.earned.length;
  let lastBadge = '—', lastDate = null, totalStars = 0;
  member.earned.forEach(e=>{ totalStars += (e.star || 1); if(e.earned_at){ const d = new Date(e.earned_at); if(!lastDate || d>lastDate){ lastDate=d; lastBadge=e.name; } }});
  const statList = [
    {label:'Last badge', value: lastDate ? lastDate.toLocaleDateString() : 'No badges yet'},
    {label:'Total badges', value: String(totalEarned)},
    {label:'Stars awarded', value: String(totalStars)},
    {label:'Most recent', value: lastBadge}
  ];
  statList.forEach(stat=>{
    const div = document.createElement('div'); div.className='stat';
    div.innerHTML = `<strong>${stat.label}</strong><div>${stat.value}</div>`;
    statsGrid.appendChild(div);
  });

  renderBadgeRows(member);
  populateBadgeDescription(null);
}

function renderBadgeRows(member){
  const earnedRow = document.getElementById('earned-row');
  const availableRow = document.getElementById('available-row');
  earnedRow.innerHTML = '';
  availableRow.innerHTML = '';

  const earnedSet = new Set(member.earned.map(e=>e.name));
  const earnedBadges = member.earned.map(e=>{
    const match = BADGES.find(b=>b.name===e.name);
    return { name: e.name, file: match ? match.file : '', short: match ? match.short : '', comment: e.comment || '' };
  });
  if(earnedBadges.length===0){
    const empty = document.createElement('div'); empty.className='empty'; empty.textContent='No badges earned yet.'; earnedRow.appendChild(empty);
  } else {
    earnedBadges.forEach(item=> earnedRow.appendChild(buildBadgeCard(item, true)));
  }

  BADGES.forEach(b=>{
    if(!earnedSet.has(b.name)){
      const eligible = (ELIGIBILITY[b.name]||[]).includes(member.initials) || (ELIGIBILITY[b.name]||[]).length===0;
      availableRow.appendChild(buildBadgeCard({name:b.name,file:b.file,short:b.short}, false, eligible));
    }
  });
  if(availableRow.children.length===0){ const empty=document.createElement('div'); empty.className='empty'; empty.textContent='All badges earned.'; availableRow.appendChild(empty); }
}

function buildBadgeCard(item, earned, eligible=true){
  const card = document.createElement('div'); card.className = 'badge-card ' + (earned ? 'earned' : 'unearned');
  if(item.file){ const img = document.createElement('img'); img.src = publicUrl(item.file); img.alt = item.name; card.appendChild(img); }
  const name = document.createElement('div'); name.className = 'badge-name'; name.textContent = item.name; card.appendChild(name);
  const extra = document.createElement('div'); extra.className = 'badge-desc'; extra.textContent = item.short || (earned ? item.comment || 'Earned badge.' : (eligible ? 'Ready to earn.' : 'Not eligible.'));
  card.appendChild(extra);
  card.addEventListener('click', ()=>populateBadgeDescription(item));
  return card;
}

function populateBadgeDescription(item){
  const box = document.getElementById('badge-description');
  box.textContent = item ? (item.short || item.comment || 'Description not available.') : 'Select a badge to view its description.';
}

function resetToTeamView(){
  selectedMember = null;
  selectedContainer.classList.add('hide');
  selectedContainer.setAttribute('aria-hidden', 'true');
  document.getElementById('team-view-btn').classList.add('hide');
  document.getElementById('float-stage').classList.remove('hide');
  renderFloating();
}

function openSuggestModal(){ document.getElementById('suggest-modal').classList.remove('hide'); }
function closeSuggestModal(){ document.getElementById('suggest-modal').classList.add('hide'); document.getElementById('s-name').value=''; document.getElementById('s-desc').value=''; document.getElementById('s-files').value=''; }
function submitSuggest(){ const name = document.getElementById('s-name').value.trim(); if(!name){ alert('Please enter a badge name'); return; } const key = 'nwbadges_local_suggestions'; const cur = JSON.parse(localStorage.getItem(key) || '[]'); cur.push({name,description:document.getElementById('s-desc').value,created_at:new Date().toISOString()}); localStorage.setItem(key, JSON.stringify(cur)); alert('Suggestion saved locally.'); closeSuggestModal(); }

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('team-view-btn').addEventListener('click', resetToTeamView);
document.getElementById('suggest-btn').addEventListener('click', openSuggestModal);
document.getElementById('s-cancel').addEventListener('click', closeSuggestModal);
document.getElementById('s-submit').addEventListener('click', submitSuggest);
document.getElementById('suggest-overlay')?.addEventListener('click', (e)=>{ if(e.target.id==='suggest-overlay') closeSuggestModal(); });

applyTheme();
renderFloating();
renderRecent();
