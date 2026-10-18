// App: fetches from Supabase REST endpoints and renders responsive UI with non-overlapping floating initials.
//
// IMPORTANT:
// - Set SUPABASE_URL to your project URL (example: https://xxxxx.supabase.co).
// - If your tables require the anon key (RLS not open), set SUPABASE_ANON_KEY below or in localStorage key 'supabase_anon'.
// - The app will attempt unauthenticated fetches first and then add headers if anon key present.

const SUPABASE_URL = 'https://qnclxwwfapexijgpweja.supabase.co'; 
let SUPABASE_ANON_KEY = localStorage.getItem('supabase_anon') || ''; // optional; set in DevTools or edit here

const TABLES = {
  members: 'members_public',
  badges: 'badges_public',
  badge_images: 'badge_images',   // images can stay as-is (bucket filenames)
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

// DOM references
const floatStage = document.getElementById('float-stage');
const selectedContainer = document.getElementById('selected-container');
const backToTeam = document.getElementById('back-to-team');
const themeToggle = document.getElementById('theme-toggle');
const recentList = document.getElementById('recent-list');
const allBadgesRow = document.getElementById('all-badges');

let MEMBERS = [], BADGES = [], BADGE_IMAGES = [], EARNED = [];
let floatEls = []; // {el, member, left, top}

// Utility for public image url (attempts to use any image path from badge_images)
function publicUrl(storagePath) {
  if (!storagePath) return '';
  // Most likely images are in the public storage bucket path
  return `${SUPABASE_URL}/storage/v1/object/public/badges/${encodeURIComponent(storagePath)}`;
}

// Theme
const THEME_KEY = 'nwbadges_theme_v1';
function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  themeToggle.textContent = theme === 'dark' ? 'Dark mode' : 'Light mode';
}
function toggleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || 'light';
  localStorage.setItem(THEME_KEY, cur === 'dark' ? 'light' : 'dark');
  applyTheme();
}
themeToggle.addEventListener('click', toggleTheme);
applyTheme();

// responsive layout recalculation on resize
window.addEventListener('resize', () => {
  positionAllFloatElements(true);
});

// Main init: fetch data and render
(async function init() {
  // fetch data in parallel
  [MEMBERS, BADGES, BADGE_IMAGES, EARNED] = await Promise.all([
    fetchTable(TABLES.members, '?select=id,initials,display_name,avatar_color&order=initials'),
    fetchTable(TABLES.badges, '?select=id,name,description,categories,eligibility_type,eligibility_user_ids'),
    fetchTable(TABLES.badge_images, '?select=badge_id,storage_path,format,width,height'),
    fetchTable(TABLES.earned, '?select=id,member_id,badge_id,earned_at,comment,star_count&order=earned_at.desc&limit=50')
  ]);

  // Map images onto badges
  const imagesByBadge = {};
  BADGE_IMAGES.forEach(bi => {
    imagesByBadge[bi.badge_id] = imagesByBadge[bi.badge_id] || [];
    imagesByBadge[bi.badge_id].push(bi);
  });
  BADGES.forEach(b => { b.images = imagesByBadge[b.id] || []; });

  // Map earned rows with member initials & badge names for quick use
  const membersById = Object.fromEntries(MEMBERS.map(m=>[m.id, m]));
  const badgesById = Object.fromEntries(BADGES.map(b=>[b.id, b]));

  EARNED.forEach(e=>{
    e.member = membersById[e.member_id] || null;
    e.badge = badgesById[e.badge_id] || null;
  });

  // Render UI
  renderRecent();
  renderAllBadges();
  renderFloatingMembers();
})();

// Render recent activity from EARNED
function renderRecent() {
  if (!EARNED || EARNED.length === 0) {
    recentList.textContent = 'No recent activity yet.';
    return;
  }
  recentList.innerHTML = '';
  EARNED.slice(0,20).forEach(r => {
    const row = document.createElement('div');
    row.className = 'muted';
    const when = r.earned_at ? new Date(r.earned_at).toLocaleString() : 'unknown time';
    const memberText = r.member ? `<strong>${r.member.initials}</strong>` : '<strong>Unknown</strong>';
    const badgeText = r.badge ? `<strong>${r.badge.name}</strong>` : '<strong>Unknown badge</strong>';
    row.innerHTML = `<div>${memberText} earned ${badgeText} • <span class="muted" style="font-size:12px">${when}</span></div>${r.comment ? '<div style="margin-top:4px">'+escapeHtml(r.comment)+'</div>' : ''}`;
    recentList.appendChild(row);
  });
}

