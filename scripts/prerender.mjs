/**
 * Static pre-rendering for search engines.
 *
 * After `vite build`, this writes a real HTML page for every route (/explore/dns/, /protocols/, /simulator/ ...)
 * with its own title, description, canonical URL, structured data and readable body text, plus sitemap.xml,
 * llms.txt, robots.txt and a 404 fallback. React replaces the text when the app starts, so visitors still get the
 * interactive app; crawlers and no-JS readers get real content.
 */
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SITE = 'https://netpulse.itgg.space';
const today = new Date().toISOString().slice(0, 10);

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--seo:start-->')) throw new Error('index.html is missing the seo markers');

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { PROTOCOLS } = await server.ssrLoadModule('/src/protocols/index.ts');
const { PRESET_LABS } = await server.ssrLoadModule('/src/simulator/labs.ts');
await server.close();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[.,;:]$/, '') + '…');
const url = (p) => `${SITE}${p}`;

const CATEGORY_LABEL = { core: 'Core protocols', application: 'Application protocols', security: 'Security protocols' };
const byCategory = PROTOCOLS.reduce((acc, p) => ((acc[p.category] ??= []).push(p), acc), {});

/* ───────────── head ───────────── */
function head({ title, description, path: p, type = 'article', schema }) {
  const t = esc(title);
  const d = esc(description);
  const u = url(p);
  const graph = JSON.stringify({ '@context': 'https://schema.org', '@graph': schema }, null, 2).replace(/</g, '\\u003c');
  return `<title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${u}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:site_name" content="NetPulse" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="NetPulse: a DNS packet travelling from a client through a router to a server." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <script type="application/ld+json">
${graph}
    </script>`;
}

const AUTHOR = {
  '@type': 'Person',
  '@id': `${SITE}/#author`,
  name: 'Geevarghese K Thomas',
  url: `${SITE}/about/`,
  sameAs: ['https://github.com/geevarghesekthomas84-sys'],
};
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'NetPulse', inLanguage: 'en', publisher: { '@id': `${SITE}/#author` } };

const breadcrumb = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url(p) })),
});

/* ───────────── bodies ───────────── */
const crumbs = (items) =>
  `<nav aria-label="Breadcrumb">${items.map(([n, p]) => (p ? `<a href="${p}">${esc(n)}</a>` : esc(n))).join(' › ')}</nav>`;

const shell = (inner) => `<main class="seo-shell">${inner}</main>`;
const protoLink = (p) => `<a href="/explore/${p.id}/">${esc(p.name)}</a>`;
const footerLinks = `<p><a href="/">Home</a> · <a href="/protocols/">All protocols</a> · <a href="/simulator/">Network simulator</a> · <a href="/learn/">Quizzes</a> · <a href="/about/">About</a></p>`;

function protocolBody(p) {
  const related = (byCategory[p.category] ?? []).filter((x) => x.id !== p.id).slice(0, 6);
  const facts = [
    ['OSI layer', p.layer],
    ['Default port', p.defaultPort],
    ['Transport', p.transport],
    ['Data format', p.dataFormat],
    ...(p.methods.length ? [['Common methods', p.methods.join(', ')]] : []),
  ];
  let sc = null;
  try {
    sc = p.scenario({ seed: 42 });
  } catch {
    sc = null;
  }
  const devices = sc ? `<h2>Devices in the ${esc(p.name)} exchange</h2><ul>${sc.nodes.map((n) => `<li><strong>${esc(n.label)}</strong> (${esc(String(n.role).replace(/_/g, ' '))}${n.ip ? `, ${esc(n.ip)}` : ''})</li>`).join('')}</ul>` : '';
  const wire = sc
    ? `<h2>What ${esc(p.name)} looks like on the wire</h2><p>This is the packet sequence NetPulse replays for a typical ${esc(p.name)} exchange. Open the animation to inspect each one.</p><ol>${sc.packets.slice(0, 24).map((k) => `<li>${esc(k.protocol)} from ${esc(k.srcIp || k.srcMac)} to ${esc(k.dstIp || k.dstMac)}: ${esc(k.info)} (${esc(k.sizeBytes)} bytes)</li>`).join('')}</ol>`
    : '';
  const rfcs = p.rfcs.length ? `<p>Specifications: ${p.rfcs.map((r) => `<a href="${esc(r.url)}" rel="noopener">${esc(r.number)}: ${esc(r.title)}</a>`).join('; ')}.</p>` : '';
  return shell(`
${crumbs([['NetPulse', '/'], ['Protocols', '/protocols/'], [p.name, null]])}
<h1>${esc(p.name)} (${esc(p.fullName)}): how it works, step by step</h1>
<p>${esc(p.description)}</p>
<p><a href="/explore/${p.id}/"><strong>Open the interactive ${esc(p.name)} animation</strong></a> to watch each packet move and inspect its headers.</p>
<h2>${esc(p.name)} explained simply</h2>
<p>${esc(p.eli5)}</p>
<h2>${esc(p.name)} at a glance</h2>
<table><tbody>${facts.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
${rfcs}
${devices}
<h2>How ${esc(p.name)} works, step by step</h2>
<ol>${p.steps.map((s) => `<li><h3>${esc(s.title)}</h3><p><em>${esc(s.subtitle)}.</em> ${esc(s.caption)}</p></li>`).join('')}</ol>
${wire}
${
  p.securityNotes.length
    ? `<h2>${esc(p.name)} security notes</h2><ul>${p.securityNotes.map((n) => `<li><strong>${esc(n.attack)}.</strong> ${esc(n.description)} <em>Defense:</em> ${esc(n.defense)}</li>`).join('')}</ul>`
    : ''
}
${
  p.quiz.length
    ? `<h2>Test yourself on ${esc(p.name)}</h2>${p.quiz.map((q) => `<h3>${esc(q.question)}</h3><p><strong>Answer:</strong> ${esc(q.options[q.correctIndex])}. ${esc(q.explanation)}</p>`).join('')}`
    : ''
}
<h2>Related protocols</h2>
<ul>${related.map((r) => `<li>${protoLink(r)}: ${esc(r.fullName)}</li>`).join('')}</ul>
${footerLinks}`);
}

