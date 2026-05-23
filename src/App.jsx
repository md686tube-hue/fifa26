import { useState, useEffect, useRef } from "react";

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

const TEAM_COLORS = {
  Argentina:["#74acdf","#fff"],Brazil:["#009c3b","#ffdf00"],France:["#002395","#fff"],
  England:["#fff","#cf081f"],Spain:["#c60b1e","#ffc400"],Germany:["#fff","#000"],
  Portugal:["#006600","#ff0000"],Netherlands:["#ff6600","#fff"],Belgium:["#000","#ef3340"],
  USA:["#002868","#bf0a30"],Mexico:["#006847","#fff"],Japan:["#fff","#bc002d"],
  Morocco:["#c1272d","#006233"],Croatia:["#ff0000","#fff"],Brazil:["#009c3b","#ffdf00"],
};

const ALL_TEAMS = Object.values(GROUPS).flat();

const posColors = {GK:"#f59e0b",DEF:"#3b82f6",MID:"#10b981",FWD:"#ef4444"};
const posLabel = {GK:"গোলকিপার",DEF:"ডিফেন্ডার",MID:"মিডফিল্ডার",FWD:"ফরওয়ার্ড"};

// Cache to avoid re-fetching
const squadCache = {};

async function fetchSquadFromClaude(teamName) {
  if (squadCache[teamName]) return squadCache[teamName];

  const prompt = `You are a football data expert. Provide the FIFA World Cup 2026 squad for ${teamName} national football team.

Return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "coach": "Coach Full Name",
  "confederation": "UEFA/CONMEBOL/CAF/AFC/CONCACAF/OFC",
  "worldRanking": 5,
  "players": [
    {"num": 1, "name": "Full Player Name", "pos": "GK", "club": "Club Name", "country": "Club Country", "age": 30, "caps": 50},
    ... (include 23 players: 3 GK, 8 DEF, 8 MID, 4 FWD)
  ]
}
Position values: only use GK, DEF, MID, FWD.
Ages should be as of June 2026.
Include real, accurate players for ${teamName} who would likely be in the World Cup 2026 squad.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{type: "web_search_20250305", name: "web_search"}],
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  
  // Try to parse JSON from response
  const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found");
  
  const parsed = JSON.parse(jsonMatch[0]);
  squadCache[teamName] = parsed;
  return parsed;
}

function PlayerCard({ player }) {
  const [imgError, setImgError] = useState(false);
  const initials = player.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const bg = posColors[player.pos] || "#6b7280";
  
  // Try Wikipedia image
  const wikiName = player.name.replace(/ /g,"_");
  const imgSrc = `https://en.wikipedia.org/wiki/Special:FilePath/${wikiName}.jpg?width=200`;

  return (
    <div style={{background:"rgba(255,255,255,.03)",border:`1px solid rgba(255,255,255,.07)`,borderRadius:12,overflow:"hidden",transition:"all .25s",cursor:"default"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 24px ${bg}25`;e.currentTarget.style.borderColor=bg+"55";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";e.currentTarget.style.borderColor="rgba(255,255,255,.07)";}}>
      {/* Photo area */}
      <div style={{height:130,background:`linear-gradient(135deg, ${bg}15, ${bg}05)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        {!imgError ? (
          <img src={imgSrc} alt={player.name} onError={()=>setImgError(true)}
            style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
        ) : (
          <div style={{width:72,height:72,borderRadius:"50%",background:`linear-gradient(135deg,${bg},${bg}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:26,color:"#fff",boxShadow:`0 0 20px ${bg}44`}}>
            {initials}
          </div>
        )}
        {/* Number badge */}
        <div style={{position:"absolute",top:8,left:8,width:28,height:28,background:bg,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:16,color:"#fff",boxShadow:`0 2px 8px ${bg}66`}}>
          {player.num}
        </div>
        {/* Pos badge */}
        <div style={{position:"absolute",top:8,right:8,padding:"2px 7px",background:"rgba(0,0,0,.6)",borderRadius:5,fontSize:10,fontWeight:800,color:bg,letterSpacing:.5}}>
          {player.pos}
        </div>
      </div>
      {/* Info */}
      <div style={{padding:"10px 12px"}}>
        <div style={{fontWeight:700,fontSize:13,lineHeight:1.3,marginBottom:4}}>{player.name}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:6}}>{player.club} {player.country&&<span style={{color:"#4b5563"}}>· {player.country}</span>}</div>
        <div style={{display:"flex",gap:6}}>
          {player.age&&<span style={{fontSize:10,padding:"2px 6px",background:"rgba(255,255,255,.05)",borderRadius:4,color:"#9ca3af"}}>বয়স {player.age}</span>}
          {player.caps&&<span style={{fontSize:10,padding:"2px 6px",background:"rgba(255,255,255,.05)",borderRadius:4,color:"#9ca3af"}}>{player.caps} caps</span>}
        </div>
      </div>
    </div>
  );
}

function TeamSquad({ teamName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePos, setActivePos] = useState("ALL");

  useEffect(() => {
    setLoading(true); setError(null); setData(null);
    fetchSquadFromClaude(teamName)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [teamName]);

  const byPos = data ? {
    GK: data.players.filter(p=>p.pos==="GK"),
    DEF: data.players.filter(p=>p.pos==="DEF"),
    MID: data.players.filter(p=>p.pos==="MID"),
    FWD: data.players.filter(p=>p.pos==="FWD"),
  } : {};

  const filtered = !data ? [] : activePos==="ALL" ? data.players : byPos[activePos]||[];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",zIndex:50,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"24px 16px"}}>
      <div style={{width:"100%",maxWidth:960,background:"#070f09",border:"1px solid rgba(16,185,129,.2)",borderRadius:20,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.6)"}}>
        
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,rgba(16,185,129,.1),transparent)",borderBottom:"1px solid rgba(16,185,129,.15)",padding:"20px 24px",display:"flex",alignItems:"center",gap:16}}>
          <span style={{fontSize:52}}>{FLAGS[teamName]||"🏳"}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:34,color:"#10b981",letterSpacing:3,lineHeight:1}}>{teamName}</div>
            {data && <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>
              কোচ: <span style={{color:"#d1d5db",fontWeight:600}}>{data.coach}</span>
              {data.worldRanking&&<span style={{marginLeft:12,padding:"2px 8px",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.2)",borderRadius:4,color:"#10b981",fontSize:11}}>FIFA #{data.worldRanking}</span>}
              {data.confederation&&<span style={{marginLeft:8,fontSize:12,color:"#4b5563"}}>{data.confederation}</span>}
            </div>}
          </div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#9ca3af",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{padding:"20px 24px"}}>
          {loading && (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{width:48,height:48,border:"3px solid rgba(16,185,129,.2)",borderTop:"3px solid #10b981",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/>
              <div style={{color:"#6b7280",fontSize:14}}>AI দিয়ে {teamName}-এর squad তথ্য আনা হচ্ছে...</div>
              <div style={{color:"#4b5563",fontSize:12,marginTop:6}}>Web search করা হচ্ছে, একটু অপেক্ষা করুন</div>
            </div>
          )}

          {error && (
            <div style={{textAlign:"center",padding:"40px 0",color:"#ef4444"}}>
              <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
              <div style={{fontWeight:600}}>তথ্য আনতে সমস্যা হয়েছে</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>{error}</div>
            </div>
          )}

          {data && (
            <>
              {/* Pos filter */}
              <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
                {["ALL","GK","DEF","MID","FWD"].map(pos=>(
                  <button key={pos} onClick={()=>setActivePos(pos)}
                    style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${activePos===pos?(pos==="ALL"?"#10b981":posColors[pos]):"rgba(255,255,255,.08)"}`,background:activePos===pos?(pos==="ALL"?"rgba(16,185,129,.12)":`${posColors[pos]}18`):"transparent",color:activePos===pos?(pos==="ALL"?"#10b981":posColors[pos]):"#6b7280",cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .2s"}}>
                    {pos==="ALL"?"সকল":posLabel[pos]} {pos!=="ALL"&&byPos[pos]&&`(${byPos[pos].length})`}
                  </button>
                ))}
                <span style={{marginLeft:"auto",fontSize:12,color:"#4b5563",display:"flex",alignItems:"center"}}>মোট {data.players.length}জন খেলোয়াড়</span>
              </div>

              {/* Player grid */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12}}>
                {filtered.map((p,i)=><PlayerCard key={i} player={p}/>)}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

export default function App() {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [search, setSearch] = useState("");
  const [hoveredGroup, setHoveredGroup] = useState(null);

  const filteredTeams = search.trim()
    ? ALL_TEAMS.filter(t=>t.toLowerCase().includes(search.toLowerCase()))
    : null;

  function getGroup(t) {
    for(const [g,ts] of Object.entries(GROUPS)) if(ts.includes(t)) return g;
    return null;
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#060f08;}
        ::-webkit-scrollbar-thumb{background:#10b981;border-radius:3px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        .fu{animation:fadeUp .3s ease both;}
        .teamcard{transition:all .22s;cursor:pointer;}
        .teamcard:hover{transform:translateY(-3px)!important;border-color:rgba(16,185,129,.5)!important;background:rgba(16,185,129,.06)!important;}
      `}</style>

      <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at top,#071a0d 0%,#040c05 60%)",color:"#e5e7eb",fontFamily:"'Outfit',sans-serif"}}>

        {/* HERO HEADER */}
        <div style={{background:"linear-gradient(180deg,rgba(16,185,129,.06) 0%,transparent 100%)",borderBottom:"1px solid rgba(16,185,129,.12)",padding:"28px 24px 24px"}}>
          <div style={{maxWidth:1080,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:6}}>
              <div style={{width:56,height:56,background:"linear-gradient(135deg,#10b981,#047857)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:"0 0 32px rgba(16,185,129,.3)",flexShrink:0}}>⚽</div>
              <div>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:34,letterSpacing:4,color:"#10b981",lineHeight:1}}>FIFA WORLD CUP 2026</div>
                <div style={{fontSize:12,color:"#6b7280",letterSpacing:2,marginTop:3}}>SQUAD EXPLORER · সব দলের খেলোয়াড় · AI-Powered Live Data</div>
              </div>
            </div>
            <div style={{marginTop:16,fontSize:13,color:"#4b5563",padding:"10px 14px",background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.1)",borderRadius:8,display:"inline-flex",alignItems:"center",gap:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 8px #10b981",animation:"pulse 2s infinite"}}/>
              যেকোনো দলে ক্লিক করুন → AI web search দিয়ে সেই দলের সম্পূর্ণ squad আনবে (কোচ, খেলোয়াড়, ক্লাব, বয়স, caps সহ)
            </div>
          </div>
        </div>

        <div style={{maxWidth:1080,margin:"0 auto",padding:"28px 24px"}}>

          {/* Search */}
          <div style={{marginBottom:28,maxWidth:420}}>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,opacity:.5}}>🔍</span>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="দলের নাম খুঁজুন... e.g. Brazil, Japan"
                style={{width:"100%",padding:"12px 14px 12px 42px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,color:"#e5e7eb",fontSize:14,fontFamily:"'Outfit',sans-serif",transition:"border .2s"}}
                onFocus={e=>e.target.style.borderColor="#10b981"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.1)"}/>
              {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:16}}>✕</button>}
            </div>

            {filteredTeams && (
              <div style={{marginTop:6,background:"#0a1a0d",border:"1px solid rgba(16,185,129,.2)",borderRadius:10,overflow:"hidden"}}>
                {filteredTeams.length===0&&<div style={{padding:"12px 16px",color:"#4b5563",fontSize:13}}>কোনো দল পাওয়া যায়নি</div>}
                {filteredTeams.map(t=>(
                  <div key={t} onClick={()=>{setSelectedTeam(t);setSearch("");}}
                    style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.04)",transition:"background .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#0f2b15"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{fontSize:22}}>{FLAGS[t]||"🏳"}</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{t}</div>
                      <div style={{fontSize:11,color:"#6b7280"}}>Group {getGroup(t)}</div>
                    </div>
                    <span style={{marginLeft:"auto",fontSize:12,color:"#10b981"}}>Squad দেখুন →</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Groups grid */}
          {!filteredTeams && (
            <div>
              <div style={{fontSize:11,color:"#4b5563",letterSpacing:2,textTransform:"uppercase",marginBottom:16,fontWeight:700}}>সব গ্রুপ · ক্লিক করে squad দেখুন</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
                {Object.entries(GROUPS).map(([grp,teams],gi)=>(
                  <div key={grp} className="fu" style={{animationDelay:`${gi*30}ms`}}>
                    {/* Group header */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{width:32,height:32,background:"linear-gradient(135deg,#10b981,#047857)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:18,color:"#fff"}}>
                        {grp}
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:"#6b7280",letterSpacing:1,textTransform:"uppercase"}}>Group {grp}</div>
                    </div>
                    {/* Team cards */}
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {teams.map((team,ti)=>(
                        <div key={team} className="teamcard" onClick={()=>setSelectedTeam(team)}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10}}>
                          <span style={{fontSize:22,flexShrink:0}}>{FLAGS[team]||"🏳"}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team}</div>
                          </div>
                          <span style={{fontSize:11,color:"#10b981",flexShrink:0}}>Squad →</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Squad Modal */}
        {selectedTeam && <TeamSquad teamName={selectedTeam} onClose={()=>setSelectedTeam(null)}/>}

        <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}`}</style>
      </div>
    </>
  );
}
