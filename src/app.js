// src/app.js - updated
// IMPORTANT: set SUPABASE_URL and BUCKET_NAME to your project values
const SUPABASE_URL = 'https://qnclxwwfapexijgpweja.supabase.co'; // edit if needed
let SUPABASE_ANON_KEY = localStorage.getItem('supabase_anon') || '';
const BUCKET_NAME = 'badges'; // <-- set to the bucket you uploaded images to

const TABLES = {
  members: 'members_public',
  badges: 'badges_public',
  badge_images: 'badge_images',
  earned: 'earned_public'
};

const fetchHeaders = () => {
  const h = { 'Accept': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    h['apikey'] = SUPABASE_ANON_KEY;
    h['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
  }
  return h;
};

async function fetchTable(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  try {
    const res = await fetch(url, { headers: fetchHeaders() });
    if (!res.ok) {
      console.warn('Fetch failed', url, res.status);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn('Fetch error', e);
    return [];
  }
}

// PUBLIC URL helper for images in storage
function publicUrl(storagePath) {
  if (!storagePath) return '';
  // Supabase public object URL pattern:
  // <SUPABASE_URL>/storage/v1/object/public/<BUCKET_NAME>/<encoded-path>
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(storagePath)}`;
}

// DOM refs
const floatStage = document.getElementById('float-stage');
const selectedContainer = document.getElementById('selected-container');
const backToTeam = document.getElementById('back-to-team');
const themeToggle = document.getElementById('theme-toggle');
const recentList = document.getElementById('recent-list');
const allBadgesRow = document.getElementById('all-badges');
const aboutView = document.getElementById('about-view');

let MEMBERS = [], BADGES = [], BADGE_IMAGES = [], EARNED = [];
let floatEls = [];

// Theme toggle now shows the action (i.e. the text is the action that will occur)
const THEME_KEY = 'nwbadges_theme_v1';
function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  // show the action to switch to
  themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}
function toggleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || 'light';
  localStorage.setItem(THEME_KEY, cur === 'dark' ? 'light' : 'dark');
  applyTheme();
}
themeToggle.addEventListener('click', toggleTheme);
applyTheme();

// responsive recalculation
window.addEventListener('resize', () => {
  positionAllFloatElements(true);
});

// --- Init and data load
(async function init() {
  [MEMBERS, BADGES, BADGE_IMAGES, EARNED] = await Promise.all([
    fetchTable(TABLES.members, '?select=id,initials,display_name,avatar_color&order=initials'),
    fetchTable(TABLES.badges, '?select=id,name,description,categories,eligibility_type,eligibility_user_ids,created_at'),
    fetchTable(TABLES.badge_images, '?select=badge_id,storage_path,format,width,height'),
    fetchTable(TABLES.earned, '?select=id,member_id,badge_id,earned_at,comment,star_count&order=earned_at.desc&limit=50')
  ]);

  // map images onto badges
  const imagesByBadge = {};
  BADGE_IMAGES.forEach(bi => {
    imagesByBadge[bi.badge_id] = imagesByBadge[bi.badge_id] || [];
    imagesByBadge[bi.badge_id].push(bi);
  });
  BADGES.forEach(b => { b.images = imagesByBadge[b.id] || []; });

  const membersById = Object.fromEntries(MEMBERS.map(m=>[m.id, m]));
  const badgesById = Object.fromEntries(BADGES.map(b=>[b.id, b]));

  EARNED.forEach(e=>{
    e.member = membersById[e.member_id] || null;
    e.badge = badgesById[e.badge_id] || null;
  });

  renderRecent();
  renderAllBadges();
  renderFloatingMembers();
})();

// --- Recent activity: simplified format "INITIAL earned BADGE DATE"
function renderRecent() {
  recentList.innerHTML = '';
  if (!EARNED || EARNED.length === 0) {
    recentList.textContent = 'No recent activity yet.';
    return;
  }
  const ul = document.createElement('div');
  ul.style.display = 'flex';
  ul.style.flexDirection = 'column';
  ul.style.gap = '8px';
  EARNED.slice(0,20).forEach(r => {
    const row = document.createElement('div');
    row.className = 'muted';
    const when = r.earned_at ? new Date(r.earned_at).toLocaleDateString() : 'unknown date';
    const memberInitial = r.member ? r.member.initials : 'Unknown';
    const badgeName = r.badge ? r.badge.name : 'Unknown badge';
    row.innerHTML = `<div><strong>${memberInitial}</strong> earned <strong>${badgeName}</strong> ${when}</div>`;
    ul.appendChild(row);
  });
  recentList.appendChild(ul);
}

// --- All badges panel: show description only under badge
function renderAllBadges() {
  allBadgesRow.innerHTML = '';
  if (!BADGES || BADGES.length === 0) {
    allBadgesRow.textContent = 'No badges found.';
    return;
  }
  BADGES.forEach(b => {
    const card = buildBadgeCard({
      id: b.id,
      name: b.name,
      file: (b.images && b.images[0] && b.images[0].storage_path) || '',
      short: b.description || ''
    }, false, true, { showOnlyDescription: true });
    allBadgesRow.appendChild(card);
  });
}

// Helper build badge card (mode options)
function buildBadgeCard(item, earned=false, eligible=true, opts={}) {
  const card = document.createElement('div');
  card.className = 'badge-card ' + (earned ? 'earned' : 'unearned');

  if (item.file) {
    const img = document.createElement('img');
    img.src = publicUrl(item.file);
    img.alt = item.name || '';
    // hide broken images gracefully
    img.onerror = () => { img.style.display = 'none'; };
    card.appendChild(img);
  } else {
    const dummy = document.createElement('div');
    dummy.style.width='88px'; dummy.style.height='88px'; dummy.style.borderRadius='8px'; dummy.style.display='flex'; dummy.style.alignItems='center'; dummy.style.justifyContent='center';
    dummy.textContent = '—';
    card.appendChild(dummy);
  }

  const name = document.createElement('div'); name.className='badge-name'; name.textContent = item.name; card.appendChild(name);

  const extra = document.createElement('div'); extra.className='badge-desc';
  if (opts.showOnlyDescription) {
    extra.textContent = item.short || '';
  } else {
    // default: show description
    extra.textContent = item.short || (earned ? 'Earned badge.' : (eligible ? 'Ready to earn.' : 'Not eligible.'));
  }
  card.appendChild(extra);

  card.addEventListener('click', ()=> populateBadgeDescription(item));
  return card;
}

function populateBadgeDescription(item) {
  const box = document.getElementById('badge-description');
  if (!item) { box.textContent = 'Select a badge to view its description.'; return; }
  const cats = (item.categories && item.categories.length) ? '[' + item.categories.join(', ') + '] ' : '';
  box.textContent = cats + (item.short || 'No description available.');
}

// ---------------- Floating initials: grid-based placement, no overlap, responsive ----------------

function getFloatItemSize() {
  const w = window.innerWidth;
  if (w < 420) return 52;
  if (w < 900) return 64;
  return 72;
}

function renderFloatingMembers() {
  floatStage.innerHTML = '';
  floatEls = [];
  if (!MEMBERS || MEMBERS.length === 0) return;

  // area for placement (use client size)
  const pad = 12;
  const itemW = getFloatItemSize();
  const width = Math.max(220, floatStage.clientWidth - pad*2);
  const height = Math.max(220, floatStage.clientHeight - pad*2);

  // compute grid layout to space items evenly
  const n = MEMBERS.length;
  // heuristic grid: cols approximates aspect ratio
  const aspect = Math.max(0.5, width / Math.max(1, height));
  let cols = Math.ceil(Math.sqrt(n * aspect));
  let rows = Math.ceil(n / cols);

  // ensure grid cell sizes are enough for items; if too small, reduce cols
  while ((width / cols) < (itemW + 8) && cols > 1) {
    cols = Math.max(1, cols - 1);
    rows = Math.ceil(n / cols);
  }

  // cell dimensions
  const cellW = width / cols;
  const cellH = height / rows;

  for (let i=0;i<n;i++) {
    const m = MEMBERS[i];
    const el = document.createElement('div');
    el.className = 'float-item';
    el.style.width = itemW + 'px';
    el.style.height = itemW + 'px';
    el.style.borderRadius = '50%';
    el.style.background = m.avatar_color || '#888';
    el.style.color = '#fff';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontWeight = '800';
    el.innerHTML = `<div class="initial">${escapeHtml(m.initials || m.display_name || '')}</div>`;
    el.title = (m.display_name || m.initials);

    el.addEventListener('click', ()=> selectMember(m));

    floatStage.appendChild(el);

    // compute grid cell coordinate
    const row = Math.floor(i / cols);
    const col = i % cols;

    // center inside the cell with a small random jitter
    const jitterX = Math.max(-6, Math.min(6, (Math.random()*12 - 6)));
    const jitterY = Math.max(-6, Math.min(6, (Math.random()*12 - 6)));
    const left = pad + col * cellW + (cellW - itemW) / 2 + jitterX;
    const top  = pad + row * cellH + (cellH - itemW) / 2 + jitterY;

    floatEls.push({ el, member: m, left, top });
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  startMovementLoop();
}

// Movement loop: gentle small shifts but stay within grid approx positions
let movementTimer = null;
function startMovementLoop() {
  if (movementTimer) clearInterval(movementTimer);
  movementTimer = setInterval(() => {
    if (!floatEls || floatEls.length === 0) return;
    const areaW = Math.max(220, floatStage.clientWidth - 32);
    const areaH = Math.max(220, floatStage.clientHeight - 32);
    const pad = 12;
    const itemW = getFloatItemSize();

    for (const it of floatEls) {
      // tiny shift within +/- 24px while staying within bounds
      const maxShift = 24;
      let nx = it.left + (Math.random()*2-1) * maxShift;
      let ny = it.top  + (Math.random()*2-1) * maxShift;

      nx = Math.max(pad, Math.min(pad + areaW - itemW, nx));
      ny = Math.max(pad, Math.min(pad + areaH - itemW, ny));

      it.left = nx;
      it.top = ny;
      it.el.style.left = nx + 'px';
      it.el.style.top = ny + 'px';
      // slight rotation for a 'float' effect
      it.el.style.transform = `rotate(${(Math.random()*6-3)}deg)`;
      // reset transform after transition (visually)
      setTimeout(() => it.el.style.transform = 'rotate(0deg)', 1500);
    }
  }, 3500);
}

function positionAllFloatElements(keepRelative=false) {
  if (!floatEls || floatEls.length === 0) return;
  if (!keepRelative) { renderFloatingMembers(); return; }
  // ensure inside bounds
  const pad = 12;
  const itemW = getFloatItemSize();
  const width = Math.max(220, floatStage.clientWidth - pad*2);
  const height = Math.max(220, floatStage.clientHeight - pad*2);
  floatEls.forEach(it => {
    it.left = Math.max(pad, Math.min(pad + width - itemW, it.left));
    it.top  = Math.max(pad, Math.min(pad + height - itemW, it.top));
    it.el.style.left = it.left + 'px';
    it.el.style.top = it.top + 'px';
    it.el.style.width = itemW + 'px';
    it.el.style.height = itemW + 'px';
  });
}

// --------------- Member selection and badge lists with category filters ----------------

function selectMember(member) {
  const memberEarned = EARNED.filter(e => e.member_id === member.id).map(e => {
    const badge = BADGES.find(b=>b.id === e.badge_id) || {};
    const image = (badge.images && badge.images[0] && badge.images[0].storage_path) || '';
    return { id: e.id, name: badge.name || 'Unknown', file: image, comment: e.comment, earned_at: e.earned_at, categories: badge.categories || [] };
  });

  selectedContainer.classList.remove('hide');
  selectedContainer.setAttribute('aria-hidden', 'false');
  document.getElementById('float-stage').classList.add('hide');
  document.getElementById('selected-avatar').textContent = member.initials;
  document.getElementById('selected-avatar').style.background = member.avatar_color || '#555';
  document.getElementById('selected-name').textContent = member.display_name || member.initials;
  document.getElementById('selected-summary').textContent = `${memberEarned.length} badge${memberEarned.length===1?'':'s'} earned`;
  document.getElementById('back-to-team').classList.remove('hide');

  // stats
  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = '';
  const totalEarned = memberEarned.length;
  let totalStars = 0;
  memberEarned.forEach(e=>{ totalStars += (e.star || 1); });
  const statList = [
    {label:'Total badges', value: String(totalEarned)},
    {label:'Stars awarded', value: String(totalStars)}
  ];
  statList.forEach(stat=>{
    const div = document.createElement('div'); div.className='stat';
    div.innerHTML = `<strong>${stat.label}</strong><div>${stat.value}</div>`;
    statsGrid.appendChild(div);
  });

  // earned and available rows
  const earnedRow = document.getElementById('earned-row');
  const availableRow = document.getElementById('available-row');
  earnedRow.innerHTML = ''; availableRow.innerHTML = '';

  // build categories set
  const allCategories = new Set();
  BADGES.forEach(b => (b.categories || []).forEach(c=>allCategories.add(c)));
  const cats = Array.from(allCategories).filter(Boolean).sort();

  // category filters UI
  function buildFilterUI(container, onChange) {
    container.innerHTML = '';
    const fdiv = document.createElement('div'); fdiv.className = 'filters';
    const allBtn = document.createElement('button'); allBtn.className = 'filter-btn active'; allBtn.textContent = 'All';
    allBtn.addEventListener('click', ()=>{ setFilter('All'); });
    fdiv.appendChild(allBtn);
    cats.forEach(cat=>{
      const b = document.createElement('button'); b.className = 'filter-btn'; b.textContent = cat;
      b.addEventListener('click', ()=>{ setFilter(cat); });
      fdiv.appendChild(b);
    });
    container.appendChild(fdiv);

    function setFilter(sel) {
      // update active state
      fdiv.querySelectorAll('.filter-btn').forEach(btn=>{
        btn.classList.toggle('active', btn.textContent === sel);
      });
      onChange(sel);
    }
  }

  // render earned badges with filters
  const earnedContainer = document.createElement('div');
  const earnedFiltersHolder = document.createElement('div');
  earnedContainer.appendChild(earnedFiltersHolder);
  const earnedList = document.createElement('div'); earnedList.className='hrow'; earnedList.style.flexWrap='wrap'; earnedContainer.appendChild(earnedList);

  buildFilterUI(earnedFiltersHolder, (sel) => {
    earnedList.innerHTML = '';
    let items = memberEarned.slice();
    if (sel !== 'All') items = items.filter(i => (i.categories || []).includes(sel));
    if (items.length === 0) { const e = document.createElement('div'); e.className='empty'; e.textContent='No badges in this category.'; earnedList.appendChild(e); }
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'badge-card earned';
      const img = document.createElement('img'); img.src = publicUrl(it.file); img.alt = it.name;
      img.onerror = ()=> img.style.display='none';
      card.appendChild(img);
      const name = document.createElement('div'); name.className='badge-name'; name.textContent = it.name; card.appendChild(name);
      const descr = document.createElement('div'); descr.className='badge-desc'; descr.innerHTML = `${it.comment || ''} <div style="font-size:12px;color:var(--muted)">${it.earned_at ? new Date(it.earned_at).toLocaleDateString() : ''}</div>`;
      card.appendChild(descr);
      earnedList.appendChild(card);
    });
  });

  earnedRow.appendChild(earnedContainer);
  // initial filter = All
  earnedFiltersHolder.querySelector('.filter-btn').click();

  // available badges: those not earned
  const availableContainer = document.createElement('div');
  const availableFiltersHolder = document.createElement('div');
  availableContainer.appendChild(availableFiltersHolder);
  const availableList = document.createElement('div'); availableList.className='hrow'; availableContainer.appendChild(availableList);

  buildFilterUI(availableFiltersHolder, (sel) => {
    availableList.innerHTML = '';
    let items = BADGES.filter(b => !memberEarned.find(eb=>eb.name === b.name));
    if (sel !== 'All') items = items.filter(b => (b.categories || []).includes(sel));
    if (items.length === 0) { const e = document.createElement('div'); e.className='empty'; e.textContent='No badges in this category.'; availableList.appendChild(e); }
    items.forEach(b => {
      const card = buildBadgeCard({ id: b.id, name: b.name, file: (b.images && b.images[0] && b.images[0].storage_path) || '', short: b.description }, false, true, {});
      availableList.appendChild(card);
    });
  });

  availableRow.appendChild(availableContainer);
  availableFiltersHolder.querySelector('.filter-btn').click();

  populateBadgeDescription(null);
}

// back to team
document.getElementById('back-to-team').addEventListener('click', () => {
  document.getElementById('selected-container').classList.add('hide');
  document.getElementById('selected-container').setAttribute('aria-hidden', 'true');
  document.getElementById('float-stage').classList.remove('hide');
  document.getElementById('back-to-team').classList.add('hide');
  renderFloatingMembers();
});

// Suggest modal handlers
document.getElementById('suggest-btn').addEventListener('click', ()=> document.getElementById('suggest-modal').classList.remove('hide'));
document.getElementById('s-cancel').addEventListener('click', ()=> document.getElementById('suggest-modal').classList.add('hide'));
document.getElementById('s-submit').addEventListener('click', ()=> {
  const name = document.getElementById('s-name').value.trim();
  if(!name) { alert('Please enter a name'); return; }
  const key = 'nwbadges_local_suggestions';
  const cur = JSON.parse(localStorage.getItem(key) || '[]');
  cur.push({name, desc: document.getElementById('s-desc').value, at: new Date().toISOString()});
  localStorage.setItem(key, JSON.stringify(cur));
  alert('Saved locally.');
  document.getElementById('suggest-modal').classList.add('hide');
});

// simple escaper
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