// Render all badges in right-col panel
function renderAllBadges() {
  allBadgesRow.innerHTML = '';
  if (!BADGES || BADGES.length === 0) {
    allBadgesRow.textContent = 'No badges found.';
    return;
  }
  BADGES.forEach(b => {
    const card = buildBadgeCard({
      name: b.name,
      file: (b.images && b.images[0] && b.images[0].storage_path) || '',
      short: b.description || '',
      categories: b.categories || []
    });
    allBadgesRow.appendChild(card);
  });
}

// Build badge card DOM
function buildBadgeCard(item, earned=false, eligible=true) {
  const card = document.createElement('div');
  card.className = 'badge-card ' + (earned ? 'earned' : 'unearned');
  if (item.file) {
    const img = document.createElement('img');
    img.src = publicUrl(item.file);
    img.alt = item.name;
    card.appendChild(img);
  } else {
    const dummy = document.createElement('div');
    dummy.style.width='88px'; dummy.style.height='88px'; dummy.style.borderRadius='8px'; dummy.style.display='flex'; dummy.style.alignItems='center'; dummy.style.justifyContent='center';
    dummy.textContent = '—';
    card.appendChild(dummy);
  }
  const name = document.createElement('div'); name.className='badge-name'; name.textContent = item.name; card.appendChild(name);

  const extra = document.createElement('div'); extra.className='badge-desc';
  const cats = (item.categories && item.categories.length) ? 'Categories: ' + item.categories.join(', ') + ' • ' : '';
  extra.textContent = (cats + (item.short || (earned ? 'Earned badge.' : (eligible ? 'Ready to earn.' : 'Not eligible.'))));
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

// --------------- Floating initials: non-overlapping placement + gentle movement ----------------

function renderFloatingMembers() {
  floatStage.innerHTML = '';
  floatEls = [];
  if (!MEMBERS || MEMBERS.length === 0) return;

  // prepare constrained area (padding)
  const pad = 16;
  const itemW = getFloatItemSize();
  const area = floatStage.getBoundingClientRect();
  const width = Math.max(220, area.width - pad*2);
  const height = Math.max(220, area.height - pad*2);

  // helper to test overlap
  function overlaps(x, y) {
    for (const it of floatEls) {
      const dx = it.left - x, dy = it.top - y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < itemW + 6) return true;
    }
    return false;
  }

  // generate positions
  for (let i=0; i<MEMBERS.length; i++) {
    const m = MEMBERS[i];
    const el = document.createElement('div');
    el.className = 'float-item';
    el.style.width = itemW + 'px';
    el.style.height = itemW + 'px';
    el.style.borderRadius = '50%';
    el.style.background = m.avatar_color || '#888';
    el.innerHTML = `<div class="initial">${escapeHtml(m.initials || m.display_name || '')}</div>`;
    el.title = (m.display_name || m.initials);

    // click -> select member
    el.addEventListener('click', ()=> selectMember(m));

    floatStage.appendChild(el);

    // find a non-overlapping position (try many times)
    let attempts = 0;
    let left, top;
    do {
      left = pad + Math.random()*(width - itemW);
      top  = pad + Math.random()*(height - itemW);
      attempts++;
      if (attempts > 500) break;
    } while (overlaps(left, top));

    // store element state
    floatEls.push({ el, member: m, left, top });
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  // start movement loop
  startMovementLoop();
}

function getFloatItemSize() {
  const w = window.innerWidth;
  if (w < 500) return 56;
  if (w < 900) return 64;
  return 72;
}

// Movement loop: every N seconds choose a new target near current pos (non-overlapping)
let movementTimer = null;
function startMovementLoop() {
  if (movementTimer) clearInterval(movementTimer);
  movementTimer = setInterval(() => {
    if (!floatEls || floatEls.length === 0) return;
    const area = floatStage.getBoundingClientRect();
    const pad = 16;
    const itemW = getFloatItemSize();
    const width = Math.max(220, area.width - pad*2);
    const height = Math.max(220, area.height - pad*2);
    // compute new positions one by one trying to avoid overlap
    for (const it of floatEls) {
      let attempts = 0;
      let nx, ny;
      do {
        // choose target within +/- 80px from current pos but constrained to area
        const maxShift = Math.max(40, Math.min(120, Math.min(width, height)/6));
        nx = Math.max(pad, Math.min(pad + width - itemW, it.left + (Math.random()*2-1) * maxShift));
        ny = Math.max(pad, Math.min(pad + height - itemW, it.top  + (Math.random()*2-1) * maxShift));
        attempts++;
        if (attempts > 200) break;
        // check collision against other *current* targets (use tentative positions)
        let coll = false;
        for (const other of floatEls) {
          if (other === it) continue;
          const dx = (other.left) - nx, dy = (other.top) - ny;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < itemW + 6) { coll = true; break; }
        }
        if (!coll) break;
      } while(true);

      // apply transition by setting style left/top (CSS transition in styles)
      it.left = nx;
      it.top = ny;
      it.el.style.left = nx + 'px';
      it.el.style.top = ny + 'px';
    }
  }, 3000); // every 3s choose a new target (gentle & slow)
}

