// Exports project public base and seed data used by app.js
export const PUBLIC_BASE = 'https://qnclxwwfapexijgpweja.supabase.co/storage/v1/object/public/badges';

export const BADGES = [
  { name: 'Firetruck', file: 'firetruck.png', short: 'Awarded for leading the CSSD brief and seeing it through to delivery.' },
  { name: 'MrSmith',   file: 'mrsmith.png',  short: 'Recognises calm, reliable delivery in tricky stakeholder situations.' },
  { name: 'Cowboy',    file: 'cowboy.png',   short: 'Acknowledges creative problem solving and willingness to take on a bold challenge.' },
];

export const MEMBERS = [
  { id:'m-jz', initials:'JZ', name:'JZ', color:'#b6561a', earned:[{name:'Firetruck', comment:'for the CSSD brief in October', star:1, earned_at:'2026-10-15'}] },
  { id:'m-jt', initials:'JT', name:'JT', color:'#007c96', earned:[] },
  { id:'m-bc', initials:'BC', name:'BC', color:'#ffc491', earned:[{name:'MrSmith', comment:'Well done', star:1, earned_at:'2026-09-12'}] },
  { id:'m-cr', initials:'CR', name:'CR', color:'#f3fdce', earned:[] },
  { id:'m-ss', initials:'SS', name:'SS', color:'#b6561a', earned:[] },
  { id:'m-km', initials:'KM', name:'KM', color:'#007c96', earned:[] },
];

export const ELIGIBILITY = {
  'Firetruck': ['JZ','BC'],
  'MrSmith': ['JZ','BC'],
  'Cowboy': ['JZ','BC']
};
