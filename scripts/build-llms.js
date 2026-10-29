// Builds llms.txt and llms-full.txt: plain-text guides to the site for AI tools (ChatGPT, Claude,
// Perplexity and the like), which mostly read raw HTML and never run the JavaScript that draws
// the monsters. Reads the same data the site shows: the CMS items in index.html and family.html,
// the new batch in js/new-monsters.js, the adopted list in js/piece-popup.js and the About story.
// Run after every CMS sync (the Sync from Webflow workflow does): node scripts/build-llms.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://popsy-neon.vercel.app';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const decode = s => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/[ \t]+/g, ' ').trim();

// run a page's item scripts the way the browser would, with just enough of a window
function itemsFrom(html) {
  const sandbox = { window: { items: [] }, decodeHTML: decode, document: {} };
  vm.createContext(sandbox);
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (!/window\.items\.push\(/.test(m[1])) continue;
    try { vm.runInContext(m[1], sandbox); } catch (e) { /* not an item block */ }
  }
  return sandbox.window.items;
}

const indexHtml = read('index.html');
const familyHtml = read('family.html');
const parentOf = {};
itemsFrom(familyHtml).forEach(i => { if (i.id && i.parent) parentOf[i.id] = i.parent; });

// the site's own list, plus the new batch (each steps aside once its CMS item exists)
const sandbox = { window: { items: itemsFrom(indexHtml) } };
vm.createContext(sandbox);
vm.runInContext(read('js/new-monsters.js'), sandbox);
const items = sandbox.window.items;

const adoptedSrc = read('js/piece-popup.js').match(/var ADOPTED = \[([^\]]*)\]/);
const ADOPTED = adoptedSrc ? adoptedSrc[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];

const nameOf = id => { const it = items.find(i => i.id === id); return it ? split(decode(it.name)).name : id; };
function split(full) {
  const m = full.match(/^(.*?)\s*[“"](.+?)[”"]\s*(.*)$/);
  if (!m) return { name: full.trim(), nick: '' };
  return { name: (m[1] + ' ' + m[3]).replace(/\s+/g, ' ').trim(), nick: m[2].trim() };
}
const FAMILIES = ['Dirtle', 'Glimmerwick', 'Roarborn'];

const monsters = items
  .filter(i => i.category === 'monsters' && i.id !== 'popsy-wolf' && decode(i.description))
  .map(i => {
    const { name, nick } = split(decode(i.name));
    const first = name.split(/\s+/)[0];
    return {
      id: i.id, name, nick,
      family: FAMILIES.find(f => name.includes(f)) || '',
      status: ADOPTED.includes(first) ? 'Adopted' : 'Available',
      bio: decode(i.description),
      size: decode(i.size), price: decode(i.price),
      parent: parentOf[i.id] || i.parent || ''
    };
  })
  .sort((a, b) => (FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family)) || a.name.localeCompare(b.name));

// the About story, in Brandon's words
const about = (indexHtml.match(/<div class="about-space">([\s\S]*?)<\/div>/) || [, ''])[1]
  .split(/<\/p>/).map(decode).filter(Boolean);

const count = monsters.length, available = monsters.filter(m => m.status === 'Available').length;
const line = m => `- ${m.name}${m.nick ? ` "${m.nick}"` : ''} (${m.family || 'no family'}, ${m.status.toLowerCase()})` +
  (m.parent && m.parent !== 'popsy-wolf' ? `, child of ${nameOf(m.parent)}` : m.parent === 'popsy-wolf' ? ', one of the first generation' : '');

const intro = [
  '# Popsy Loves You',
  '',
  '> Popsy Loves You is an art series by Brandon Kaufer, also known as Popsy Wolf: handmade ceramic (clay) monsters, each one a feeling we usually push down, like the anxious one, the sad one, or the one that just wants to play. Every monster has a name, a family and a story, and they are all looking for a home.',
  '',
  `- Artist: Brandon Kaufer (aka Popsy Wolf)`,
  `- Website: ${SITE}/`,
  `- Family tree: ${SITE}/family`,
  `- Monsters: ${count} (${available} available to adopt, ${count - available} adopted)`,
  `- Families: ${FAMILIES.join(', ')}. The family tree starts with Popsy and runs down through the generations.`,
  '- Adopting: open any available monster on the site and use Inquire to message Brandon.',
  '- Site design and build: RADCAT (https://radcat.design)',
  ''
];

const short = intro.concat([
  '## How it started',
  '',
  'Brandon took a ceramics class after his therapist told him to get a hobby. A piece he was making grew a face with an expression of pure panic, and within months he had a storage unit full of monsters. He realized they were the parts of himself that showed up every time he said "no problem", his grandfather\'s answer to everything. The series is about meeting those gremlins and turning them into friendly monsters.',
  '',
  '## The monsters',
  '',
  ...monsters.map(line),
  '',
  '## More',
  '',
  `- [Full guide with every monster's story](${SITE}/llms-full.txt)`,
  `- [Family tree](${SITE}/family)`,
  ''
]);

const full = intro.concat([
  '## About, in Brandon\'s words',
  '',
  ...about.map(p => p + '\n'),
  '## The monsters',
  '',
  ...monsters.flatMap(m => [
    `### ${m.name}${m.nick ? ` "${m.nick}"` : ''}`,
    '',
    `Family: ${m.family || 'none'}. Status: ${m.status}.` +
      (m.parent && m.parent !== 'popsy-wolf' ? ` Parent: ${nameOf(m.parent)}.` : m.parent === 'popsy-wolf' ? ' First generation.' : '') +
      (m.size ? ` Size: ${m.size}.` : '') + (m.price ? ` Price: ${m.price}.` : ''),
    '',
    m.bio,
    ''
  ])
]);

fs.writeFileSync(path.join(ROOT, 'llms.txt'), short.join('\n'));
fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), full.join('\n'));
console.log(`llms.txt: ${count} monsters (${available} available)`);