function hubBody() {
  return shell(`
${crumbs([['NetPulse', '/'], ['Protocols', null]])}
<h1>${PROTOCOLS.length} internet protocols, explained with live packets</h1>
<p>Pick a protocol to see how it works step by step: every message that crosses the wire, what is inside it, and what can go wrong. Each page has a plain-English explanation, the full step-by-step exchange, security notes and a short quiz, plus an interactive animation you can play.</p>
${Object.entries(byCategory)
  .map(
    ([cat, list]) => `<h2>${esc(CATEGORY_LABEL[cat] ?? cat)}</h2><ul>${list.map((p) => `<li>${protoLink(p)}: ${esc(p.fullName)}, ${esc(clip(p.description, 110))}</li>`).join('')}</ul>`
  )
  .join('')}
${footerLinks}`);
}

function homeBody() {
  return shell(`
<h1>NetPulse: watch the internet work, then build your own network</h1>
<p>NetPulse is a free, interactive way to learn how computer networks work. Watch real protocol exchanges packet by packet, inspect every byte, and build and break networks in a Packet Tracer-style simulator. It runs in your browser with no sign-up and no tracking, in English, Spanish, Arabic, Hindi, Malayalam and Tamil.</p>
<h2>What you can do</h2>
<ul>
<li><strong>Explore ${PROTOCOLS.length} protocols.</strong> DNS, TCP, TLS, HTTP, BGP, DHCP and more, as step-by-step animations with plain-English notes. See <a href="/protocols/">all protocols</a>.</li>
<li><strong>Inspect packets.</strong> A Wireshark-style inspector shows headers, flags and a colour-coded hex dump. You can also open your own .pcap files locally.</li>
<li><strong>Build networks.</strong> Cable routers, switches and PCs in the <a href="/simulator/">network simulator</a>, configure them from an IOS-style command line, and send test packets.</li>
<li><strong>Practise.</strong> ${PRESET_LABS.length} guided labs, quizzes, troubleshooting challenges and a daily streak in <a href="/learn/">Learn</a>.</li>
</ul>
<h2>Popular protocols</h2>
<ul class="cols">${['http', 'dns', 'tcp', 'tls', 'dhcp', 'bgp', 'udp', 'ip', 'icmp', 'ssh']
    .map((id) => PROTOCOLS.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => `<li>${protoLink(p)}: ${esc(p.fullName)}</li>`)
    .join('')}</ul>
<p>NetPulse is open source and made by <a href="/about/">Geevarghese K Thomas</a>.</p>
${footerLinks}`);
}

