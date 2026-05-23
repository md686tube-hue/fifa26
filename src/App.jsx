import { useState, useMemo, useEffect, useCallback } from "react";

// ET to BD time converter: ET = UTC-4 (summer), BD = UTC+6, so BD = ET + 10h
function etToBD(etTime) {
  const [h, m] = etTime.split(":").map(Number);
  let bdH = (h + 10) % 24;
  const nextDay = h + 10 >= 24;
  return { time: `${String(bdH).padStart(2,"0")}:${String(m).padStart(2,"0")}`, nextDay };
}

const GROUPS = {
  A: ["Mexico","South Africa","South Korea","Czech Republic"],
  B: ["Canada","Bosnia & Herzegovina","Qatar","Switzerland"],
  C: ["Brazil","Morocco","Haiti","Scotland"],
  D: ["USA","Paraguay","Australia","Turkey"],
  E: ["Germany","Curaçao","Ivory Coast","Ecuador"],
  F: ["Netherlands","Japan","Sweden","Tunisia"],
  G: ["Belgium","Egypt","Iran","New Zealand"],
  H: ["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I: ["France","Senegal","Iraq","Norway"],
  J: ["Argentina","Algeria","Austria","Jordan"],
  K: ["Portugal","DR Congo","Uzbekistan","Colombia"],
  L: ["England","Croatia","Ghana","Panama"],
};

const FLAGS = {
  Mexico:"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czech Republic":"🇨🇿",
  Canada:"🇨🇦","Bosnia & Herzegovina":"🇧🇦",Qatar:"🇶🇦",Switzerland:"🇨🇭",
  Brazil:"🇧🇷",Morocco:"🇲🇦",Haiti:"🇭🇹",Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA:"🇺🇸",Paraguay:"🇵🇾",Australia:"🇦🇺",Turkey:"🇹🇷",
  Germany:"🇩🇪","Curaçao":"🇨🇼","Ivory Coast":"🇨🇮",Ecuador:"🇪🇨",
  Netherlands:"🇳🇱",Japan:"🇯🇵",Sweden:"🇸🇪",Tunisia:"🇹🇳",
  Belgium:"🇧🇪",Egypt:"🇪🇬",Iran:"🇮🇷","New Zealand":"🇳🇿",
  Spain:"🇪🇸","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦",Uruguay:"🇺🇾",
  France:"🇫🇷",Senegal:"🇸🇳",Iraq:"🇮🇶",Norway:"🇳🇴",
  Argentina:"🇦🇷",Algeria:"🇩🇿",Austria:"🇦🇹",Jordan:"🇯🇴",
  Portugal:"🇵🇹","DR Congo":"🇨🇩",Uzbekistan:"🇺🇿",Colombia:"🇨🇴",
  England:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",Croatia:"🇭🇷",Ghana:"🇬🇭",Panama:"🇵🇦",
};

// All group stage fixtures with ET times
const ALL_GROUP_FIXTURES = [
  {id:1,grp:"A",home:"Mexico",away:"South Africa",dateStr:"Jun 11",etTime:"15:00",venue:"Estadio Azteca, Mexico City"},
  {id:2,grp:"A",home:"South Korea",away:"Czech Republic",dateStr:"Jun 11",etTime:"22:00",venue:"Estadio Akron, Guadalajara"},
  {id:3,grp:"B",home:"Canada",away:"Bosnia & Herzegovina",dateStr:"Jun 12",etTime:"15:00",venue:"BMO Field, Toronto"},
  {id:4,grp:"B",home:"Qatar",away:"Switzerland",dateStr:"Jun 12",etTime:"19:00",venue:"BC Place, Vancouver"},
  {id:5,grp:"D",home:"USA",away:"Paraguay",dateStr:"Jun 12",etTime:"13:00",venue:"SoFi Stadium, Los Angeles"},
  {id:6,grp:"D",home:"Australia",away:"Turkey",dateStr:"Jun 12",etTime:"22:00",venue:"Levi's Stadium, San Francisco"},
  {id:7,grp:"C",home:"Brazil",away:"Morocco",dateStr:"Jun 13",etTime:"12:00",venue:"AT&T Stadium, Dallas"},
  {id:8,grp:"C",home:"Haiti",away:"Scotland",dateStr:"Jun 13",etTime:"15:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:9,grp:"E",home:"Germany",away:"Curaçao",dateStr:"Jun 13",etTime:"18:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:10,grp:"E",home:"Ivory Coast",away:"Ecuador",dateStr:"Jun 13",etTime:"22:00",venue:"Hard Rock Stadium, Miami"},
  {id:11,grp:"F",home:"Netherlands",away:"Japan",dateStr:"Jun 14",etTime:"12:00",venue:"Lumen Field, Seattle"},
  {id:12,grp:"F",home:"Sweden",away:"Tunisia",dateStr:"Jun 14",etTime:"15:00",venue:"Allegiant Stadium, Las Vegas"},
  {id:13,grp:"K",home:"Portugal",away:"DR Congo",dateStr:"Jun 14",etTime:"18:00",venue:"Hard Rock Stadium, Miami"},
  {id:14,grp:"K",home:"Uzbekistan",away:"Colombia",dateStr:"Jun 14",etTime:"22:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:15,grp:"G",home:"Belgium",away:"Egypt",dateStr:"Jun 15",etTime:"12:00",venue:"SoFi Stadium, Los Angeles"},
  {id:16,grp:"G",home:"Iran",away:"New Zealand",dateStr:"Jun 15",etTime:"15:00",venue:"Lumen Field, Seattle"},
  {id:17,grp:"H",home:"Spain",away:"Cape Verde",dateStr:"Jun 15",etTime:"18:00",venue:"MetLife Stadium, New York"},
  {id:18,grp:"H",home:"Saudi Arabia",away:"Uruguay",dateStr:"Jun 15",etTime:"22:00",venue:"AT&T Stadium, Dallas"},
  {id:19,grp:"I",home:"France",away:"Senegal",dateStr:"Jun 16",etTime:"12:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:20,grp:"I",home:"Iraq",away:"Norway",dateStr:"Jun 16",etTime:"15:00",venue:"Gillette Stadium, Boston"},
  {id:21,grp:"J",home:"Argentina",away:"Algeria",dateStr:"Jun 16",etTime:"18:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:22,grp:"J",home:"Austria",away:"Jordan",dateStr:"Jun 16",etTime:"22:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:23,grp:"L",home:"England",away:"Croatia",dateStr:"Jun 17",etTime:"12:00",venue:"AT&T Stadium, Dallas"},
  {id:24,grp:"L",home:"Ghana",away:"Panama",dateStr:"Jun 17",etTime:"15:00",venue:"Allegiant Stadium, Las Vegas"},
  {id:25,grp:"A",home:"Mexico",away:"South Korea",dateStr:"Jun 17",etTime:"18:00",venue:"Estadio Azteca, Mexico City"},
  {id:26,grp:"A",home:"Czech Republic",away:"South Africa",dateStr:"Jun 17",etTime:"21:00",venue:"Estadio Akron, Guadalajara"},
  {id:27,grp:"B",home:"Canada",away:"Qatar",dateStr:"Jun 17",etTime:"15:00",venue:"BMO Field, Toronto"},
  {id:28,grp:"B",home:"Switzerland",away:"Bosnia & Herzegovina",dateStr:"Jun 17",etTime:"19:00",venue:"BC Place, Vancouver"},
  {id:29,grp:"C",home:"Brazil",away:"Haiti",dateStr:"Jun 18",etTime:"15:00",venue:"MetLife Stadium, New York"},
  {id:30,grp:"C",home:"Scotland",away:"Morocco",dateStr:"Jun 18",etTime:"19:00",venue:"Gillette Stadium, Boston"},
  {id:31,grp:"D",home:"USA",away:"Australia",dateStr:"Jun 18",etTime:"16:00",venue:"SoFi Stadium, Los Angeles"},
  {id:32,grp:"D",home:"Turkey",away:"Paraguay",dateStr:"Jun 18",etTime:"22:00",venue:"Levi's Stadium, San Francisco"},
  {id:33,grp:"E",home:"Germany",away:"Ivory Coast",dateStr:"Jun 18",etTime:"12:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:34,grp:"E",home:"Ecuador",away:"Curaçao",dateStr:"Jun 18",etTime:"19:00",venue:"Hard Rock Stadium, Miami"},
  {id:35,grp:"F",home:"Netherlands",away:"Sweden",dateStr:"Jun 19",etTime:"15:00",venue:"Lumen Field, Seattle"},
  {id:36,grp:"F",home:"Tunisia",away:"Japan",dateStr:"Jun 19",etTime:"19:00",venue:"Allegiant Stadium, Las Vegas"},
  {id:37,grp:"K",home:"Portugal",away:"Uzbekistan",dateStr:"Jun 19",etTime:"12:00",venue:"Hard Rock Stadium, Miami"},
  {id:38,grp:"K",home:"Colombia",away:"DR Congo",dateStr:"Jun 19",etTime:"19:00",venue:"Gillette Stadium, Boston"},
  {id:39,grp:"G",home:"Belgium",away:"Iran",dateStr:"Jun 20",etTime:"15:00",venue:"BC Place, Vancouver"},
  {id:40,grp:"G",home:"New Zealand",away:"Egypt",dateStr:"Jun 20",etTime:"19:00",venue:"SoFi Stadium, Los Angeles"},
  {id:41,grp:"H",home:"Spain",away:"Saudi Arabia",dateStr:"Jun 20",etTime:"12:00",venue:"MetLife Stadium, New York"},
  {id:42,grp:"H",home:"Uruguay",away:"Cape Verde",dateStr:"Jun 20",etTime:"19:00",venue:"AT&T Stadium, Dallas"},
  {id:43,grp:"I",home:"France",away:"Iraq",dateStr:"Jun 21",etTime:"15:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:44,grp:"I",home:"Norway",away:"Senegal",dateStr:"Jun 21",etTime:"19:00",venue:"Gillette Stadium, Boston"},
  {id:45,grp:"J",home:"Argentina",away:"Austria",dateStr:"Jun 21",etTime:"12:00",venue:"Hard Rock Stadium, Miami"},
  {id:46,grp:"J",home:"Jordan",away:"Algeria",dateStr:"Jun 21",etTime:"19:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:47,grp:"L",home:"England",away:"Ghana",dateStr:"Jun 22",etTime:"15:00",venue:"SoFi Stadium, Los Angeles"},
  {id:48,grp:"L",home:"Panama",away:"Croatia",dateStr:"Jun 22",etTime:"19:00",venue:"Allegiant Stadium, Las Vegas"},
  {id:49,grp:"A",home:"Mexico",away:"Czech Republic",dateStr:"Jun 23",etTime:"16:00",venue:"Estadio BBVA, Monterrey"},
  {id:50,grp:"A",home:"South Africa",away:"South Korea",dateStr:"Jun 23",etTime:"16:00",venue:"Estadio Akron, Guadalajara"},
  {id:51,grp:"B",home:"Canada",away:"Switzerland",dateStr:"Jun 23",etTime:"16:00",venue:"BC Place, Vancouver"},
  {id:52,grp:"B",home:"Bosnia & Herzegovina",away:"Qatar",dateStr:"Jun 23",etTime:"16:00",venue:"BMO Field, Toronto"},
  {id:53,grp:"C",home:"Brazil",away:"Scotland",dateStr:"Jun 24",etTime:"16:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:54,grp:"C",home:"Morocco",away:"Haiti",dateStr:"Jun 24",etTime:"16:00",venue:"AT&T Stadium, Dallas"},
  {id:55,grp:"D",home:"USA",away:"Turkey",dateStr:"Jun 24",etTime:"16:00",venue:"SoFi Stadium, Los Angeles"},
  {id:56,grp:"D",home:"Paraguay",away:"Australia",dateStr:"Jun 24",etTime:"16:00",venue:"Levi's Stadium, San Francisco"},
  {id:57,grp:"E",home:"Germany",away:"Ecuador",dateStr:"Jun 24",etTime:"20:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:58,grp:"E",home:"Curaçao",away:"Ivory Coast",dateStr:"Jun 24",etTime:"20:00",venue:"Hard Rock Stadium, Miami"},
  {id:59,grp:"F",home:"Netherlands",away:"Tunisia",dateStr:"Jun 25",etTime:"16:00",venue:"Lumen Field, Seattle"},
  {id:60,grp:"F",home:"Japan",away:"Sweden",dateStr:"Jun 25",etTime:"16:00",venue:"Allegiant Stadium, Las Vegas"},
  {id:61,grp:"K",home:"Portugal",away:"Colombia",dateStr:"Jun 25",etTime:"20:00",venue:"MetLife Stadium, New York"},
  {id:62,grp:"K",home:"DR Congo",away:"Uzbekistan",dateStr:"Jun 25",etTime:"20:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:63,grp:"G",home:"Belgium",away:"New Zealand",dateStr:"Jun 26",etTime:"16:00",venue:"Lumen Field, Seattle"},
  {id:64,grp:"G",home:"Egypt",away:"Iran",dateStr:"Jun 26",etTime:"16:00",venue:"SoFi Stadium, Los Angeles"},
  {id:65,grp:"H",home:"Spain",away:"Uruguay",dateStr:"Jun 26",etTime:"20:00",venue:"Hard Rock Stadium, Miami"},
  {id:66,grp:"H",home:"Cape Verde",away:"Saudi Arabia",dateStr:"Jun 26",etTime:"20:00",venue:"AT&T Stadium, Dallas"},
  {id:67,grp:"I",home:"France",away:"Norway",dateStr:"Jun 27",etTime:"16:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:68,grp:"I",home:"Senegal",away:"Iraq",dateStr:"Jun 27",etTime:"16:00",venue:"Gillette Stadium, Boston"},
  {id:69,grp:"J",home:"Argentina",away:"Jordan",dateStr:"Jun 27",etTime:"20:00",venue:"MetLife Stadium, New York"},
  {id:70,grp:"J",home:"Algeria",away:"Austria",dateStr:"Jun 27",etTime:"20:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:71,grp:"L",home:"England",away:"Panama",dateStr:"Jun 28",etTime:"16:00",venue:"Hard Rock Stadium, Miami"},
  {id:72,grp:"L",home:"Croatia",away:"Ghana",dateStr:"Jun 28",etTime:"16:00",venue:"AT&T Stadium, Dallas"},
];

// Knockout rounds
const KNOCKOUT_ROUNDS = [
  {
    round: "Round of 32",
    short: "R32",
    dates: "Jul 1–4",
    matches: [
      {id:"r32-1", home:"Winner A", away:"Runner-up B", date:"Jul 1", etTime:"15:00", venue:"MetLife Stadium, New York"},
      {id:"r32-2", home:"Winner B", away:"Runner-up A", date:"Jul 1", etTime:"19:00", venue:"AT&T Stadium, Dallas"},
      {id:"r32-3", home:"Winner C", away:"Runner-up D", date:"Jul 1", etTime:"23:00", venue:"SoFi Stadium, Los Angeles"},
      {id:"r32-4", home:"Winner D", away:"Runner-up C", date:"Jul 2", etTime:"15:00", venue:"Hard Rock Stadium, Miami"},
      {id:"r32-5", home:"Winner E", away:"Runner-up F", date:"Jul 2", etTime:"19:00", venue:"Lumen Field, Seattle"},
      {id:"r32-6", home:"Winner F", away:"Runner-up E", date:"Jul 2", etTime:"23:00", venue:"Lincoln Financial Field, Philadelphia"},
      {id:"r32-7", home:"Winner G", away:"Runner-up H", date:"Jul 3", etTime:"15:00", venue:"Arrowhead Stadium, Kansas City"},
      {id:"r32-8", home:"Winner H", away:"Runner-up G", date:"Jul 3", etTime:"19:00", venue:"Gillette Stadium, Boston"},
      {id:"r32-9", home:"Winner I", away:"Runner-up J", date:"Jul 3", etTime:"23:00", venue:"Mercedes-Benz Stadium, Atlanta"},
      {id:"r32-10", home:"Winner J", away:"Runner-up I", date:"Jul 4", etTime:"15:00", venue:"BMO Field, Toronto"},
      {id:"r32-11", home:"Winner K", away:"Runner-up L", date:"Jul 4", etTime:"19:00", venue:"BC Place, Vancouver"},
      {id:"r32-12", home:"Winner L", away:"Runner-up K", date:"Jul 4", etTime:"23:00", venue:"Estadio Azteca, Mexico City"},
      {id:"r32-13", home:"Best 3rd (A/B/C/D)", away:"Best 3rd (E/F/G/H)", date:"Jul 4", etTime:"15:00", venue:"Estadio BBVA, Monterrey"},
      {id:"r32-14", home:"Best 3rd (I/J/K/L)", away:"Best 3rd (remaining)", date:"Jul 4", etTime:"19:00", venue:"Estadio Akron, Guadalajara"},
      {id:"r32-15", home:"3rd Group A/B", away:"3rd Group C/D", date:"Jul 3", etTime:"15:00", venue:"Levi's Stadium, San Francisco"},
      {id:"r32-16", home:"3rd Group E/F", away:"3rd Group G/H", date:"Jul 3", etTime:"19:00", venue:"Allegiant Stadium, Las Vegas"},
    ]
  },
  {
    round: "Round of 16",
    short: "R16",
    dates: "Jul 6–8",
    matches: [
      {id:"r16-1", home:"Winner R32 M1", away:"Winner R32 M2", date:"Jul 6", etTime:"15:00", venue:"MetLife Stadium, New York"},
      {id:"r16-2", home:"Winner R32 M3", away:"Winner R32 M4", date:"Jul 6", etTime:"19:00", venue:"AT&T Stadium, Dallas"},
      {id:"r16-3", home:"Winner R32 M5", away:"Winner R32 M6", date:"Jul 6", etTime:"23:00", venue:"SoFi Stadium, Los Angeles"},
      {id:"r16-4", home:"Winner R32 M7", away:"Winner R32 M8", date:"Jul 7", etTime:"15:00", venue:"Hard Rock Stadium, Miami"},
      {id:"r16-5", home:"Winner R32 M9", away:"Winner R32 M10", date:"Jul 7", etTime:"19:00", venue:"Arrowhead Stadium, Kansas City"},
      {id:"r16-6", home:"Winner R32 M11", away:"Winner R32 M12", date:"Jul 7", etTime:"23:00", venue:"Lumen Field, Seattle"},
      {id:"r16-7", home:"Winner R32 M13", away:"Winner R32 M14", date:"Jul 8", etTime:"15:00", venue:"Mercedes-Benz Stadium, Atlanta"},
      {id:"r16-8", home:"Winner R32 M15", away:"Winner R32 M16", date:"Jul 8", etTime:"19:00", venue:"Gillette Stadium, Boston"},
    ]
  },
  {
    round: "Quarter-Finals",
    short: "QF",
    dates: "Jul 11–12",
    matches: [
      {id:"qf-1", home:"Winner R16 M1", away:"Winner R16 M2", date:"Jul 11", etTime:"15:00", venue:"MetLife Stadium, New York"},
      {id:"qf-2", home:"Winner R16 M3", away:"Winner R16 M4", date:"Jul 11", etTime:"19:00", venue:"AT&T Stadium, Dallas"},
      {id:"qf-3", home:"Winner R16 M5", away:"Winner R16 M6", date:"Jul 12", etTime:"15:00", venue:"SoFi Stadium, Los Angeles"},
      {id:"qf-4", home:"Winner R16 M7", away:"Winner R16 M8", date:"Jul 12", etTime:"19:00", venue:"Hard Rock Stadium, Miami"},
    ]
  },
  {
    round: "Semi-Finals",
    short: "SF",
    dates: "Jul 15–16",
    matches: [
      {id:"sf-1", home:"Winner QF 1", away:"Winner QF 2", date:"Jul 15", etTime:"19:00", venue:"MetLife Stadium, New York"},
      {id:"sf-2", home:"Winner QF 3", away:"Winner QF 4", date:"Jul 16", etTime:"19:00", venue:"AT&T Stadium, Dallas"},
    ]
  },
  {
    round: "3rd Place",
    short: "3PL",
    dates: "Jul 19",
    matches: [
      {id:"3pl-1", home:"Loser SF 1", away:"Loser SF 2", date:"Jul 19", etTime:"11:00", venue:"Hard Rock Stadium, Miami"},
    ]
  },
  {
    round: "Final",
    short: "FIN",
    dates: "Jul 19",
    matches: [
      {id:"fin-1", home:"Winner SF 1", away:"Winner SF 2", date:"Jul 19", etTime:"15:00", venue:"MetLife Stadium, New York"},
    ]
  },
];


const ALL_TEAMS = Object.values(GROUPS).flat();
const posColors = {GK:"#f59e0b",DEF:"#3b82f6",MID:"#10b981",FWD:"#ef4444"};
const posLabel = {GK:"গোলকিপার",DEF:"ডিফেন্ডার",MID:"মিডফিল্ডার",FWD:"ফরওয়ার্ড"};

function bdTime(etTime, dateStr) {
  const { time, nextDay } = etToBD(etTime);
  return time + (nextDay ? " (+1)" : "");
}

function getTeamGroup(t) {
  for (const [g,teams] of Object.entries(GROUPS)) if (teams.includes(t)) return g;
  return null;
}

function getTeamFixtures(t) {
  return ALL_GROUP_FIXTURES.filter(f => f.home===t || f.away===t);
}

// ── AI Squad Fetch ──────────────────────────────────────────────────────────
const squadCache = {};

async function fetchSquad(teamName) {
  if (squadCache[teamName]) return squadCache[teamName];
  const prompt = `Give the FIFA World Cup 2026 squad for ${teamName} national football team.
Reply ONLY with a JSON object — no markdown, no explanation, no code block.
Format exactly:
{"coach":"Full Name","worldRanking":5,"confederation":"UEFA","players":[{"num":1,"name":"Full Name","pos":"GK","club":"Club Name","age":28,"caps":45}]}
Rules: pos must be GK/DEF/MID/FWD only. Include ~23 players (3 GK, 7-8 DEF, 7-8 MID, 4-5 FWD). Real accurate players likely in 2026 squad. Ages as of June 2026.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "anthropic-dangerous-direct-browser-access":"true"
    },
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1500,
      messages:[{role:"user",content:prompt}]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("JSON পাওয়া যায়নি");
  const parsed = JSON.parse(m[0]);
  if (!parsed.players || !Array.isArray(parsed.players)) throw new Error("Invalid squad data");
  squadCache[teamName] = parsed;
  return parsed;
}

// ── Player Card ─────────────────────────────────────────────────────────────
function PlayerCard({ player }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);
  const pc = posColors[player.pos] || "#6b7280";
  const initials = player.name.split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();

  useEffect(() => {
    // Try Wikipedia thumbnail via their API (CORS-friendly endpoint)
    const normalized = player.name.replace(/ /g,"_");
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(normalized)}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
    fetch(url)
      .then(r=>r.json())
      .then(d=>{
        const pages = d.query?.pages || {};
        const page = Object.values(pages)[0];
        if (page?.thumbnail?.source) setImgSrc(page.thumbnail.source);
        else setImgFailed(true);
      })
      .catch(()=>setImgFailed(true));
  }, [player.name]);

  return (
    <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,overflow:"hidden",transition:"all .22s",cursor:"default"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 24px ${pc}22`;e.currentTarget.style.borderColor=pc+"44";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";e.currentTarget.style.borderColor="rgba(255,255,255,.07)";}}>
      {/* Photo */}
      <div style={{height:130,background:`linear-gradient(135deg,${pc}18,${pc}06)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        {imgSrc && !imgFailed ? (
          <img src={imgSrc} alt={player.name} onError={()=>{setImgSrc(null);setImgFailed(true);}}
            style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top center"}}/>
        ) : imgFailed || imgSrc===null ? (
          <div style={{width:68,height:68,borderRadius:"50%",background:`linear-gradient(135deg,${pc},${pc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:24,color:"#fff",boxShadow:`0 0 20px ${pc}44`}}>
            {initials}
          </div>
        ) : (
          <div style={{width:32,height:32,border:`2px solid ${pc}44`,borderTop:`2px solid ${pc}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
        )}
        <div style={{position:"absolute",top:7,left:7,width:26,height:26,background:pc,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:14,color:"#fff",boxShadow:`0 2px 6px ${pc}66`}}>{player.num}</div>
        <div style={{position:"absolute",top:7,right:7,padding:"2px 6px",background:"rgba(0,0,0,.65)",borderRadius:4,fontSize:9,fontWeight:800,color:pc,letterSpacing:.5}}>{player.pos}</div>
      </div>
      {/* Info */}
      <div style={{padding:"9px 11px"}}>
        <div style={{fontWeight:700,fontSize:12,lineHeight:1.3,marginBottom:3}}>{player.name}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{player.club}</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {player.age&&<span style={{fontSize:10,padding:"1px 6px",background:"rgba(255,255,255,.05)",borderRadius:4,color:"#9ca3af"}}>{player.age} বছর</span>}
          {player.caps>0&&<span style={{fontSize:10,padding:"1px 6px",background:"rgba(255,255,255,.05)",borderRadius:4,color:"#9ca3af"}}>{player.caps} caps</span>}
        </div>
      </div>
    </div>
  );
}

// ── Squad Panel ─────────────────────────────────────────────────────────────
function SquadPanel({ teamName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [posFilter, setPosFilter] = useState("ALL");

  useEffect(() => {
    if (!teamName) return;
    setLoading(true); setError(null); setData(null); setPosFilter("ALL");
    fetchSquad(teamName)
      .then(d=>{ setData(d); setLoading(false); })
      .catch(e=>{ setError(e.message); setLoading(false); });
  }, [teamName]);

  if (!teamName) return (
    <div style={{textAlign:"center",padding:"60px 0",color:"#4b5563"}}>
      <div style={{fontSize:44,marginBottom:12}}>👕</div>
      <div style={{fontWeight:700,fontSize:16,color:"#6b7280"}}>একটি দল বেছে নিন</div>
      <div style={{fontSize:13,marginTop:6}}>AI দিয়ে সব ৪৮ দলের squad আনা যাবে</div>
    </div>
  );

  const grp = getTeamGroup(teamName);
  const grpFixtures = getTeamFixtures(teamName);
  const byPos = data ? {
    GK:data.players.filter(p=>p.pos==="GK"),
    DEF:data.players.filter(p=>p.pos==="DEF"),
    MID:data.players.filter(p=>p.pos==="MID"),
    FWD:data.players.filter(p=>p.pos==="FWD"),
  } : {};
  const filtered = !data ? [] : posFilter==="ALL" ? data.players : (byPos[posFilter]||[]);

  return (
    <div className="fi">
      {/* Team header */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:"18px 20px",background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.12)",borderRadius:14}}>
        <span style={{fontSize:52,flexShrink:0}}>{FLAGS[teamName]||"🏳"}</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:34,color:"#10b981",letterSpacing:2,lineHeight:1}}>{teamName}</div>
          {loading && <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>Squad লোড হচ্ছে...</div>}
          {data && (
            <div style={{marginTop:5}}>
              <div style={{fontSize:13,color:"#9ca3af"}}>কোচ: <span style={{color:"#d1d5db",fontWeight:700}}>{data.coach}</span>
                {data.worldRanking&&<span style={{marginLeft:10,padding:"2px 8px",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.2)",borderRadius:4,color:"#10b981",fontSize:11}}>FIFA #{data.worldRanking}</span>}
                {data.confederation&&<span style={{marginLeft:8,fontSize:11,color:"#4b5563"}}>{data.confederation}</span>}
              </div>
              <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                {["GK","DEF","MID","FWD"].map(p=>byPos[p]?.length>0&&(
                  <span key={p} style={{padding:"2px 8px",borderRadius:999,fontSize:10,fontWeight:800,background:posColors[p]+"20",color:posColors[p]}}>{p} {byPos[p].length}</span>
                ))}
                <span style={{padding:"2px 8px",borderRadius:999,fontSize:10,fontWeight:700,background:"rgba(255,255,255,.05)",color:"#6b7280"}}>মোট {data.players.length}জন</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{textAlign:"center",padding:"50px 0"}}>
          <div style={{width:44,height:44,border:"3px solid rgba(16,185,129,.15)",borderTop:"3px solid #10b981",borderRadius:"50%",animation:"spin .9s linear infinite",margin:"0 auto 14px"}}/>
          <div style={{color:"#6b7280",fontSize:14}}>AI দিয়ে {teamName}-এর squad আনা হচ্ছে...</div>
          <div style={{color:"#4b5563",fontSize:12,marginTop:4}}>একটু অপেক্ষা করুন</div>
        </div>
      )}

      {error && (
        <div style={{textAlign:"center",padding:"40px 20px",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)",borderRadius:12}}>
          <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
          <div style={{fontWeight:700,color:"#ef4444",marginBottom:4}}>তথ্য আনতে সমস্যা হয়েছে</div>
          <div style={{fontSize:12,color:"#6b7280",marginBottom:14}}>{error}</div>
          <button onClick={()=>{setError(null);setLoading(true);fetchSquad(teamName).then(d=>{setData(d);setLoading(false);}).catch(e=>{setError(e.message);setLoading(false);});}}
            style={{padding:"8px 18px",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",borderRadius:8,color:"#10b981",cursor:"pointer",fontSize:13,fontWeight:700}}>
            আবার চেষ্টা করুন
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Pos filter */}
          <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
            {["ALL","GK","DEF","MID","FWD"].map(p=>(
              <button key={p} onClick={()=>setPosFilter(p)}
                style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${posFilter===p?(p==="ALL"?"#10b981":posColors[p]):"rgba(255,255,255,.08)"}`,background:posFilter===p?(p==="ALL"?"rgba(16,185,129,.12)":`${posColors[p]}18`):"transparent",color:posFilter===p?(p==="ALL"?"#10b981":posColors[p]):"#6b7280",cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .2s"}}>
                {p==="ALL"?"সকল":posLabel[p]} {p!=="ALL"&&byPos[p]&&`(${byPos[p].length})`}
              </button>
            ))}
          </div>

          {/* Player grid */}
          <div className="player-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:24}}>
            {filtered.map((p,i)=><PlayerCard key={i} player={p}/>)}
          </div>
        </>
      )}

      {/* Team fixtures */}
      {grpFixtures.length>0 && (
        <div style={{padding:"15px 18px",background:"rgba(16,185,129,.03)",border:"1px solid rgba(16,185,129,.1)",borderRadius:12}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:15,letterSpacing:2,color:"#10b981",marginBottom:10}}>GROUP {grp} ম্যাচসূচি</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {grpFixtures.map((fix,i)=>{
              const bd=bdTime(fix.etTime,"");
              const isHome=fix.home===teamName;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,padding:"6px 0",borderBottom:i<grpFixtures.length-1?"1px solid rgba(255,255,255,.04)":"none"}}>
                  <span style={{color:"#4b5563",minWidth:50}}>{fix.dateStr}</span>
                  <span style={{fontWeight:isHome?800:500,color:isHome?"#10b981":"#9ca3af"}}>{fix.home}</span>
                  <span style={{color:"#374151",fontSize:10}}>vs</span>
                  <span style={{fontWeight:!isHome?800:500,color:!isHome?"#10b981":"#9ca3af"}}>{fix.away}</span>
                  <span style={{marginLeft:"auto",fontFamily:"'Bebas Neue',cursive",fontSize:14,color:"#10b981"}}>{bd}</span>
                  <span style={{color:"#374151",fontSize:10,minWidth:110,textAlign:"right"}}>📍{fix.venue.split(",")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("fixtures");
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureFilter, setFixtureFilter] = useState("ALL");
  const [squadTeam, setSquadTeam] = useState(null);
  const [koRound, setKoRound] = useState(0);

  const filteredFixtures = useMemo(() => {
    let list = ALL_GROUP_FIXTURES;
    if (fixtureFilter !== "ALL") list = list.filter(f => f.grp === fixtureFilter);
    if (fixtureSearch.trim()) {
      const q = fixtureSearch.toLowerCase();
      list = list.filter(f => f.home.toLowerCase().includes(q) || f.away.toLowerCase().includes(q));
    }
    return list;
  }, [fixtureFilter, fixtureSearch]);

  const searchSuggestions = useMemo(() => {
    if (!fixtureSearch.trim() || fixtureSearch.length < 2) return [];
    const q = fixtureSearch.toLowerCase();
    return ALL_TEAMS.filter(t => t.toLowerCase().includes(q)).slice(0, 6);
  }, [fixtureSearch]);

  const tabs = [
    {k:"fixtures",label:"📅 Fixtures"},
    {k:"knockout",label:"🏆 Knockout"},
    {k:"squads",label:"👕 Squads"},
  ];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#0a1208;}
        ::-webkit-scrollbar-thumb{background:#10b981;border-radius:2px;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        .fi{animation:fadeIn 0.25s ease;}
        .fcard:hover{border-color:rgba(16,185,129,0.4)!important;background:rgba(16,185,129,0.04)!important;}
        .grpbtn:hover{border-color:rgba(16,185,129,0.4)!important;color:#d1fae5!important;}
        .scard:hover{transform:translateY(-1px);border-color:rgba(16,185,129,0.3)!important;}
        input[type=text]:focus{outline:1px solid #10b981;border-color:#10b981!important;}
        .kocard:hover{border-color:rgba(251,191,36,0.5)!important;background:rgba(251,191,36,0.03)!important;}
        .pill{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.5px;}

        /* Squad layout: desktop = sidebar + content side-by-side */
        .squad-layout{display:flex;gap:20px;align-items:flex-start;}
        .team-sidebar{width:170px;flex-shrink:0;max-height:80vh;overflow-y:auto;position:sticky;top:16px;}
        .squad-content{flex:1;min-width:0;}

        /* Fixture card mobile tweak */
        .fcard-inner{display:flex;align-items:center;gap:12px;}

        /* Mobile breakpoint */
        @media(max-width:600px){
          .squad-layout{flex-direction:column;gap:0;}
          .team-sidebar{width:100%;max-height:none;position:static;overflow-y:visible;
            display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;padding-bottom:10px;margin-bottom:14px;}
          .team-sidebar::-webkit-scrollbar{height:3px;}
          .team-sidebar > div{display:contents;}
          .team-sidebar button{flex-shrink:0;white-space:nowrap;width:auto!important;padding:6px 12px!important;border:1px solid rgba(255,255,255,.1)!important;}
          .team-sidebar button span:last-child{display:inline!important;}
          .squad-content{width:100%;}
          .fcard{padding:10px 12px!important;}
          .fcard-venue{display:none;}
          .ko-venue{display:none;}
          .header-stats{display:none!important;}
          .fix-team-name{font-size:11px!important;}
          .fix-vs-box{min-width:56px!important;padding:4px 6px!important;}
        }
        @media(max-width:480px){
          .player-grid{grid-template-columns:repeat(2,1fr)!important;}
        }
      `}</style>

      <div style={{minHeight:"100vh",background:"#060f08",color:"#e5e7eb",fontFamily:"'Outfit',sans-serif"}}>

        {/* HEADER */}
        <div style={{background:"linear-gradient(180deg,rgba(16,185,129,.08) 0%,transparent 100%)",borderBottom:"1px solid rgba(16,185,129,.15)",padding:"16px 16px 0"}}>
          <div style={{maxWidth:1060,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <div style={{width:42,height:42,background:"linear-gradient(135deg,#10b981,#065f46)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>⚽</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,letterSpacing:2,color:"#10b981",lineHeight:1}}>FIFA WORLD CUP 2026</div>
                <div style={{fontSize:10,color:"#6b7280",letterSpacing:1,marginTop:2}}>USA · CANADA · MEXICO &nbsp;|&nbsp; JUN 11 – JUL 19 &nbsp;|&nbsp; GMT+6</div>
              </div>
              {[["48","Teams"],["12","Groups"],["104","Matches"]].map(([n,l])=>(
                <div key={l} className="header-stats" style={{textAlign:"center",minWidth:40}}>
                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,color:"#10b981",lineHeight:1}}>{n}</div>
                  <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:0,overflowX:"auto"}}>
              {tabs.map(({k,label})=>(
                <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 14px",background:tab===k?"rgba(16,185,129,.15)":"transparent",color:tab===k?"#10b981":"#6b7280",border:"none",borderBottom:tab===k?"2px solid #10b981":"2px solid transparent",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Outfit',sans-serif",transition:"all .2s",whiteSpace:"nowrap",flexShrink:0}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{maxWidth:1060,margin:"0 auto",padding:"16px 12px"}}>

          {/* ===== FIXTURES TAB ===== */}
          {tab==="fixtures" && (
            <div className="fi">
              {/* Search bar */}
              <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"flex-start"}}>
                <div style={{position:"relative",flex:1,minWidth:220}}>
                  <input type="text" value={fixtureSearch} onChange={e=>{setFixtureSearch(e.target.value);setFixtureFilter("ALL");}}
                    placeholder="🔍 দলের নাম লিখুন... e.g. Brazil, Spain, Japan"
                    style={{width:"100%",padding:"11px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#e5e7eb",fontSize:14,fontFamily:"'Outfit',sans-serif"}}/>
                  {searchSuggestions.length>0 && (
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#0d1f12",border:"1px solid rgba(16,185,129,.25)",borderRadius:8,marginTop:4,zIndex:10,overflow:"hidden"}}>
                      {searchSuggestions.map(t=>(
                        <div key={t} onClick={()=>{setFixtureSearch(t);setFixtureFilter("ALL");}}
                          style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.05)",transition:"background .15s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#0f2b18"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <span style={{fontSize:20}}>{FLAGS[t]||"🏳"}</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:600}}>{t}</div>
                            <div style={{fontSize:11,color:"#6b7280"}}>Group {getTeamGroup(t)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {fixtureSearch && (
                  <button onClick={()=>setFixtureSearch("")} style={{padding:"11px 14px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,color:"#ef4444",cursor:"pointer",fontSize:13,fontWeight:600}}>✕ Clear</button>
                )}
              </div>

              {/* Group filter */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
                {["ALL",...Object.keys(GROUPS)].map(g=>(
                  <button key={g} className="grpbtn" onClick={()=>{setFixtureFilter(g);setFixtureSearch("");}}
                    style={{padding:"5px 13px",borderRadius:7,border:`1px solid ${fixtureFilter===g?"#10b981":"rgba(255,255,255,.08)"}`,background:fixtureFilter===g?"rgba(16,185,129,.15)":"transparent",color:fixtureFilter===g?"#10b981":"#6b7280",cursor:"pointer",fontFamily:"'Bebas Neue',cursive",fontSize:15,letterSpacing:1.5,transition:"all .2s"}}>
                    {g==="ALL"?"All Groups":`Grp ${g}`}
                  </button>
                ))}
              </div>

              {/* Results count */}
              <div style={{fontSize:12,color:"#4b5563",marginBottom:14}}>
                {filteredFixtures.length} টি ম্যাচ দেখানো হচ্ছে
                {fixtureSearch && <span style={{color:"#10b981"}}> · "{fixtureSearch}" সংক্রান্ত</span>}
              </div>

              {/* Fixture cards */}
              {filteredFixtures.length===0 ? (
                <div style={{textAlign:"center",padding:"60px 0",color:"#4b5563"}}>
                  <div style={{fontSize:36,marginBottom:10}}>⚽</div>
                  <div style={{fontWeight:600}}>কোনো ম্যাচ পাওয়া যায়নি</div>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredFixtures.map((fix)=>{
                    const bd = bdTime(fix.etTime, fix.dateStr);
                    const highlighted = fixtureSearch && (fix.home.toLowerCase().includes(fixtureSearch.toLowerCase())||fix.away.toLowerCase().includes(fixtureSearch.toLowerCase()));
                    return (
                      <div key={fix.id} className="fcard" style={{background:"rgba(255,255,255,.02)",border:`1px solid ${highlighted?"rgba(16,185,129,.35)":"rgba(255,255,255,.06)"}`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:38}}>
                          <div style={{width:28,height:28,background:"rgba(16,185,129,.12)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:15,color:"#10b981"}}>{fix.grp}</div>
                        </div>
                        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,justifyContent:"flex-end"}}>
                            <span className="fix-team-name" style={{fontSize:13,fontWeight:700,color:highlighted&&fix.home.toLowerCase().includes(fixtureSearch.toLowerCase())?"#10b981":"#e5e7eb",textAlign:"right"}}>{fix.home}</span>
                            <span style={{fontSize:22}}>{FLAGS[fix.home]||"🏳"}</span>
                          </div>
                          <div className="fix-vs-box" style={{padding:"5px 12px",margin:"0 10px",background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:7,textAlign:"center",minWidth:70}}>
                            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:"#6b7280",letterSpacing:1}}>VS</div>
                            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,color:"#10b981",letterSpacing:1}}>{bd}</div>
                            <div style={{fontSize:9,color:"#4b5563"}}>BD সময়</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                            <span style={{fontSize:22}}>{FLAGS[fix.away]||"🏳"}</span>
                            <span className="fix-team-name" style={{fontSize:13,fontWeight:700,color:highlighted&&fix.away.toLowerCase().includes(fixtureSearch.toLowerCase())?"#10b981":"#e5e7eb"}}>{fix.away}</span>
                          </div>
                        </div>
                        <div className="fcard-venue" style={{textAlign:"right",minWidth:150}}>
                          <div style={{fontSize:12,fontWeight:700,color:"#d1d5db"}}>{fix.dateStr} 2026</div>
                          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>📍 {fix.venue.split(",")[0]}</div>
                          <div style={{fontSize:10,color:"#4b5563",marginTop:1}}>{fix.venue.split(",").slice(1).join(",").trim()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== KNOCKOUT TAB ===== */}
          {tab==="knockout" && (
            <div className="fi">
              <div style={{marginBottom:8,fontSize:13,color:"#6b7280"}}>গ্রুপ স্টেজ শেষে ৩২ দল knockout-এ অংশ নেবে। সময় বাংলাদেশ সময় (GMT+6)।</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:24}}>
                {KNOCKOUT_ROUNDS.map((r,i)=>(
                  <button key={r.short} onClick={()=>setKoRound(i)}
                    style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${koRound===i?(r.short==="FIN"?"#fbbf24":"#10b981"):"rgba(255,255,255,.08)"}`,background:koRound===i?(r.short==="FIN"?"rgba(251,191,36,.12)":"rgba(16,185,129,.12)"):"transparent",color:koRound===i?(r.short==="FIN"?"#fbbf24":"#10b981"):"#6b7280",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}>
                    {r.round} <span style={{fontSize:11,opacity:.7}}>· {r.dates}</span>
                  </button>
                ))}
              </div>

              {(()=>{
                const r = KNOCKOUT_ROUNDS[koRound];
                const isFinal = r.short==="FIN";
                const is3pl = r.short==="3PL";
                return (
                  <div className="fi">
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                      <div style={{width:40,height:40,background:isFinal?"linear-gradient(135deg,#fbbf24,#d97706)":"linear-gradient(135deg,#10b981,#065f46)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                        {isFinal?"🏆":is3pl?"🥉":"⚔️"}
                      </div>
                      <div>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,color:isFinal?"#fbbf24":"#10b981",letterSpacing:2}}>{r.round}</div>
                        <div style={{fontSize:12,color:"#6b7280"}}>{r.dates} · {r.matches.length} ম্যাচ</div>
                      </div>
                    </div>

                    {r.short==="R32" && (
                      <div style={{marginBottom:16,padding:"12px 16px",background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.15)",borderRadius:10,fontSize:12,color:"#9ca3af"}}>
                        ℹ️ প্রতিটি গ্রুপের ১ম ও ২য় দল + ৮টি সেরা ৩য় দল মিলে মোট ৩২ দল Round of 32-তে খেলবে।
                      </div>
                    )}

                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {r.matches.map((m,i)=>{
                        const bd = bdTime(m.etTime,"");
                        return (
                          <div key={m.id} className="kocard" style={{background:"rgba(255,255,255,.02)",border:`1px solid ${isFinal?"rgba(251,191,36,.2)":"rgba(255,255,255,.06)"}`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}>
                            <div style={{minWidth:32,fontFamily:"'Bebas Neue',cursive",fontSize:13,color:isFinal?"#fbbf24":"#6b7280"}}>M{i+1}</div>
                            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:0}}>
                              <div style={{flex:1,textAlign:"right"}}>
                                <span style={{fontSize:13,fontWeight:700,color:isFinal?"#fbbf24":"#d1d5db"}}>{m.home}</span>
                              </div>
                              <div style={{padding:"5px 12px",margin:"0 12px",background:isFinal?"rgba(251,191,36,.08)":"rgba(16,185,129,.06)",border:`1px solid ${isFinal?"rgba(251,191,36,.2)":"rgba(16,185,129,.15)"}`,borderRadius:7,textAlign:"center",minWidth:70}}>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:"#6b7280",letterSpacing:1}}>VS</div>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,color:isFinal?"#fbbf24":"#10b981"}}>{bd}</div>
                                <div style={{fontSize:9,color:"#4b5563"}}>BD সময়</div>
                              </div>
                              <div style={{flex:1}}>
                                <span style={{fontSize:13,fontWeight:700,color:isFinal?"#fbbf24":"#d1d5db"}}>{m.away}</span>
                              </div>
                            </div>
                            <div className="ko-venue" style={{textAlign:"right",minWidth:150}}>
                              <div style={{fontSize:12,fontWeight:700,color:"#d1d5db"}}>{m.date} 2026</div>
                              <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>📍 {m.venue.split(",")[0]}</div>
                              <div style={{fontSize:10,color:"#4b5563"}}>{m.venue.split(",").slice(1).join(",").trim()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bracket explanation */}
                    {(r.short==="R32"||r.short==="R16"||r.short==="QF"||r.short==="SF") && (
                      <div style={{marginTop:20,padding:"14px 18px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10}}>
                        <div style={{fontSize:11,color:"#6b7280",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>পরবর্তী রাউন্ড</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#9ca3af"}}>
                          {r.short==="R32" && <><span style={{color:"#10b981",fontWeight:700}}>R32 বিজয়ী ১৬ দল</span> → Round of 16 (Jul 6–8)</>}
                          {r.short==="R16" && <><span style={{color:"#10b981",fontWeight:700}}>R16 বিজয়ী ৮ দল</span> → Quarter-Finals (Jul 11–12)</>}
                          {r.short==="QF" && <><span style={{color:"#10b981",fontWeight:700}}>QF বিজয়ী ৪ দল</span> → Semi-Finals (Jul 15–16)</>}
                          {r.short==="SF" && <><span style={{color:"#fbbf24",fontWeight:700}}>SF বিজয়ী ২ দল</span> → 🏆 Final (Jul 19, MetLife Stadium)</>}
                        </div>
                      </div>
                    )}
                    {isFinal && (
                      <div style={{marginTop:20,padding:"20px",background:"linear-gradient(135deg,rgba(251,191,36,.08),rgba(217,119,6,.05))",border:"1px solid rgba(251,191,36,.2)",borderRadius:12,textAlign:"center"}}>
                        <div style={{fontSize:36,marginBottom:8}}>🏆</div>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:"#fbbf24",letterSpacing:2}}>World Cup Final</div>
                        <div style={{fontSize:13,color:"#d97706",marginTop:4}}>July 19, 2026 · MetLife Stadium, New York</div>
                        <div style={{fontSize:12,color:"#92400e",marginTop:2}}>Bangladesh Time: রাত 01:00 (+1 দিন)</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== SQUADS TAB ===== */}
          {tab==="squads" && (
            <div className="fi">
              {/* Info banner */}
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.12)",borderRadius:8,marginBottom:14,fontSize:12,color:"#6b7280"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#10b981",display:"inline-block",flexShrink:0}}/>
                দলে ক্লিক করুন — AI সেই দলের squad তথ্য + player ছবি আনবে (সব ৪৮ দল)
              </div>

              {/* Mobile: horizontal group tabs → team chips. Desktop: sidebar */}
              <div className="squad-layout">
                {/* Team selector */}
                <div className="team-sidebar">
                  {Object.entries(GROUPS).map(([grp,teams])=>(
                    <div key={grp} style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:800,color:"#4b5563",letterSpacing:2,textTransform:"uppercase",marginBottom:5,paddingLeft:2}}>Grp {grp}</div>
                      {teams.map(team=>(
                        <button key={team} onClick={()=>setSquadTeam(team)}
                          style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${squadTeam===team?"#10b981":"transparent"}`,background:squadTeam===team?"rgba(16,185,129,.12)":"transparent",color:squadTeam===team?"#10b981":"#9ca3af",cursor:"pointer",fontSize:12,fontWeight:squadTeam===team?700:500,transition:"all .15s",marginBottom:2,textAlign:"left"}}
                          onMouseEnter={e=>{if(squadTeam!==team){e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.color="#d1d5db";}}}
                          onMouseLeave={e=>{if(squadTeam!==team){e.currentTarget.style.background="transparent";e.currentTarget.style.color="#9ca3af";}}}>
                          <span style={{fontSize:15,flexShrink:0}}>{FLAGS[team]||"🏳"}</span>
                          <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontSize:11}}>{team}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Squad panel */}
                <div className="squad-content">
                  <SquadPanel teamName={squadTeam}/>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{textAlign:"center",padding:"16px",borderTop:"1px solid rgba(255,255,255,.04)",fontSize:11,color:"#374151"}}>
          FIFA World Cup 2026 · সকল সময় বাংলাদেশ সময় অনুযায়ী (GMT+6) · Jun 11 – Jul 19
        </div>
      </div>
    </>
  );
}
