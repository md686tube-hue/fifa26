import { useState, useEffect, useRef, useMemo } from "react";

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

const GROUPS = {
  A:["Mexico","South Africa","South Korea","Czech Republic"],
  B:["Canada","Bosnia & Herzegovina","Qatar","Switzerland"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["USA","Paraguay","Australia","Turkey"],
  E:["Germany","Curaçao","Ivory Coast","Ecuador"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"],
};

const STAGE_COLORS = {
  "Group Stage": "#10b981",
  "Round of 32": "#3b82f6",
  "Round of 16": "#8b5cf6",
  "Quarter-Final": "#f59e0b",
  "Semi-Final": "#ef4444",
  "3rd Place": "#6b7280",
  "Champion": "#fbbf24",
};

const STAGES = ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final","Final"];

// Demo journey data — in real app this comes from match results
const DEMO_JOURNEYS = {
  Argentina: {
    stages: ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final","Champion"],
    results: [
      { stage:"Group Stage", opponent:"Algeria", score:"3-0", result:"W", date:"Jun 16" },
      { stage:"Group Stage", opponent:"Austria", score:"2-1", result:"W", date:"Jun 22" },
      { stage:"Group Stage", opponent:"Jordan", score:"4-0", result:"W", date:"Jun 27" },
      { stage:"Round of 32", opponent:"Saudi Arabia", score:"2-0", result:"W", date:"Jul 3" },
      { stage:"Round of 16", opponent:"Ecuador", score:"1-0", result:"W", date:"Jul 6" },
      { stage:"Quarter-Final", opponent:"France", score:"2-1", result:"W", date:"Jul 11" },
      { stage:"Semi-Final", opponent:"England", score:"3-1", result:"W", date:"Jul 14" },
      { stage:"Final", opponent:"Brazil", score:"1-0 (AET)", result:"W", date:"Jul 19" },
    ],
    eliminated: null,
    group: "J",
  },
  Brazil: {
    stages: ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final","Final"],
    results: [
      { stage:"Group Stage", opponent:"Morocco", score:"3-1", result:"W", date:"Jun 13" },
      { stage:"Group Stage", opponent:"Haiti", score:"5-0", result:"W", date:"Jun 19" },
      { stage:"Group Stage", opponent:"Scotland", score:"2-0", result:"W", date:"Jun 24" },
      { stage:"Round of 32", opponent:"Switzerland", score:"2-0", result:"W", date:"Jul 1" },
      { stage:"Round of 16", opponent:"USA", score:"2-1", result:"W", date:"Jul 5" },
      { stage:"Quarter-Final", opponent:"Germany", score:"3-2", result:"W", date:"Jul 10" },
      { stage:"Semi-Final", opponent:"Spain", score:"2-0", result:"W", date:"Jul 15" },
      { stage:"Final", opponent:"Argentina", score:"0-1 (AET)", result:"L", date:"Jul 19" },
    ],
    eliminated: "Final",
    group: "C",
  },
  France: {
    stages: ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final"],
    results: [
      { stage:"Group Stage", opponent:"Senegal", score:"2-0", result:"W", date:"Jun 16" },
      { stage:"Group Stage", opponent:"Iraq", score:"4-0", result:"W", date:"Jun 22" },
      { stage:"Group Stage", opponent:"Norway", score:"1-0", result:"W", date:"Jun 26" },
      { stage:"Round of 32", opponent:"Turkey", score:"2-0", result:"W", date:"Jul 2" },
      { stage:"Round of 16", opponent:"Belgium", score:"1-0", result:"W", date:"Jul 4" },
      { stage:"Quarter-Final", opponent:"Argentina", score:"1-2", result:"L", date:"Jul 11" },
    ],
    eliminated: "Quarter-Final",
    group: "I",
  },
  England: {
    stages: ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final"],
    results: [
      { stage:"Group Stage", opponent:"Croatia", score:"2-0", result:"W", date:"Jun 17" },
      { stage:"Group Stage", opponent:"Ghana", score:"3-0", result:"W", date:"Jun 23" },
      { stage:"Group Stage", opponent:"Panama", score:"4-1", result:"W", date:"Jun 27" },
      { stage:"Round of 32", opponent:"Netherlands", score:"2-1", result:"W", date:"Jul 3" },
      { stage:"Round of 16", opponent:"Portugal", score:"1-0", result:"W", date:"Jul 7" },
      { stage:"Quarter-Final", opponent:"Colombia", score:"2-0", result:"W", date:"Jul 9" },
      { stage:"Semi-Final", opponent:"Argentina", score:"1-3", result:"L", date:"Jul 14" },
    ],
    eliminated: "Semi-Final",
    group: "L",
  },
  Spain: {
    stages: ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final"],
    results: [
      { stage:"Group Stage", opponent:"Cape Verde", score:"5-0", result:"W", date:"Jun 15" },
      { stage:"Group Stage", opponent:"Saudi Arabia", score:"3-0", result:"W", date:"Jun 21" },
      { stage:"Group Stage", opponent:"Uruguay", score:"2-1", result:"W", date:"Jun 26" },
      { stage:"Round of 32", opponent:"Morocco", score:"1-0", result:"W", date:"Jul 2" },
      { stage:"Round of 16", opponent:"Japan", score:"2-1", result:"W", date:"Jul 6" },
      { stage:"Quarter-Final", opponent:"Norway", score:"3-0", result:"W", date:"Jul 9" },
      { stage:"Semi-Final", opponent:"Brazil", score:"0-2", result:"L", date:"Jul 15" },
    ],
    eliminated: "Semi-Final",
    group: "H",
  },
  Germany: {
    stages: ["Group Stage","Round of 32","Round of 16","Quarter-Final"],
    results: [
      { stage:"Group Stage", opponent:"Curaçao", score:"5-0", result:"W", date:"Jun 14" },
      { stage:"Group Stage", opponent:"Ivory Coast", score:"3-2", result:"W", date:"Jun 20" },
      { stage:"Group Stage", opponent:"Ecuador", score:"2-0", result:"W", date:"Jun 25" },
      { stage:"Round of 32", opponent:"Czech Republic", score:"3-0", result:"W", date:"Jul 1" },
      { stage:"Round of 16", opponent:"Sweden", score:"2-1", result:"W", date:"Jul 4" },
      { stage:"Quarter-Final", opponent:"Brazil", score:"2-3", result:"L", date:"Jul 10" },
    ],
    eliminated: "Quarter-Final",
    group: "E",
  },
  Portugal: {
    stages: ["Group Stage","Round of 32","Round of 16"],
    results: [
      { stage:"Group Stage", opponent:"DR Congo", score:"4-0", result:"W", date:"Jun 17" },
      { stage:"Group Stage", opponent:"Uzbekistan", score:"4-0", result:"W", date:"Jun 23" },
      { stage:"Group Stage", opponent:"Colombia", score:"2-1", result:"W", date:"Jun 27" },
      { stage:"Round of 32", opponent:"Ghana", score:"3-0", result:"W", date:"Jul 3" },
      { stage:"Round of 16", opponent:"England", score:"0-1", result:"L", date:"Jul 7" },
    ],
    eliminated: "Round of 16",
    group: "K",
  },
  Netherlands: {
    stages: ["Group Stage","Round of 32"],
    results: [
      { stage:"Group Stage", opponent:"Japan", score:"3-1", result:"W", date:"Jun 14" },
      { stage:"Group Stage", opponent:"Sweden", score:"2-1", result:"W", date:"Jun 20" },
      { stage:"Group Stage", opponent:"Tunisia", score:"2-0", result:"W", date:"Jun 25" },
      { stage:"Round of 32", opponent:"England", score:"1-2", result:"L", date:"Jul 3" },
    ],
    eliminated: "Round of 32",
    group: "F",
  },
  Morocco: {
    stages: ["Group Stage","Round of 32"],
    results: [
      { stage:"Group Stage", opponent:"Brazil", score:"1-3", result:"L", date:"Jun 13" },
      { stage:"Group Stage", opponent:"Scotland", score:"2-0", result:"W", date:"Jun 19" },
      { stage:"Group Stage", opponent:"Haiti", score:"3-0", result:"W", date:"Jun 24" },
      { stage:"Round of 32", opponent:"Spain", score:"0-1", result:"L", date:"Jul 2" },
    ],
    eliminated: "Round of 32",
    group: "C",
  },
  Mexico: {
    stages: ["Group Stage"],
    results: [
      { stage:"Group Stage", opponent:"South Africa", score:"2-1", result:"W", date:"Jun 11" },
      { stage:"Group Stage", opponent:"South Korea", score:"1-2", result:"L", date:"Jun 18" },
      { stage:"Group Stage", opponent:"Czech Republic", score:"0-1", result:"L", date:"Jun 24" },
    ],
    eliminated: "Group Stage",
    group: "A",
  },
};

// Fill remaining teams with group stage elimination
const ALL_TEAMS = Object.values(GROUPS).flat();
const JOURNEY_DATA = { ...DEMO_JOURNEYS };
ALL_TEAMS.forEach(team => {
  if (!JOURNEY_DATA[team]) {
    const grp = Object.entries(GROUPS).find(([,ts]) => ts.includes(team))?.[0] || "A";
    JOURNEY_DATA[team] = {
      stages: ["Group Stage"],
      results: [
        { stage:"Group Stage", opponent:"TBD", score:"–", result:"–", date:"Jun –" },
      ],
      eliminated: "Group Stage",
      group: grp,
    };
  }
});

const STAGE_X = {
  "Group Stage": 120,
  "Round of 32": 260,
  "Round of 16": 400,
  "Quarter-Final": 530,
  "Semi-Final": 650,
  "Final": 760,
  "Champion": 870,
};

const RESULT_COLOR = { W: "#10b981", L: "#ef4444", D: "#f59e0b" };

export default function TournamentJourneyMap() {
  const [selectedTeam, setSelectedTeam] = useState("Argentina");
  const [searchQ, setSearchQ] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const [hoveredStage, setHoveredStage] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const svgRef = useRef(null);

  const journey = JOURNEY_DATA[selectedTeam] || JOURNEY_DATA["Argentina"];

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [selectedTeam]);

  const filteredTeams = useMemo(() => {
    let teams = ALL_TEAMS;
    if (filter !== "ALL") teams = teams.filter(t => JOURNEY_DATA[t]?.group === filter);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      teams = teams.filter(t => t.toLowerCase().includes(q));
    }
    return teams;
  }, [filter, searchQ]);

  // How far did they go
  const getFurthestStage = (team) => {
    const j = JOURNEY_DATA[team];
    if (!j) return "Group Stage";
    const last = j.stages[j.stages.length - 1];
    if (!j.eliminated) return "Champion";
    return last;
  };

  const stageOrder = ["Group Stage","Round of 32","Round of 16","Quarter-Final","Semi-Final","Final","Champion"];
  const stageIdx = (s) => stageOrder.indexOf(s);

  // SVG path for journey
  const buildPath = (stages) => {
    const points = stages.map((s, i) => {
      const x = STAGE_X[s] || 120;
      const y = 100;
      return `${x},${y}`;
    });
    if (points.length === 1) return `M ${points[0]}`;
    return `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(" ");
  };

  const dark = {
    bg: "#060f08",
    card: "rgba(255,255,255,.04)",
    border: "rgba(255,255,255,.08)",
    text: "#e5e7eb",
    sub: "#6b7280",
    accent: "#10b981",
    dim: "#374151",
  };

  const stagesForTeam = journey.stages || ["Group Stage"];
  const lastStage = stagesForTeam[stagesForTeam.length - 1];
  const isChampion = !journey.eliminated;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060f08; font-family: 'DM Sans', sans-serif; }
        @keyframes drawPath {
          from { stroke-dashoffset: 2000; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes popIn {
          0% { transform: scale(0) translateY(4px); opacity: 0; }
          70% { transform: scale(1.2) translateY(-2px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .team-btn { background: rgba(255,255,255,.03); border: .5px solid rgba(255,255,255,.07); border-radius: 8px; padding: 7px 10px; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all .18s; text-align: left; width: 100%; }
        .team-btn:hover { background: rgba(16,185,129,.1); border-color: rgba(16,185,129,.3); }
        .team-btn.active { background: rgba(16,185,129,.15); border-color: rgba(16,185,129,.5); }
        .stage-node { cursor: pointer; transition: all .2s; }
        .stage-node:hover circle { filter: brightness(1.3); }
        .result-row { animation: fadeSlide .3s ease both; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 2px; }
        input { background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.1); border-radius: 8px; color: #e5e7eb; padding: 8px 12px; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; width: 100%; }
        input:focus { border-color: #10b981; }
        input::placeholder { color: #4b5563; }
        .champion-glow { animation: shimmer 3s linear infinite; background: linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24, #fde68a, #fbbf24); background-size: 200% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      <div style={{ minHeight: "100vh", background: dark.bg, color: dark.text, padding: "20px 16px" }}>

        {/* Header */}
        <div style={{ maxWidth: 1100, margin: "0 auto 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, letterSpacing: 4, color: "#10b981" }}>
              TOURNAMENT JOURNEY MAP
            </div>
            <div style={{ flex: 1, height: 1, background: "rgba(16,185,129,.2)" }} />
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 2, color: "#4b5563" }}>
              FIFA WORLD CUP 2026
            </div>
          </div>
          <div style={{ fontSize: 12, color: dark.sub }}>
            প্রতিটি দলের পুরো টুর্নামেন্ট যাত্রা — animated path হিসেবে · ৪৮ দল · ৭টি রাউন্ড
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>

          {/* Left panel — team list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="🔍 দল খুঁজুন..."
            />
            {/* Group filter */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["ALL", ...Object.keys(GROUPS)].map(g => (
                <button key={g} onClick={() => setFilter(g)}
                  style={{ padding: "3px 8px", borderRadius: 5, border: `.5px solid ${filter === g ? "#10b981" : "rgba(255,255,255,.08)"}`, background: filter === g ? "rgba(16,185,129,.15)" : "transparent", color: filter === g ? "#10b981" : dark.sub, cursor: "pointer", fontSize: 11, fontFamily: "'Bebas Neue',cursive", letterSpacing: 1 }}>
                  {g === "ALL" ? "ALL" : g}
                </button>
              ))}
            </div>

            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredTeams.map(team => {
                const j = JOURNEY_DATA[team];
                const far = getFurthestStage(team);
                const si = stageIdx(far);
                const isChamp = !j?.eliminated;
                return (
                  <button key={team} className={`team-btn${selectedTeam === team ? " active" : ""}`}
                    onClick={() => setSelectedTeam(team)}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{FLAGS[team] || "🏳"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selectedTeam === team ? "#10b981" : dark.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team}</div>
                      <div style={{ fontSize: 10, color: isChamp ? "#fbbf24" : si >= 4 ? "#10b981" : si >= 2 ? "#3b82f6" : dark.sub, marginTop: 1 }}>
                        {isChamp ? "🏆 Champion" : far}
                      </div>
                    </div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: isChamp ? "#fbbf24" : STAGE_COLORS[far] || "#374151", flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel — journey visualization */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Team hero */}
            <div style={{ background: dark.card, border: `.5px solid ${dark.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, animation: "fadeSlide .3s ease" }}>
              <div style={{ fontSize: 56 }}>{FLAGS[selectedTeam] || "🏳"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, letterSpacing: 3, lineHeight: 1, ...(isChampion ? {} : { color: dark.text }) }}>
                  {isChampion
                    ? <span className="champion-glow">{selectedTeam.toUpperCase()}</span>
                    : selectedTeam.toUpperCase()
                  }
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: "rgba(16,185,129,.12)", color: "#10b981", border: ".5px solid rgba(16,185,129,.3)" }}>
                    Group {journey.group}
                  </span>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 99, background: isChampion ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.05)", color: isChampion ? "#fbbf24" : dark.sub, border: `.5px solid ${isChampion ? "rgba(251,191,36,.3)" : "rgba(255,255,255,.08)"}` }}>
                    {isChampion ? "🏆 CHAMPION" : `বিদায়: ${journey.eliminated}`}
                  </span>
                  <span style={{ fontSize: 11, color: dark.sub }}>
                    {journey.results?.length || 0} ম্যাচ খেলেছে
                  </span>
                  {journey.results && (
                    <>
                      <span style={{ fontSize: 11, color: "#10b981" }}>
                        {journey.results.filter(r => r.result === "W").length}জয়
                      </span>
                      <span style={{ fontSize: 11, color: "#ef4444" }}>
                        {journey.results.filter(r => r.result === "L").length}হার
                      </span>
                    </>
                  )}
                </div>
              </div>
              {isChampion && (
                <div style={{ fontSize: 48, animation: "pulse 2s infinite" }}>🏆</div>
              )}
            </div>

            {/* Animated Journey SVG */}
            <div style={{ background: dark.card, border: `.5px solid ${dark.border}`, borderRadius: 14, padding: "20px 16px", overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: dark.sub, letterSpacing: 2, marginBottom: 12, fontFamily: "'Bebas Neue',cursive" }}>TOURNAMENT PATH</div>
              <div style={{ overflowX: "auto" }}>
                <svg key={animKey} width="900" height="160" viewBox="0 0 920 160" style={{ minWidth: 700 }} ref={svgRef}>
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#10b981" opacity=".6"/>
                    </marker>
                  </defs>

                  {/* Stage labels at top */}
                  {Object.entries(STAGE_X).map(([stage, x]) => (
                    <g key={stage}>
                      <text x={x} y={18} textAnchor="middle" fontSize="9" fill={hoveredStage === stage ? "#10b981" : "#4b5563"} fontFamily="'Bebas Neue', cursive" letterSpacing="1" style={{ transition: "fill .2s" }}>
                        {stage.toUpperCase()}
                      </text>
                      <line x1={x} y1={24} x2={x} y2={148} stroke={hoveredStage === stage ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.04)"} strokeWidth="1" strokeDasharray="3,4" style={{ transition: "stroke .2s" }} />
                    </g>
                  ))}

                  {/* All other teams' paths (faded) */}
                  {Object.entries(JOURNEY_DATA)
                    .filter(([team]) => team !== selectedTeam && JOURNEY_DATA[team]?.stages?.length > 1)
                    .map(([team, j]) => {
                      const pts = j.stages.map(s => `${STAGE_X[s] || 120},100`);
                      if (pts.length < 2) return null;
                      return (
                        <path key={team}
                          d={`M ${pts[0]} ` + pts.slice(1).map(p => `L ${p}`).join(" ")}
                          stroke="rgba(255,255,255,.04)" strokeWidth="1.5" fill="none"
                        />
                      );
                    })}

                  {/* Selected team path */}
                  {(() => {
                    const pts = stagesForTeam.map(s => `${STAGE_X[s] || 120},100`);
                    if (pts.length < 2) return null;
                    const pathD = `M ${pts[0]} ` + pts.slice(1).map(p => `L ${p}`).join(" ");
                    const pathLen = stagesForTeam.length * 150;
                    return (
                      <>
                        {/* Glow trail */}
                        <path d={pathD} stroke={isChampion ? "rgba(251,191,36,.25)" : "rgba(16,185,129,.2)"}
                          strokeWidth="12" fill="none" strokeLinecap="round" />
                        {/* Main line */}
                        <path d={pathD}
                          stroke={isChampion ? "#fbbf24" : "#10b981"}
                          strokeWidth="2.5" fill="none" strokeLinecap="round"
                          strokeDasharray={pathLen}
                          style={{
                            strokeDashoffset: pathLen,
                            animation: `drawPath 1.2s ease forwards`,
                          }}
                          filter="url(#glow)"
                        />
                      </>
                    );
                  })()}

                  {/* Stage nodes for selected team */}
                  {stagesForTeam.map((stage, i) => {
                    const x = STAGE_X[stage] || 120;
                    const y = 100;
                    const result = journey.results?.find(r => r.stage === stage);
                    const isLast = i === stagesForTeam.length - 1;
                    const isWin = result?.result === "W";
                    const nodeColor = isLast && !journey.eliminated ? "#fbbf24"
                      : isLast ? "#ef4444"
                      : "#10b981";

                    return (
                      <g key={stage} className="stage-node"
                        onMouseEnter={() => setHoveredStage(stage)}
                        onMouseLeave={() => setHoveredStage(null)}
                        style={{ animation: `popIn .4s ease ${i * 0.15}s both` }}>
                        {/* Outer ring */}
                        <circle cx={x} cy={y} r={isLast ? 16 : 12}
                          fill={`${nodeColor}18`} stroke={nodeColor} strokeWidth={isLast ? 2 : 1.5}
                          strokeDasharray={isLast && !journey.eliminated ? "none" : "none"}
                        />
                        {/* Inner dot */}
                        <circle cx={x} cy={y} r={isLast ? 8 : 5} fill={nodeColor} />

                        {/* Opponent label below */}
                        {result && result.opponent !== "TBD" && (
                          <>
                            <text x={x} y={y + 26} textAnchor="middle" fontSize="9" fill={dark.sub} fontFamily="'DM Sans', sans-serif">
                              vs {result.opponent.length > 10 ? result.opponent.slice(0, 9) + "…" : result.opponent}
                            </text>
                            <text x={x} y={y + 38} textAnchor="middle" fontSize="10" fill={RESULT_COLOR[result.result] || dark.sub} fontFamily="'Bebas Neue', cursive" letterSpacing="1">
                              {result.score}
                            </text>
                          </>
                        )}

                        {/* Trophy for champion */}
                        {isLast && !journey.eliminated && (
                          <text x={x} y={y + 5} textAnchor="middle" fontSize="12">🏆</text>
                        )}

                        {/* Date above */}
                        {result && (
                          <text x={x} y={y - 20} textAnchor="middle" fontSize="8" fill="#4b5563" fontFamily="'DM Sans', sans-serif">
                            {result.date}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Eliminated marker */}
                  {journey.eliminated && journey.eliminated !== "Group Stage" && (() => {
                    const lastStageForElim = stagesForTeam[stagesForTeam.length - 1];
                    const x = (STAGE_X[lastStageForElim] || 120) + 50;
                    return (
                      <g style={{ animation: `popIn .4s ease ${stagesForTeam.length * 0.15}s both` }}>
                        <text x={x} y={97} textAnchor="middle" fontSize="16" fill="#ef4444" opacity=".7">✕</text>
                        <text x={x} y={112} textAnchor="middle" fontSize="8" fill="#ef4444" opacity=".6" fontFamily="'Bebas Neue',cursive" letterSpacing="1">OUT</text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Match results list */}
            <div style={{ background: dark.card, border: `.5px solid ${dark.border}`, borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 2, color: dark.sub, marginBottom: 12 }}>ম্যাচ বিবরণ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {journey.results?.filter(r => r.opponent !== "TBD").map((r, i) => (
                  <div key={i} className="result-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,.02)", border: `.5px solid ${dark.border}`, borderRadius: 9, animationDelay: `${i * 0.07}s` }}>
                    {/* Stage badge */}
                    <div style={{ padding: "2px 8px", borderRadius: 5, background: `${STAGE_COLORS[r.stage] || "#374151"}18`, border: `.5px solid ${STAGE_COLORS[r.stage] || "#374151"}44`, fontSize: 10, color: STAGE_COLORS[r.stage] || dark.sub, minWidth: 90, textAlign: "center", fontFamily: "'Bebas Neue',cursive", letterSpacing: 1 }}>
                      {r.stage}
                    </div>
                    {/* Date */}
                    <div style={{ fontSize: 11, color: dark.sub, minWidth: 44 }}>{r.date}</div>
                    {/* Match */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{FLAGS[selectedTeam] || "🏳"}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: dark.text }}>{selectedTeam}</span>
                      <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 16, color: RESULT_COLOR[r.result] || dark.sub, minWidth: 60, textAlign: "center" }}>{r.score}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: dark.text }}>{r.opponent}</span>
                      <span style={{ fontSize: 14 }}>{FLAGS[r.opponent] || "🏳"}</span>
                    </div>
                    {/* Result badge */}
                    <div style={{ padding: "3px 10px", borderRadius: 99, background: r.result === "W" ? "rgba(16,185,129,.12)" : r.result === "L" ? "rgba(239,68,68,.12)" : "rgba(245,158,11,.12)", color: RESULT_COLOR[r.result] || dark.sub, fontSize: 11, fontWeight: 700, border: `.5px solid ${RESULT_COLOR[r.result] || dark.sub}44`, minWidth: 36, textAlign: "center" }}>
                      {r.result === "W" ? "জয়" : r.result === "L" ? "হার" : r.result === "D" ? "ড্র" : "–"}
                    </div>
                  </div>
                ))}
                {(!journey.results || journey.results.every(r => r.opponent === "TBD")) && (
                  <div style={{ textAlign: "center", padding: "24px 0", color: dark.sub, fontSize: 13 }}>
                    টুর্নামেন্ট শুরু হলে এখানে ম্যাচের বিবরণ আসবে
                  </div>
                )}
              </div>
            </div>

            {/* Stage legend */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(STAGE_COLORS).map(([stage, color]) => (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: `${color}10`, border: `.5px solid ${color}33`, borderRadius: 99 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 11, color, fontFamily: "'Bebas Neue',cursive", letterSpacing: .5 }}>{stage}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