function simulatorBody() {
  return shell(`
${crumbs([['NetPulse', '/'], ['Network simulator', null]])}
<h1>Network simulator: a Packet Tracer-style workbench in your browser</h1>
<p>Drag routers, switches, PCs, servers and firewalls onto a canvas, cable them together and watch traffic flow. Every device behaves like the real thing, and changes you make from the command line take effect immediately.</p>
<h2>What the simulator can do</h2>
<ul>
<li><strong>IOS-style command line.</strong> User, privileged and configuration modes, <code>?</code> help, tab completion and <code>no</code> forms. Configure interfaces, VLANs, static routes, OSPF, RIP and BGP with <code>network</code> statements, NAT and access lists, and read results with <code>show ip route</code>, <code>show vlan brief</code>, <code>show running-config</code> and more.</li>
<li><strong>DHCP.</strong> Servers on routers or dedicated hosts, relay across routers with <code>ip helper-address</code>, and a PC desktop with IP configuration.</li>
<li><strong>Test packets (PDUs).</strong> Send ICMP, TCP or UDP between any two devices and follow every event hop by hop.</li>
<li><strong>Troubleshooting.</strong> Shut an interface, cut a cable or add a firewall rule and see what breaks.</li>
</ul>
<h2>${PRESET_LABS.length} guided labs</h2>
<ol>${PRESET_LABS.map((l) => `<li><strong>${esc(l.title)}</strong> (${esc(l.category)}): ${esc(l.description)}</li>`).join('')}</ol>
<p><a href="/simulator/">Open the simulator</a> to try it. It needs JavaScript.</p>
${footerLinks}`);
}

function learnBody() {
  return shell(`
${crumbs([['NetPulse', '/'], ['Learn', null]])}
<h1>Learn networking: quizzes, games and troubleshooting challenges</h1>
<p>Test what you know about the protocols you explored. Every protocol has a short quiz, missed questions come back in a review round, and a daily streak keeps you practising.</p>
<ul>
<li><strong>Protocol quizzes</strong> on all ${PROTOCOLS.length} protocols, plus a mixed ten-question challenge.</li>
<li><strong>Port and packet games.</strong> Match ports to protocols and put handshake packets in order.</li>
<li><strong>Break it.</strong> A network that used to work is broken; investigate with real commands and fix it.</li>
<li><strong>Tools.</strong> A subnet calculator, an OSI versus TCP/IP reference and a glossary.</li>
</ul>
<h2>Start with a protocol</h2>
<ul class="cols">${PROTOCOLS.map((p) => `<li>${protoLink(p)}</li>`).join('')}</ul>
${footerLinks}`);
}

function aboutBody() {
  return shell(`
${crumbs([['NetPulse', '/'], ['About', null]])}
<h1>About NetPulse</h1>
<p>NetPulse is a free learning tool that makes computer networking visible. It was built by <strong>Geevarghese K Thomas</strong> so that students, teachers and engineers can watch protocols work, inspect real packets and practise network configuration without installing anything.</p>
<h2>Who it is for</h2>
<p>Students preparing for Network+ or CCNA, teachers who want a shareable link for each protocol, and anyone curious about how the internet works.</p>
<h2>Privacy</h2>
<p>NetPulse runs entirely in your browser. There are no accounts, no analytics and no tracking. Your settings and progress are stored only on your own device, and any .pcap file you open is read locally and never uploaded.</p>
<h2>Open source and contact</h2>
<p>The source code is on <a href="https://github.com/geevarghesekthomas84-sys/NetPulse" rel="noopener">GitHub</a> under the Apache 2.0 licence. To report a problem or suggest a protocol, open an issue there.</p>
${footerLinks}`);
}

/* ───────────── write pages ───────────── */
const pages = [];
function writePage(p, { title, description, body, schema, type }) {
  const seo = head({ title, description, path: p, type, schema });
  let html = template.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n    ${seo}\n    <!--seo:end-->`);
  html = html.replace('<!--seo:body-->', body);
  const file = p === '/' ? path.join(dist, 'index.html') : path.join(dist, p.replace(/^\//, ''), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  pages.push({ path: p, title, description });
}

const webPage = (p, name, description, extra = {}) => ({
  '@type': ['WebPage', 'LearningResource'],
  '@id': `${url(p)}#page`,
  url: url(p),
  name,
  description,
  inLanguage: 'en',
  image: `${SITE}/og.png`,
  isPartOf: { '@id': `${SITE}/#website` },
  author: { '@id': `${SITE}/#author` },
  dateModified: today,
  ...extra,
});

// home keeps the hand-written head in index.html but gets the readable body
{
  let html = template.replace('<!--seo:body-->', homeBody());
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  pages.push({ path: '/' });
}

writePage('/protocols/', {
  title: `${PROTOCOLS.length} Internet Protocols Explained | NetPulse`,
  description: `Step-by-step animations and plain-English explanations of ${PROTOCOLS.length} internet protocols, from Ethernet and IP to DNS, TLS and BGP.`,
  body: hubBody(),
  schema: [WEBSITE, AUTHOR, webPage('/protocols/', 'Internet protocols explained', `All ${PROTOCOLS.length} protocols on NetPulse.`, { teaches: 'Internet protocols' }), breadcrumb([['NetPulse', '/'], ['Protocols', '/protocols/']])],
});