// Re-position elements responsively (on resize)
function positionAllFloatElements(keepRelative=false) {
  if (!floatEls || floatEls.length === 0) return;
  // if keepRelative=false, recompute non-overlapping positions fresh
  if (!keepRelative) {
    renderFloatingMembers();
    return;
  }
  // else ensure elements are within new bounds
  const area = floatStage.getBoundingClientRect();
  const pad = 16;
  const itemW = getFloatItemSize();
  const width = Math.max(220, area.width - pad*2);
  const height = Math.max(220, area.height - pad*2);
  floatEls.forEach(it => {
    it.left = Math.max(pad, Math.min(pad + width - itemW, it.left));
    it.top  = Math.max(pad, Math.min(pad + height - itemW, it.top));
    it.el.style.left = it.left + 'px';
    it.el.style.top = it.top + 'px';
    it.el.style.width = itemW + 'px';
    it.el.style.height = itemW + 'px';
  });
}

// --------------- Member selection and view ----------------

function selectMember(member) {
  // find freshest earned items for this member in EARNED
  const memberEarned = EARNED.filter(e => e.member_id === member.id).map(e => {
    const badge = BADGES.find(b=>b.id === e.badge_id) || {};
    return { name: badge.name || 'Unknown', file: (BADGE_IMAGES && BADGE_IMAGES.find(x=>x.badge_id===badge.id) && BADGE_IMAGES.find(x=>x.badge_id===badge.id).storage_path) || '', comment: e.comment, earned_at: e.earned_at, categories: badge.categories || [] };
  });

  // Populate selected area
  selectedContainer.classList.remove('hide');
  selectedContainer.setAttribute('aria-hidden', 'false');
  document.getElementById('float-stage').classList.add('hide');
  document.getElementById('selected-avatar').textContent = member.initials;
  document.getElementById('selected-avatar').style.background = member.avatar_color || '#555';
  document.getElementById('selected-name').textContent = member.display_name || member.initials;
  document.getElementById('selected-summary').textContent = `${memberEarned.length} badge${memberEarned.length===1?'':'s'} earned`;

  // show back button
  document.getElementById('back-to-team').classList.remove('hide');

  // stats
  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = '';
  const totalEarned = memberEarned.length;
  let lastBadge = '—', lastDate = null, totalStars = 0;
  memberEarned.forEach(e=>{ totalStars += (e.star || 1); if(e.earned_at){ const d = new Date(e.earned_at); if(!lastDate || d>lastDate){ lastDate=d; lastBadge=e.name; } }});
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

  // render earned row
  const earnedRow = document.getElementById('earned-row');
  const availableRow = document.getElementById('available-row');
  earnedRow.innerHTML = ''; availableRow.innerHTML = '';

  if (memberEarned.length === 0) {
    const empty = document.createElement('div'); empty.className='empty'; empty.textContent='No badges earned yet.'; earnedRow.appendChild(empty);
  } else {
    memberEarned.forEach(item => {
      const card = buildBadgeCard({ name: item.name, file: item.file, short: item.comment, categories: item.categories }, true);
      earnedRow.appendChild(card);
    });
  }

  // available badges: from BADGES filtered by eligibility
  const earnedSet = new Set(memberEarned.map(e=>e.name));
  BADGES.forEach(b => {
    if (!earnedSet.has(b.name)) {
      // determine eligible: if eligibility_type is 'everyone' or member is included in eligibility_user_ids
      let eligible = (b.eligibility_type === 'everyone');
      if (!eligible && b.eligibility_user_ids && b.eligibility_user_ids.length) {
        eligible = b.eligibility_user_ids.includes(member.id);
      }
      const card = buildBadgeCard({ name: b.name, file: (b.images && b.images[0] && b.images[0].storage_path) || '', short: b.description, categories: b.categories || [] }, false, eligible);
      availableRow.appendChild(card);
    }
  });

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

// Suggest modal handlers (local stub)
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

// escape html helper
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
