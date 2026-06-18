// /api/wiki-scorers.js
// Vercel serverless function — Wikipedia-র "2026 FIFA World Cup Group X" পেজের
// raw wikitext থেকে {{footballbox}} template parse করে গোলদাতা+মিনিট বের করে।
// সম্পূর্ণ ফ্রি, কোনো API key লাগে না, official MediaWiki Action API ব্যবহার করে
// (scraping নয় — এটা Wikipedia-র documented, public API)।
//
// Usage: /api/wiki-scorers?group=A  (A থেকে L)
//
// in-memory cache — ৫ মিনিট (ম্যাচ শেষ হওয়ার পর Wikipedia editor রা সাধারণত
// কিছুক্ষণের মধ্যে আপডেট করেন, ঘন ঘন hit করার দরকার নেই)
const cache = new Map(); // group -> { data, ts }
const CACHE_MS = 5 * 60 * 1000;

function decodeEntities(s) {
  return (s || "")
    .replace(/&#x27;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

// "[[Samuel Eto'o| Eto'o]] {{goal| 10}}<br />[[Lionel Messi| Messi]] {{goal| 70}}"
// থেকে [{scorer:"Eto'o", minute:10}, {scorer:"Messi", minute:70}] বের করে
function parseGoalsField(raw) {
  if (!raw) return [];
  const text = decodeEntities(raw);
  const out = [];
  // প্রতিটা [[...]] লিংক এবং তার পরের {{goal|...}} বা {{pen|...}} বা {{og|...}} ধরবো
  const linkRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const segments = text.split(/<br\s*\/?>/i);
  for (const seg of segments) {
    const links = [...seg.matchAll(linkRe)];
    if (links.length === 0) continue;
    // শেষ লিংকটাই সাধারণত player name (প্রথমটা club/flag হতে পারে)
    const last = links[links.length - 1];
    let scorer = (last[2] || last[1] || "").trim();
    scorer = scorer.replace(/^\s*/, "").trim();
    if (!scorer) continue;
    const minuteMatches = [...seg.matchAll(/\{\{\s*(goal|pen|og|own goal)\s*\|\s*(\d+)/gi)];
    const isPen = /\{\{\s*pen\s*\|/i.test(seg);
    const isOg = /\{\{\s*og\s*\|/i.test(seg) || /own goal/i.test(seg);
    if (minuteMatches.length === 0) {
      out.push({ scorer, minute: null, pen: isPen, og: isOg });
    } else {
      for (const mm of minuteMatches) {
        out.push({ scorer, minute: +mm[2], pen: isPen, og: isOg });
      }
    }
  }
  return out;
}

// একটা পেজের wikitext-এর ভেতর থাকা সব {{footballbox ... }} ব্লক বের করে
function extractFootballboxes(wikitext) {
  const boxes = [];
  const startRe = /\{\{\s*[Ff]ootball ?box/g;
  let m;
  while ((m = startRe.exec(wikitext))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (depth > 0 && i < wikitext.length) {
      if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i += 2; continue; }
      if (wikitext[i] === "}" && wikitext[i + 1] === "}") { depth--; i += 2; continue; }
      i++;
    }
    const inner = wikitext.slice(start, i - 2);
    boxes.push(inner);
  }
  return boxes;
}

function getField(block, name) {
  // | fieldname = value   (পরের | বা ব্লক শেষ পর্যন্ত, কিন্তু nested {{}} অগ্রাহ্য করে)
  const re = new RegExp("\\|\\s*" + name + "\\s*=([\\s\\S]*?)(?=\\n\\s*\\||$)", "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function stripWikiLinks(s) {
  return decodeEntities(s || "")
    .replace(/\{\{flagicon\|[^}]*\}\}/gi, "")
    .replace(/\{\{fb\|[^}]*\}\}/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''/g, "")
    .trim();
}

async function fetchWikitext(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(pageTitle)}`;
  const r = await fetch(url, { headers: { "User-Agent": "WC26TrackerApp/1.0 (educational hobby project)" } });
  const j = await r.json();
  const pages = j?.query?.pages || {};
  const pid = Object.keys(pages)[0];
  return pages[pid]?.revisions?.[0]?.slots?.main?.["*"] || pages[pid]?.revisions?.[0]?.["*"] || "";
}

export default async function handler(req, res) {
  const { group } = req.query;
  if (!group || !/^[A-L]$/i.test(group)) {
    res.status(400).json({ error: "group query param প্রয়োজন (A থেকে L)" });
    return;
  }
  const g = group.toUpperCase();
  const now = Date.now();
  const cached = cache.get(g);
  if (cached && (now - cached.ts) < CACHE_MS) {
    res.setHeader("X-Cache", "HIT");
    res.status(200).json(cached.data);
    return;
  }
  try {
    const pageTitle = `2026 FIFA World Cup Group ${g}`;
    const wikitext = await fetchWikitext(pageTitle);
    if (!wikitext) {
      res.status(200).json({ matches: [], note: "wikitext পাওয়া যায়নি" });
      return;
    }
    const boxes = extractFootballboxes(wikitext);
    const matches = boxes.map(block => {
      const team1 = stripWikiLinks(getField(block, "team1"));
      const team2 = stripWikiLinks(getField(block, "team2"));
      const score = stripWikiLinks(getField(block, "score"));
      const date = stripWikiLinks(getField(block, "date"));
      const goals1Raw = getField(block, "goals1");
      const goals2Raw = getField(block, "goals2");
      return {
        team1, team2, score, date,
        goals1: parseGoalsField(goals1Raw),
        goals2: parseGoalsField(goals2Raw),
      };
    }).filter(m => m.team1 && m.team2);

    const data = { group: g, matches, fetchedAt: new Date().toISOString() };
    cache.set(g, { data, ts: now });
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (e) {
    if (cached) {
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cached.data);
    } else {
      res.status(500).json({ error: String(e?.message || e) });
    }
  }
}
