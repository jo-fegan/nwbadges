// src/app.js - full replacement
// IMPORTANT:
// - Set SUPABASE_URL to your project URL.
// - Your bucket is public and named "badges", which matches the BUCKET_NAME below.
// - The app expects your public views: members_public, badges_public, earned_public.
// - For direct browser reads, store the anon key in localStorage:
//   localStorage.setItem('supabase_anon', 'sb_publishable_...');

const SUPABASE_URL = 'https://qnclxwwfapexijgpweja.supabase.co';
let SUPABASE_ANON_KEY = localStorage.getItem('supabase_anon') || '';
const BUCKET_NAME = 'badges';

const TABLES = {
  members: 'members_public',
  badges: 'badges_public',
  badge_images: 'badge_images',
  earned: 'earned_public'
};

const THEME_KEY = 'nwbadges_theme_v1';

function fetchHeaders() {
  const h = { Accept: 'application/json' };
  if (SUPABASE_ANON_KEY) {
    h['apikey'] = SUPABASE_ANON_KEY;
    h['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
  }
  return h;
}

async function fetchTable(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  try {
    const res = await fetch(url, { headers: fetchHeaders() });
    if (!res.ok) {
      const txt = await res.text();
      console.warn('Fetch failed', url, res.status, txt);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn('Fetch error', url, e);
    return [];
  }
}

function publicUrl(storagePath) {
  if (!storagePath) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(storagePath)}`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function el(id) {
  return document.getElementById(id);
}

function onIfExists(id, ev, handler) {
  const e = el(id);
  if (e) e.addEventListener(ev, handler);
  return e;
}

// Theme handling; shows the action, not the current state
function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  const toggle = el('theme-toggle');
  if (toggle) {
    toggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function toggleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || 'light';
  localStorage.setItem(THEME_KEY, cur === 'dark' ? 'light' : 'dark');
  applyTheme();
}

let MEMBERS = [];
let BADGES = [];
let BADGE_IMAGES = [];
let EARNED = [];
let floatEls = [];
let movementTimer = null;

async function init() {
  try {
    applyTheme();

    [MEMBERS, BADGES, BADGE_IMAGES, EARNED] = await Promise.all([
      fetchTable(TABLES.members, '?select=id,initials,display_name,avatar_color&order=initials'),
      fetchTable(TABLES.badges, '?select=id,name,description,categories,eligibility_type,eligibility_user_ids,created_at'),
      fetchTable(TABLES.badge_images, '?select=badge_id,storage_path,format,width,height'),
      fetchTable(TABLES.earned, '?select=id,member_id,badge_id,earned_at,comment,star_count&order=earned_at.desc&limit=50')
    ]);

    const imagesByBadge = {};
    (BADGE_IMAGES || []).forEach(bi => {
      if (!bi || !bi.badge_id) return;
      imagesByBadge[bi.badge_id] = imagesByBadge[bi.badge_id] || [];
      imagesByBadge[bi.badge_id].push(bi);
    });

    (BADGES || []).forEach(b => {
      b.images = imagesByBadge[b.id] || [];
    });

    const membersById = Object.fromEntries((MEMBERS || []).map(m => [m.id, m]));
    const badgesById = Object.fromEntries((BADGES || []).map(b => [b.id, b]));

    (EARNED || []).forEach(e => {
      e.member = membersById[e.member_id] || null;
      e.badge = badgesById[e.badge_id] || null;
    });

    renderRecent();
    renderAllBadges();
    renderFloatingMembers();
    verifyBadgeImages();
  } catch (err) {
    console.error('Init error', err);
  }
}

function renderRecent() {
  const root = el('recent-list');
  if (!root) return;
  root.innerHTML = '';

  if (!EARNED || EARNED.length === 0) {
    root.textContent = 'No recent activity yet.';
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '8px';

  EARNED.slice(0, 20).forEach(r => {
    const row = document.createElement('div');
    row.className = 'muted';
    const when = r.earned_at ? new Date(r.earned_at).toLocaleDateString() : '';
    const memberInitial = r.member ? escapeHtml(r.member.initials) : 'Unknown';
    const badgeName = r.badge ? escapeHtml(r.badge.name) : 'Unknown badge';
    row.innerHTML = `<div><strong>${memberInitial}</strong> earned <strong>${badgeName}</strong> ${when}</div>`;
    wrap.appendChild(row);
  });

  root.appendChild(wrap);
}

function renderAllBadges() {
  const root = el('all-badges');
  if (!root) return;
  root.innerHTML = '';

  if (!BADGES || BADGES.length === 0) {
    root.textContent = 'No badges found.';
    return;
  }

  BADGES.forEach(b => {
    const card = buildBadgeCard({
      id: b.id,
      name: b.name,
      file: (b.images && b.images[0] && b.images[0].storage_path) || '',
      short: b.description || '',
      categories: b.categories || []
    }, false, true, { showOnlyDescription: true });
    root.appendChild(card);
  });
}

function buildBadgeCard(item, earned = false, eligible = true, opts = {}) {
  const card = document.createElement('div');
  card.className = 'badge-card ' + (earned ? 'earned' : 'unearned');

  if (item.file) {
    const img = document.createElement('img');
    img.src = publicUrl(item.file);
    img.alt = item.name || '';
    img.addEventListener('error', () => {
      console.warn('Badge image failed to load:', img.src);
      img.style.display = 'none';
    });
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.width = '88px';
    placeholder.style.height = '88px';
    placeholder.style.borderRadius = '8px';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.textContent = '—';
    card.appendChild(placeholder);
  }

  const name = document.createElement('div');
  name.className = 'badge-name';
  name.textContent = item.name;
  card.appendChild(name);

  const extra = document.createElement('div');
  extra.className = 'badge-desc';

  if (opts.showOnlyDescription) {
    extra.textContent = item.short || '';
  } else {
    extra.textContent = item.short || (earned ? 'Earned badge.' : (eligible ? 'Ready to earn.' : 'Not eligible.'));
  }

  card.appendChild(extra);
  card.addEventListener('click', () => populateBadgeDescription(item));
  return card;
}

function populateBadgeDescription(item) {
  const box = el('badge-description');
  if (!box) return;
  if (!item) {
    box.textContent = 'Select a badge to view its description.';
    return;
  }
  const cats = (item.categories && item.categories.length) ? '[' + item.categories.join(', ') + '] ' : '';
  box.textContent = cats + (item.short || 'No description available.');
}

function getFloatItemSize() {
  const w = window.innerWidth;
  if (w < 420) return 52;
  if (w < 900) return 64;
  return 72;
}

function renderFloatingMembers() {
  const stage = el('float-stage');
  if (!stage) return;

  stage.innerHTML = '';
  floatEls = [];

  if (!MEMBERS || MEMBERS.length === 0) return;

  const pad = 12;
  const itemW = getFloatItemSize();
  const area = stage.getBoundingClientRect();
  const width = Math.max(220, area.width - pad * 2);
  const height = Math.max(220, area.height - pad * 2);

  function overlaps(x, y) {
    for (const it of floatEls) {
      const dx = it.left - x;
      const dy = it.top - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < (itemW + 8)) return true;
    }
    return false;
  }

  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i];
    const div = document.createElement('div');
    div.className = 'float-item';
    div.style.width = itemW + 'px';
    div.style.height = itemW + 'px';
    div.style.borderRadius = '50%';
    div.style.background = m.avatar_color || '#888';
    div.style.color = '#fff';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.fontWeight = '800';
    div.innerHTML = `<div class="initial">${escapeHtml(m.initials || m.display_name || '')}</div>`;
    div.title = m.display_name || m.initials;
    div.addEventListener('click', () => selectMember(m));
    stage.appendChild(div);

    let attempts = 0;
    let left = 0;
    let top = 0;

    do {
      left = pad + Math.random() * (width - itemW);
      top = pad + Math.random() * (height - itemW);
      attempts++;
      if (attempts > 600) break;
    } while (overlaps(left, top));

    floatEls.push({ el: div, member: m, left, top });
    div.style.left = left + 'px';
    div.style.top = top + 'px';
  }

  startMovementLoop();
}

function startMovementLoop() {
  if (movementTimer) clearInterval(movementTimer);

  movementTimer = setInterval(() => {
    if (!floatEls || floatEls.length === 0) return;
    const stage = el('float-stage');
    if (!stage) return;

    const pad = 12;
    const itemW = getFloatItemSize();
    const area = stage.getBoundingClientRect();
    const width = Math.max(220, area.width - pad * 2);
    const height = Math.max(220, area.height - pad * 2);

    for (const it of floatEls) {
      let attempts = 0;
      let nx = it.left;
      let ny = it.top;

      do {
        const maxShift = 24;
        nx = Math.max(pad, Math.min(pad + width - itemW, it.left + (Math.random() * 2 - 1) * maxShift));
        ny = Math.max(pad, Math.min(pad + height - itemW, it.top + (Math.random() * 2 - 1) * maxShift));
        attempts++;
        if (attempts > 300) break;

        let coll = false;
        for (const other of floatEls) {
          if (other === it) continue;
          const dx = other.left - nx;
          const dy = other.top - ny;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (itemW + 8)) { coll = true; break; }
        }
        if (!coll) break;
      } while (true);

      it.left = nx;
      it.top = ny;
      it.el.style.left = nx + 'px';
      it.el.style.top = ny + 'px';
      it.el.style.transform = `rotate(${(Math.random() * 6 - 3)}deg)`;
      setTimeout(() => {
        it.el.style.transform = 'rotate(0deg)';
      }, 1400);
    }
  }, 3500);
}

function positionAllFloatElements(keepRelative = false) {
  if (!floatEls || floatEls.length === 0) return;
  if (!keepRelative) {
    renderFloatingMembers();
    return;
  }

  const stage = el('float-stage');
  if (!stage) return;

  const pad = 12;
  const itemW = getFloatItemSize();
  const width = Math.max(220, stage.clientWidth - pad * 2);
  const height = Math.max(220, stage.clientHeight - pad * 2);

  floatEls.forEach(it => {
    it.left = Math.max(pad, Math.min(pad + width - itemW, it.left));
    it.top = Math.max(pad, Math.min(pad + height - itemW, it.top));
    it.el.style.left = it.left + 'px';
    it.el.style.top = it.top + 'px';
    it.el.style.width = itemW + 'px';
    it.el.style.height = itemW + 'px';
  });
}

function selectMember(member) {
  if (!member) return;

  const selected = el('selected-container');
  const stage = el('float-stage');
  if (!selected) return;

  const memberEarned = (EARNED || []).filter(e => e.member_id === member.id).map(e => {
    const badge = (BADGES || []).find(b => b.id === e.badge_id) || {};
    const image = (badge.images && badge.images[0] && badge.images[0].storage_path) || '';
    return {
      id: e.id,
      name: badge.name || 'Unknown',
      file: image,
      comment: e.comment,
      earned_at: e.earned_at,
      categories: badge.categories || [],
      star: e.star_count || 1
    };
  });

  selected.classList.remove('hide');
  selected.setAttribute('aria-hidden', 'false');

  if (stage) stage.classList.add('hide');

  const avatar = el('selected-avatar');
  if (avatar) {
    avatar.textContent = member.initials;
    avatar.style.background = member.avatar_color || '#555';
  }

  const nameEl = el('selected-name');
  if (nameEl) nameEl.textContent = member.display_name || member.initials;

  const summaryEl = el('selected-summary');
  if (summaryEl) summaryEl.textContent = `${memberEarned.length} badge${memberEarned.length === 1 ? '' : 's'} earned`;

  const backBtn = el('back-to-team');
  if (backBtn) backBtn.classList.remove('hide');

  const statsGrid = el('stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = '';
    let totalStars = 0;
    memberEarned.forEach(e => totalStars += (e.star || 1));
    const statList = [
      { label: 'Total badges', value: String(memberEarned.length) },
      { label: 'Stars awarded', value: String(totalStars) }
    ];

    statList.forEach(stat => {
      const div = document.createElement('div');
      div.className = 'stat';
      div.innerHTML = `<strong>${stat.label}</strong><div>${stat.value}</div>`;
      statsGrid.appendChild(div);
    });
  }

  const earnedRow = el('earned-row');
  const availableRow = el('available-row');
  if (!earnedRow || !availableRow) return;

  earnedRow.innerHTML = '';
  availableRow.innerHTML = '';

  const allCategories = new Set();
  (BADGES || []).forEach(b => (b.categories || []).forEach(c => allCategories.add(c)));
  const cats = Array.from(allCategories).filter(Boolean).sort();

  const renderList = (items, row, mode) => {
    const filtersHolder = document.createElement('div');
    filtersHolder.className = 'filters';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = 'All';
    filtersHolder.appendChild(allBtn);

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = cat;
      filtersHolder.appendChild(btn);
    });

    row.appendChild(filtersHolder);

    const list = document.createElement('div');
    list.className = 'hrow';
    list.style.flexWrap = 'wrap';
    list.style.marginTop = '8px';
    row.appendChild(list);

    const applyFilter = (sel) => {
      filtersHolder.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === sel);
      });

      list.innerHTML = '';

      let visible = items.slice();
      if (sel !== 'All') {
        visible = visible.filter(it => (it.categories || []).includes(sel));
      }

      if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No badges in this category.';
        list.appendChild(empty);
        return;
      }

      visible.forEach(it => {
        const card = document.createElement('div');
        card.className = 'badge-card ' + (mode === 'earned' ? 'earned' : 'unearned');

        if (it.file) {
          const img = document.createElement('img');
          img.src = publicUrl(it.file);
          img.alt = it.name || '';
          img.addEventListener('error', () => {
            console.warn('Badge image failed to load:', img.src);
            img.style.display = 'none';
          });
          card.appendChild(img);
        } else {
          const p = document.createElement('div');
          p.style.width = '88px';
          p.style.height = '88px';
          p.style.borderRadius = '8px';
          p.style.display = 'flex';
          p.style.alignItems = 'center';
          p.style.justifyContent = 'center';
          p.textContent = '—';
          card.appendChild(p);
        }

        const name = document.createElement('div');
        name.className = 'badge-name';
        name.textContent = it.name;
        card.appendChild(name);

        const desc = document.createElement('div');
        desc.className = 'badge-desc';

        if (mode === 'earned') {
          const comment = it.comment ? escapeHtml(it.comment) : '';
          const dateText = it.earned_at ? new Date(it.earned_at).toLocaleDateString() : '';
          desc.innerHTML = `${comment} <div style="font-size:12px;color:var(--muted)">${dateText}</div>`;
        } else {
          desc.textContent = it.description || '';
        }

        card.appendChild(desc);
        list.appendChild(card);
      });
    };

    filtersHolder.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => applyFilter(btn.textContent));
    });

    applyFilter('All');
  };

  renderList(memberEarned, earnedRow, 'earned');

  const earnedNames = new Set(memberEarned.map(e => e.name));
  const availableBadges = (BADGES || []).filter(b => !earnedNames.has(b.name)).map(b => ({
    id: b.id,
    name: b.name,
    file: (b.images && b.images[0] && b.images[0].storage_path) || '',
    description: b.description || '',
    categories: b.categories || []
  }));

  renderList(availableBadges, availableRow, 'available');
  populateBadgeDescription(null);
}

async function verifyBadgeImages() {
  if (!BADGE_IMAGES || BADGE_IMAGES.length === 0) return;

  for (const item of BADGE_IMAGES) {
    if (!item || !item.storage_path) continue;
    const url = publicUrl(item.storage_path);
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log('Image HEAD', url, res.status);
    } catch (e) {
      console.warn('Image verify HEAD failed', url, e);
      try {
        const r = await fetch(url);
        console.log('Image GET fallback', url, r.status);
      } catch (err) {
        console.error('Image verify GET failed', url, err);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  onIfExists('theme-toggle', 'click', toggleTheme);

  onIfExists('suggest-btn', 'click', () => {
    const modal = el('suggest-modal');
    if (modal) modal.classList.remove('hide');
  });

  onIfExists('s-cancel', 'click', () => {
    const modal = el('suggest-modal');
    if (modal) modal.classList.add('hide');
  });

  onIfExists('s-submit', 'click', () => {
    const nameInput = el('s-name');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) {
      alert('Please enter a name');
      return;
    }
    const key = 'nwbadges_local_suggestions';
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    cur.push({
      name,
      desc: el('s-desc')?.value || '',
      at: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(cur));
    alert('Saved locally.');
    const modal = el('suggest-modal');
    if (modal) modal.classList.add('hide');
  });

  const backBtn = el('back-to-team');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const selected = el('selected-container');
      const stage = el('float-stage');
      if (selected) selected.classList.add('hide');
      if (selected) selected.setAttribute('aria-hidden', 'true');
      if (stage) stage.classList.remove('hide');
      if (backBtn) backBtn.classList.add('hide');
      renderFloatingMembers();
    });
  }

  init();
});

window.addEventListener('resize', () => {
  positionAllFloatElements(true);
});

window._nw = { MEMBERS, BADGES, BADGE_IMAGES, EARNED, publicUrl, verifyBadgeImages };