for (const p of PROTOCOLS) {
  const pth = `/explore/${p.id}/`;
  const title = clip(`${p.name} Explained: Step-by-Step Packet Animation`, 52) + ' | NetPulse';
  const first = p.description.split(/(?<=[.!?])\s/)[0];
  const cut = clip(first, 112).replace(/…$/, '').replace(/\s*\([^)]*$/, '').replace(/[.,;:\s]+$/, '');
  const description = `${cut}. Watch every packet, free.`;
  writePage(pth, {
    title,
    description,
    body: protocolBody(p),
    schema: [
      WEBSITE,
      AUTHOR,
      webPage(pth, `${p.name} (${p.fullName}) explained`, p.description, { teaches: `How ${p.name} works`, keywords: (p.keywords ?? []).join(', '), learningResourceType: 'interactive simulation' }),
      breadcrumb([['NetPulse', '/'], ['Protocols', '/protocols/'], [p.name, pth]]),
    ],
  });
}

writePage('/simulator/', {
  title: 'Network Simulator: Packet Tracer-Style Online | NetPulse',
  description: 'Build and break networks in your browser: IOS-style CLI, VLANs, OSPF/RIP/BGP, NAT, DHCP, test packets and 20 guided labs. Free, no install.',
  body: simulatorBody(),
  schema: [WEBSITE, AUTHOR, webPage('/simulator/', 'NetPulse network simulator', 'A Packet Tracer-style network simulator that runs in the browser.', { teaches: 'Configuring and troubleshooting computer networks' }), breadcrumb([['NetPulse', '/'], ['Network simulator', '/simulator/']])],
});

writePage('/learn/', {
  title: 'Networking Quizzes, Games and Challenges | NetPulse',
  description: `Quizzes on ${PROTOCOLS.length} protocols, port and packet games, "Break it" troubleshooting challenges, a subnet calculator and a daily streak.`,
  body: learnBody(),
  schema: [WEBSITE, AUTHOR, webPage('/learn/', 'Learn networking with NetPulse', 'Quizzes, games and challenges for networking.', { teaches: 'Computer networking' }), breadcrumb([['NetPulse', '/'], ['Learn', '/learn/']])],
});

writePage('/about/', {
  title: 'About NetPulse: Who Made It and How It Works | NetPulse',
  description: 'NetPulse is a free, open-source networking learning tool by Geevarghese K Thomas. No accounts, no tracking; everything runs in your browser.',
  body: aboutBody(),
  type: 'website',
  schema: [WEBSITE, AUTHOR, { '@type': 'AboutPage', '@id': `${url('/about/')}#page`, url: url('/about/'), name: 'About NetPulse', isPartOf: { '@id': `${SITE}/#website` }, author: { '@id': `${SITE}/#author` } }, breadcrumb([['NetPulse', '/'], ['About', '/about/']])],
});

// 404: the same app shell (so deep links the app understands still load), kept out of the index
{
  let html = template.replace('<!--seo:body-->', homeBody()).replace('<!--seo:start-->', '<!--seo:start-->\n    <meta name="robots" content="noindex" />');
  fs.writeFileSync(path.join(dist, '404.html'), html);
}

/* ───────────── sitemap, llms.txt, robots ───────────── */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map((p) => `  <url><loc>${url(p.path)}</loc><lastmod>${today}</lastmod><changefreq>${p.path.startsWith('/explore/') ? 'monthly' : 'weekly'}</changefreq><priority>${p.path === '/' ? '1.0' : p.path === '/protocols/' || p.path === '/simulator/' ? '0.9' : p.path.startsWith('/explore/') ? '0.8' : '0.6'}</priority></url>`)
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);

const llms = `# NetPulse

> Free, interactive way to learn how computer networks work: step-by-step animations of ${PROTOCOLS.length} internet protocols, a Wireshark-style packet inspector, and a Packet Tracer-style network simulator. Runs in the browser, no accounts or tracking. Made by Geevarghese K Thomas, open source (Apache 2.0).

## Main pages
- [Home](${SITE}/): overview of NetPulse
- [All protocols](${SITE}/protocols/): index of every protocol page
- [Network simulator](${SITE}/simulator/): IOS-style CLI, VLANs, routing protocols, DHCP, ${PRESET_LABS.length} labs
- [Learn](${SITE}/learn/): quizzes, games and troubleshooting challenges
- [About](${SITE}/about/): author, privacy and source code

## Protocols
${PROTOCOLS.map((p) => `- [${p.name}](${SITE}/explore/${p.id}/): ${p.fullName}`).join('\n')}

## Source
- [GitHub repository](https://github.com/geevarghesekthomas84-sys/NetPulse)
`;
fs.writeFileSync(path.join(dist, 'llms.txt'), llms);

fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`prerendered ${pages.length} pages + 404, sitemap.xml, llms.txt, robots.txt`);
