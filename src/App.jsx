import { useState, useMemo, useEffect } from "react";

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

const SQUADS = {
  Argentina: {
    coach:"Lionel Scaloni",
    players:[
      {name:"Emiliano Martínez",pos:"GK",club:"Aston Villa",num:1},
      {name:"Franco Armani",pos:"GK",club:"River Plate",num:12},
      {name:"Nahuel Molina",pos:"DEF",club:"Atlético Madrid",num:26},
      {name:"Cristian Romero",pos:"DEF",club:"Tottenham",num:13},
      {name:"Nicolás Otamendi",pos:"DEF",club:"Benfica",num:19},
      {name:"Lisandro Martínez",pos:"DEF",club:"Man United",num:6},
      {name:"Marcos Acuña",pos:"DEF",club:"Sevilla",num:8},
      {name:"Nicolás Tagliafico",pos:"DEF",club:"Lyon",num:3},
      {name:"Rodrigo De Paul",pos:"MID",club:"Atlético Madrid",num:7},
      {name:"Enzo Fernández",pos:"MID",club:"Chelsea",num:24},
      {name:"Alexis Mac Allister",pos:"MID",club:"Liverpool",num:20},
      {name:"Leandro Paredes",pos:"MID",club:"Roma",num:5},
      {name:"Giovani Lo Celso",pos:"MID",club:"Villarreal",num:18},
      {name:"Lionel Messi",pos:"FWD",club:"Inter Miami",num:10},
      {name:"Julián Álvarez",pos:"FWD",club:"Atlético Madrid",num:9},
      {name:"Lautaro Martínez",pos:"FWD",club:"Inter Milan",num:22},
      {name:"Nicolás González",pos:"FWD",club:"Juventus",num:11},
      {name:"Paulo Dybala",pos:"FWD",club:"Roma",num:21},
    ]
  },
  Brazil: {
    coach:"Dorival Júnior",
    players:[
      {name:"Alisson Becker",pos:"GK",club:"Liverpool",num:1},
      {name:"Ederson",pos:"GK",club:"Man City",num:23},
      {name:"Danilo",pos:"DEF",club:"Juventus",num:2},
      {name:"Marquinhos",pos:"DEF",club:"PSG",num:5},
      {name:"Gabriel Magalhães",pos:"DEF",club:"Arsenal",num:4},
      {name:"Guilherme Arana",pos:"DEF",club:"Atlético Mineiro",num:6},
      {name:"Éder Militão",pos:"DEF",club:"Real Madrid",num:3},
      {name:"Casemiro",pos:"MID",club:"Man United",num:8},
      {name:"Bruno Guimarães",pos:"MID",club:"Newcastle",num:17},
      {name:"Lucas Paquetá",pos:"MID",club:"West Ham",num:10},
      {name:"Rodrygo",pos:"FWD",club:"Real Madrid",num:11},
      {name:"Vinicius Jr",pos:"FWD",club:"Real Madrid",num:7},
      {name:"Raphinha",pos:"FWD",club:"Barcelona",num:19},
      {name:"Gabriel Martinelli",pos:"FWD",club:"Arsenal",num:22},
      {name:"Endrick",pos:"FWD",club:"Real Madrid",num:9},
      {name:"Savinho",pos:"FWD",club:"Man City",num:20},
    ]
  },
  France: {
    coach:"Didier Deschamps",
    players:[
      {name:"Mike Maignan",pos:"GK",club:"AC Milan",num:1},
      {name:"Alphonse Areola",pos:"GK",club:"West Ham",num:23},
      {name:"Benjamin Pavard",pos:"DEF",club:"Inter Milan",num:2},
      {name:"Dayot Upamecano",pos:"DEF",club:"Bayern Munich",num:5},
      {name:"William Saliba",pos:"DEF",club:"Arsenal",num:17},
      {name:"Theo Hernandez",pos:"DEF",club:"AC Milan",num:22},
      {name:"Jules Koundé",pos:"DEF",club:"Barcelona",num:4},
      {name:"Aurélien Tchouameni",pos:"MID",club:"Real Madrid",num:8},
      {name:"Eduardo Camavinga",pos:"MID",club:"Real Madrid",num:14},
      {name:"Antoine Griezmann",pos:"MID",club:"Atlético Madrid",num:7},
      {name:"Adrien Rabiot",pos:"MID",club:"Marseille",num:16},
      {name:"Kylian Mbappé",pos:"FWD",club:"Real Madrid",num:10},
      {name:"Olivier Giroud",pos:"FWD",club:"LA Galaxy",num:9},
      {name:"Ousmane Dembélé",pos:"FWD",club:"PSG",num:11},
      {name:"Marcus Thuram",pos:"FWD",club:"Inter Milan",num:15},
      {name:"Randal Kolo Muani",pos:"FWD",club:"PSG",num:20},
    ]
  },
  England: {
    coach:"Lee Carsley",
    players:[
      {name:"Jordan Pickford",pos:"GK",club:"Everton",num:1},
      {name:"Aaron Ramsdale",pos:"GK",club:"Southampton",num:13},
      {name:"Kyle Walker",pos:"DEF",club:"Bayern Munich",num:2},
      {name:"John Stones",pos:"DEF",club:"Man City",num:5},
      {name:"Harry Maguire",pos:"DEF",club:"Man United",num:6},
      {name:"Luke Shaw",pos:"DEF",club:"Man United",num:3},
      {name:"Trent Alexander-Arnold",pos:"DEF",club:"Real Madrid",num:12},
      {name:"Declan Rice",pos:"MID",club:"Arsenal",num:4},
      {name:"Jude Bellingham",pos:"MID",club:"Real Madrid",num:10},
      {name:"Bukayo Saka",pos:"MID",club:"Arsenal",num:7},
      {name:"Phil Foden",pos:"FWD",club:"Man City",num:11},
      {name:"Harry Kane",pos:"FWD",club:"Bayern Munich",num:9},
      {name:"Marcus Rashford",pos:"FWD",club:"Barcelona",num:19},
      {name:"Cole Palmer",pos:"MID",club:"Chelsea",num:20},
      {name:"Anthony Gordon",pos:"FWD",club:"Newcastle",num:17},
      {name:"Ollie Watkins",pos:"FWD",club:"Aston Villa",num:21},
    ]
  },
  Spain: {
    coach:"Luis de la Fuente",
    players:[
      {name:"Unai Simón",pos:"GK",club:"Athletic Bilbao",num:1},
      {name:"David Raya",pos:"GK",club:"Arsenal",num:13},
      {name:"Dani Carvajal",pos:"DEF",club:"Real Madrid",num:2},
      {name:"Aymeric Laporte",pos:"DEF",club:"Al-Nassr",num:14},
      {name:"Robin Le Normand",pos:"DEF",club:"Atlético Madrid",num:24},
      {name:"Marc Cucurella",pos:"DEF",club:"Chelsea",num:3},
      {name:"Rodri",pos:"MID",club:"Man City",num:16},
      {name:"Pedri",pos:"MID",club:"Barcelona",num:26},
      {name:"Gavi",pos:"MID",club:"Barcelona",num:6},
      {name:"Fabián Ruiz",pos:"MID",club:"PSG",num:8},
      {name:"Lamine Yamal",pos:"FWD",club:"Barcelona",num:19},
      {name:"Nico Williams",pos:"FWD",club:"Athletic Bilbao",num:11},
      {name:"Álvaro Morata",pos:"FWD",club:"AC Milan",num:9},
      {name:"Dani Olmo",pos:"FWD",club:"Barcelona",num:10},
      {name:"Ferran Torres",pos:"FWD",club:"Barcelona",num:7},
      {name:"Mikel Oyarzabal",pos:"FWD",club:"Real Sociedad",num:17},
    ]
  },
  Germany: {
    coach:"Julian Nagelsmann",
    players:[
      {name:"Manuel Neuer",pos:"GK",club:"Bayern Munich",num:1},
      {name:"Marc-André ter Stegen",pos:"GK",club:"Barcelona",num:12},
      {name:"Joshua Kimmich",pos:"DEF",club:"Bayern Munich",num:6},
      {name:"Antonio Rüdiger",pos:"DEF",club:"Real Madrid",num:2},
      {name:"Jonathan Tah",pos:"DEF",club:"Bayer Leverkusen",num:5},
      {name:"Maximilian Mittelstädt",pos:"DEF",club:"Stuttgart",num:3},
      {name:"Benjamin Henrichs",pos:"DEF",club:"RB Leipzig",num:24},
      {name:"Leon Goretzka",pos:"MID",club:"Bayern Munich",num:8},
      {name:"Florian Wirtz",pos:"MID",club:"Bayer Leverkusen",num:10},
      {name:"Jamal Musiala",pos:"MID",club:"Bayern Munich",num:14},
      {name:"Ilkay Gündogan",pos:"MID",club:"Barcelona",num:21},
      {name:"Serge Gnabry",pos:"FWD",club:"Bayern Munich",num:7},
      {name:"Kai Havertz",pos:"FWD",club:"Arsenal",num:9},
      {name:"Leroy Sané",pos:"FWD",club:"Bayern Munich",num:19},
      {name:"Thomas Müller",pos:"FWD",club:"Bayern Munich",num:25},
      {name:"Niclas Füllkrug",pos:"FWD",club:"West Ham",num:11},
    ]
  },
  Portugal: {
    coach:"Roberto Martínez",
    players:[
      {name:"Rui Patrício",pos:"GK",club:"Roma",num:1},
      {name:"Diogo Costa",pos:"GK",club:"Porto",num:12},
      {name:"João Cancelo",pos:"DEF",club:"Barcelona",num:20},
      {name:"Rúben Dias",pos:"DEF",club:"Man City",num:4},
      {name:"Pepe",pos:"DEF",club:"Porto",num:3},
      {name:"Nélson Semedo",pos:"DEF",club:"Wolves",num:2},
      {name:"Nuno Mendes",pos:"DEF",club:"PSG",num:19},
      {name:"Bruno Fernandes",pos:"MID",club:"Man United",num:8},
      {name:"Vitinha",pos:"MID",club:"PSG",num:16},
      {name:"João Palhinha",pos:"MID",club:"Bayern Munich",num:6},
      {name:"Bernardo Silva",pos:"MID",club:"Man City",num:10},
      {name:"Cristiano Ronaldo",pos:"FWD",club:"Al-Nassr",num:7},
      {name:"Pedro Neto",pos:"FWD",club:"Chelsea",num:17},
      {name:"Gonçalo Ramos",pos:"FWD",club:"PSG",num:9},
      {name:"Rafael Leão",pos:"FWD",club:"AC Milan",num:11},
      {name:"João Félix",pos:"FWD",club:"Barcelona",num:21},
    ]
  },
  Netherlands: {
    coach:"Ronald Koeman",
    players:[
      {name:"Bart Flekken",pos:"GK",club:"Brentford",num:1},
      {name:"Mark Flekken",pos:"GK",club:"Brentford",num:22},
      {name:"Denzel Dumfries",pos:"DEF",club:"Inter Milan",num:22},
      {name:"Stefan de Vrij",pos:"DEF",club:"Inter Milan",num:6},
      {name:"Virgil van Dijk",pos:"DEF",club:"Liverpool",num:4},
      {name:"Nathan Aké",pos:"DEF",club:"Man City",num:5},
      {name:"Daley Blind",pos:"DEF",club:"Girona",num:17},
      {name:"Frenkie de Jong",pos:"MID",club:"Barcelona",num:21},
      {name:"Tijjani Reijnders",pos:"MID",club:"AC Milan",num:8},
      {name:"Xavi Simons",pos:"MID",club:"PSG",num:10},
      {name:"Teun Koopmeiners",pos:"MID",club:"Juventus",num:14},
      {name:"Steven Bergwijn",pos:"FWD",club:"Ajax",num:7},
      {name:"Cody Gakpo",pos:"FWD",club:"Liverpool",num:11},
      {name:"Brian Brobbey",pos:"FWD",club:"Ajax",num:9},
      {name:"Donyell Malen",pos:"FWD",club:"Aston Villa",num:20},
      {name:"Wout Weghorst",pos:"FWD",club:"Hoffenheim",num:19},
    ]
  },
  Belgium: {
    coach:"Domenico Tedesco",
    players:[
      {name:"Thibaut Courtois",pos:"GK",club:"Real Madrid",num:1},
      {name:"Senne Lammens",pos:"GK",club:"Man United",num:23},
      {name:"Timothy Castagne",pos:"DEF",club:"Fulham",num:2},
      {name:"Zeno Debast",pos:"DEF",club:"Sporting CP",num:5},
      {name:"Arthur Theate",pos:"DEF",club:"Frankfurt",num:6},
      {name:"Maxim De Cuyper",pos:"DEF",club:"Brighton",num:3},
      {name:"Thomas Meunier",pos:"DEF",club:"Lille",num:15},
      {name:"Kevin De Bruyne",pos:"MID",club:"Napoli",num:7},
      {name:"Youri Tielemans",pos:"MID",club:"Aston Villa",num:8},
      {name:"Amadou Onana",pos:"MID",club:"Aston Villa",num:4},
      {name:"Hans Vanaken",pos:"MID",club:"Club Brugge",num:20},
      {name:"Nicolas Raskin",pos:"MID",club:"Rangers",num:18},
      {name:"Jeremy Doku",pos:"FWD",club:"Man City",num:11},
      {name:"Romelu Lukaku",pos:"FWD",club:"Napoli",num:9},
      {name:"Charles De Ketelaere",pos:"FWD",club:"Atalanta",num:10},
      {name:"Dodi Lukebakio",pos:"FWD",club:"Hertha BSC",num:14},
    ]
  },
  USA: {
    coach:"Mauricio Pochettino",
    players:[
      {name:"Matt Turner",pos:"GK",club:"Nottm Forest",num:1},
      {name:"Ethan Horvath",pos:"GK",club:"Cardiff City",num:12},
      {name:"Sergiño Dest",pos:"DEF",club:"PSV",num:2},
      {name:"Chris Richards",pos:"DEF",club:"Crystal Palace",num:5},
      {name:"Tim Ream",pos:"DEF",club:"Fulham",num:13},
      {name:"Antonee Robinson",pos:"DEF",club:"Arsenal",num:3},
      {name:"Walker Zimmermann",pos:"DEF",club:"Nashville SC",num:6},
      {name:"Weston McKennie",pos:"MID",club:"Juventus",num:8},
      {name:"Tyler Adams",pos:"MID",club:"Wolfsburg",num:4},
      {name:"Yunus Musah",pos:"MID",club:"AC Milan",num:14},
      {name:"Gio Reyna",pos:"MID",club:"Nottm Forest",num:7},
      {name:"Christian Pulisic",pos:"FWD",club:"AC Milan",num:10},
      {name:"Tim Weah",pos:"FWD",club:"Juventus",num:21},
      {name:"Josh Sargent",pos:"FWD",club:"Norwich",num:9},
      {name:"Folarin Balogun",pos:"FWD",club:"Monaco",num:17},
      {name:"Brenden Aaronson",pos:"MID",club:"Union Berlin",num:11},
    ]
  },
  Mexico: {
    coach:"Jaime Lozano",
    players:[
      {name:"Guillermo Ochoa",pos:"GK",club:"Club América",num:1},
      {name:"Luis Malagón",pos:"GK",club:"Club América",num:13},
      {name:"Jorge Sánchez",pos:"DEF",club:"Club América",num:19},
      {name:"Héctor Moreno",pos:"DEF",club:"Chivas",num:15},
      {name:"César Montes",pos:"DEF",club:"Espanyol",num:3},
      {name:"Jesús Gallardo",pos:"DEF",club:"Club León",num:23},
      {name:"Edson Álvarez",pos:"MID",club:"West Ham",num:10},
      {name:"Luis Romo",pos:"MID",club:"Cruz Azul",num:18},
      {name:"Carlos Rodríguez",pos:"MID",club:"Cruz Azul",num:14},
      {name:"Hirving Lozano",pos:"FWD",club:"PSV",num:22},
      {name:"Raúl Jiménez",pos:"FWD",club:"Fulham",num:9},
      {name:"Alexis Vega",pos:"FWD",club:"Querétaro",num:11},
      {name:"Henry Martín",pos:"FWD",club:"Club América",num:7},
      {name:"Roberto Alvarado",pos:"MID",club:"Chivas",num:20},
      {name:"Uriel Antuna",pos:"FWD",club:"Cruz Azul",num:16},
    ]
  },
  Japan: {
    coach:"Hajime Moriyasu",
    players:[
      {name:"Shuichi Gonda",pos:"GK",club:"Shimizu S-Pulse",num:1},
      {name:"Zion Suzuki",pos:"GK",club:"Sint-Truiden",num:23},
      {name:"Hiroki Sakai",pos:"DEF",club:"Urawa Reds",num:5},
      {name:"Ko Itakura",pos:"DEF",club:"Borussia M'gladbach",num:16},
      {name:"Takehiro Tomiyasu",pos:"DEF",club:"Arsenal",num:2},
      {name:"Yuto Nagatomo",pos:"DEF",club:"FC Tokyo",num:5},
      {name:"Wataru Endo",pos:"MID",club:"Liverpool",num:3},
      {name:"Gaku Shibasaki",pos:"MID",club:"Tokyo Verdy",num:17},
      {name:"Daichi Kamada",pos:"MID",club:"Lazio",num:14},
      {name:"Kaoru Mitoma",pos:"FWD",club:"Brighton",num:10},
      {name:"Ritsu Doan",pos:"FWD",club:"Freiburg",num:8},
      {name:"Hiroki Ito",pos:"DEF",club:"Stuttgart",num:9},
      {name:"Junya Ito",pos:"FWD",club:"Stade de Reims",num:7},
      {name:"Ayase Ueda",pos:"FWD",club:"Burnley",num:13},
      {name:"Takuma Asano",pos:"FWD",club:"VfL Bochum",num:19},
    ]
  },
  Morocco: {
    coach:"Walid Regragui",
    players:[
      {name:"Yassine Bounou",pos:"GK",club:"Al-Hilal",num:1},
      {name:"Munir Mohamedi",pos:"GK",club:"Almería",num:16},
      {name:"Achraf Hakimi",pos:"DEF",club:"PSG",num:2},
      {name:"Nayef Aguerd",pos:"DEF",club:"West Ham",num:5},
      {name:"Romain Saïss",pos:"DEF",club:"Beşiktaş",num:6},
      {name:"Noussair Mazraoui",pos:"DEF",club:"Bayern Munich",num:3},
      {name:"Yahia Attiyat Allah",pos:"DEF",club:"Wydad",num:13},
      {name:"Sofyan Amrabat",pos:"MID",club:"Fiorentina",num:4},
      {name:"Ilias Chair",pos:"MID",club:"QPR",num:8},
      {name:"Hakim Ziyech",pos:"MID",club:"Galatasaray",num:7},
      {name:"Azzedine Ounahi",pos:"MID",club:"Marseille",num:17},
      {name:"Youssef En-Nesyri",pos:"FWD",club:"Fenerbahçe",num:19},
      {name:"Soufiane Boufal",pos:"FWD",club:"Angers",num:11},
      {name:"Abdessamad Ezzalzouli",pos:"FWD",club:"Betis",num:20},
      {name:"Abde Ait",pos:"FWD",club:"Club Brugge",num:14},
    ]
  },
};

const ALL_TEAMS = Object.values(GROUPS).flat();
const posColors = {GK:"#f59e0b",DEF:"#3b82f6",MID:"#10b981",FWD:"#ef4444"};

// ── Match date parser ──────────────────────────────────────────────
// dateStr: "Jun 11"  etTime: "15:00"  → UTC ms (ET = UTC-4 in summer)
function matchUTC(dateStr, etTime) {
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const [mon, day] = dateStr.split(" ");
  const [h, m] = etTime.split(":").map(Number);
  // ET (UTC-4) → UTC: add 4 hours
  return Date.UTC(2026, months[mon], Number(day), h + 4, m, 0);
}

// ── Countdown hook — re-renders every second ───────────────────────
function useCountdown(targetUTC) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = targetUTC - now;
  if (diff <= 0) return null; // match started / finished
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { d, h, min, s, totalSec };
}

// ── Countdown display component ────────────────────────────────────
function MatchCountdown({ dateStr, etTime, isFav }) {
  const target = useMemo(() => matchUTC(dateStr, etTime), [dateStr, etTime]);
  const cd = useCountdown(target);
  const accent = isFav ? "#fbbf24" : "#10b981";
  const dimAccent = isFav ? "rgba(251,191,36,.15)" : "rgba(16,185,129,.12)";
  const borderAccent = isFav ? "rgba(251,191,36,.25)" : "rgba(16,185,129,.2)";

  // Match already started
  if (!cd) return (
    <div style={{display:"flex",alignItems:"center",gap:5,marginTop:5,padding:"3px 8px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:6}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"cdPulse 1s ease-in-out infinite"}}/>
      <span style={{fontSize:10,color:"#ef4444",fontWeight:700,letterSpacing:.5}}>শুরু হয়েছে / শেষ</span>
    </div>
  );

  // More than 1 day away — show compact "X দিন Y ঘণ্টা"
  if (cd.d >= 1) return (
    <div style={{display:"flex",alignItems:"center",gap:4,marginTop:5}}>
      <span style={{fontSize:10,color:"#6b7280"}}>বাকি</span>
      <span style={{fontSize:11,fontWeight:700,color:accent}}>{cd.d}দিন {cd.h}ঘণ্টা</span>
    </div>
  );

  // Less than 1 day — show full HH:MM:SS blocks
  const pad = n => String(n).padStart(2, "0");
  const blocks = cd.d === 0 && cd.h === 0
    ? [["মিনিট", pad(cd.min)], ["সেকেন্ড", pad(cd.s)]]
    : [["ঘণ্টা", pad(cd.h)], ["মিনিট", pad(cd.min)], ["সেকেন্ড", pad(cd.s)]];

  return (
    <div style={{display:"flex",alignItems:"center",gap:3,marginTop:6,flexWrap:"wrap"}}>
      <span style={{fontSize:9,color:"#6b7280",marginRight:2,letterSpacing:.3}}>শুরুতে বাকি</span>
      {blocks.map(([label, val], i) => (
        <span key={label} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
          <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,lineHeight:1,color:accent,background:dimAccent,border:`1px solid ${borderAccent}`,borderRadius:5,padding:"1px 6px",minWidth:28,textAlign:"center",letterSpacing:1}}>
            {val}
          </span>
          <span style={{fontSize:8,color:"#4b5563",marginTop:1}}>{label}</span>
          {i < blocks.length-1 && <span style={{display:"none"}}/>}
        </span>
      ))}
    </div>
  );
}

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

export default function App() {
  const [tab, setTab] = useState("fixtures");
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureFilter, setFixtureFilter] = useState("ALL");
  const [squadTeam, setSquadTeam] = useState(null);
  const [koRound, setKoRound] = useState(0);

  // ── Favorite team ──────────────────────────────────────────────
  const [favTeam, setFavTeam] = useState(() => {
    try { return localStorage.getItem("fifa26_fav") || null; }
    catch { return null; }
  });

  useEffect(() => {
    try {
      if (favTeam) localStorage.setItem("fifa26_fav", favTeam);
      else localStorage.removeItem("fifa26_fav");
    } catch {}
  }, [favTeam]);

  function toggleFav(team) {
    setFavTeam(prev => prev === team ? null : team);
  }
  // ──────────────────────────────────────────────────────────────

  const filteredFixtures = useMemo(() => {
    let list = ALL_GROUP_FIXTURES;
    if (fixtureFilter !== "ALL") list = list.filter(f => f.grp === fixtureFilter);
    if (fixtureSearch.trim()) {
      const q = fixtureSearch.toLowerCase();
      list = list.filter(f => f.home.toLowerCase().includes(q) || f.away.toLowerCase().includes(q));
    }
    // Favorite team-এর match গুলো সবার উপরে আনো
    if (favTeam) {
      list = [
        ...list.filter(f => f.home === favTeam || f.away === favTeam),
        ...list.filter(f => f.home !== favTeam && f.away !== favTeam),
      ];
    }
    return list;
  }, [fixtureFilter, fixtureSearch, favTeam]);

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
        .fi{animation:fadeIn 0.25s ease;}
        .fcard:hover{border-color:rgba(16,185,129,0.4)!important;background:rgba(16,185,129,0.04)!important;}
        .grpbtn:hover{border-color:rgba(16,185,129,0.4)!important;color:#d1fae5!important;}
        .scard:hover{transform:translateY(-1px);border-color:rgba(16,185,129,0.3)!important;}
        input[type=text]:focus{outline:1px solid #10b981;border-color:#10b981!important;}
        .kocard:hover{border-color:rgba(251,191,36,0.5)!important;background:rgba(251,191,36,0.03)!important;}
        .squadbtn:hover{border-color:#10b981!important;color:#10b981!important;}
        .pill{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.5px;}
        @keyframes favPulse{0%{box-shadow:0 0 0 0 rgba(251,191,36,.5);}70%{box-shadow:0 0 0 8px rgba(251,191,36,0);}100%{box-shadow:0 0 0 0 rgba(251,191,36,0);}}
        .fav-card{border-color:rgba(251,191,36,.4)!important;background:rgba(251,191,36,.04)!important;}
        .fav-card:hover{border-color:rgba(251,191,36,.7)!important;background:rgba(251,191,36,.07)!important;}
        .favbtn{background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:4px;border-radius:6px;transition:transform .15s;}
        .favbtn:hover{transform:scale(1.25);}
        @keyframes starPop{0%{transform:scale(1);}50%{transform:scale(1.5);}100%{transform:scale(1);}}
        @keyframes cdPulse{0%,100%{opacity:1;}50%{opacity:.3;}}
      `}</style>

      <div style={{minHeight:"100vh",background:"#060f08",color:"#e5e7eb",fontFamily:"'Outfit',sans-serif"}}>

        {/* HEADER */}
        <div style={{background:"linear-gradient(180deg,rgba(16,185,129,.08) 0%,transparent 100%)",borderBottom:"1px solid rgba(16,185,129,.15)",padding:"20px 20px 0"}}>
          <div style={{maxWidth:1060,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,flexWrap:"wrap"}}>
              <div style={{width:48,height:48,background:"linear-gradient(135deg,#10b981,#065f46)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>⚽</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,letterSpacing:3,color:"#10b981",lineHeight:1}}>FIFA WORLD CUP 2026</div>
                <div style={{fontSize:11,color:"#6b7280",letterSpacing:2,marginTop:2}}>USA · CANADA · MEXICO &nbsp;|&nbsp; JUN 11 – JUL 19 &nbsp;|&nbsp; সকল সময় বাংলাদেশ সময় (GMT+6)</div>
              </div>
              {[["48","Teams"],["12","Groups"],["104","Matches"]].map(([n,l])=>(
                <div key={l} style={{textAlign:"center",minWidth:48}}>
                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,color:"#10b981",lineHeight:1}}>{n}</div>
                  <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                </div>
              ))}
            </div>

            {/* ── Favorite team banner ── */}
            {favTeam && (
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",marginBottom:12,background:"rgba(251,191,36,.07)",border:"1px solid rgba(251,191,36,.25)",borderRadius:10}}>
                <span style={{fontSize:22}}>{FLAGS[favTeam]||"🏳"}</span>
                <div style={{flex:1}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#fbbf24"}}>{favTeam}</span>
                  <span style={{fontSize:11,color:"#92400e",marginLeft:8}}>তোমার প্রিয় দল · Fixtures-এ সবার উপরে দেখাচ্ছে</span>
                </div>
                <button onClick={()=>toggleFav(favTeam)} style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.3)",borderRadius:7,color:"#fbbf24",fontSize:11,fontWeight:700,padding:"4px 10px",cursor:"pointer"}}>
                  ✕ remove
                </button>
              </div>
            )}

            <div style={{display:"flex",gap:4}}>
              {tabs.map(({k,label})=>(
                <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 18px",background:tab===k?"rgba(16,185,129,.15)":"transparent",color:tab===k?"#10b981":"#6b7280",border:"none",borderBottom:tab===k?"2px solid #10b981":"2px solid transparent",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",transition:"all .2s"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{maxWidth:1060,margin:"0 auto",padding:"24px 20px"}}>

          {/* ===== FIXTURES TAB ===== */}
          {tab==="fixtures" && (
            <div className="fi">

              {/* ── আজকের ম্যাচ / পরবর্তী ম্যাচ section ── */}
              {(()=>{
                const nowUTC = Date.now();
                // BD date string বানাই — "Jun 11" format
                const bdNow = new Date(nowUTC + 6*3600*1000); // UTC+6
                const monNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const todayStr = monNames[bdNow.getUTCMonth()] + " " + bdNow.getUTCDate();

                const todayMatches = ALL_GROUP_FIXTURES.filter(f => f.dateStr === todayStr);
                // পরবর্তী upcoming match — যেটা এখনো শুরু হয়নি
                const upcoming = ALL_GROUP_FIXTURES
                  .filter(f => matchUTC(f.dateStr, f.etTime) > nowUTC)
                  .sort((a,b) => matchUTC(a.dateStr,a.etTime) - matchUTC(b.dateStr,b.etTime))[0];

                if (todayMatches.length > 0) return (
                  <div style={{marginBottom:24,padding:"16px 18px",background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.2)",borderRadius:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:"#10b981",display:"inline-block",animation:"cdPulse 1s ease-in-out infinite"}}/>
                      <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:2,color:"#10b981"}}>আজকের ম্যাচ</span>
                      <span style={{fontSize:11,color:"#6b7280"}}>{todayStr} 2026 · {todayMatches.length}টি ম্যাচ</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {todayMatches.map(fix=>{
                        const isFav = favTeam && (fix.home===favTeam||fix.away===favTeam);
                        const bd = bdTime(fix.etTime, fix.dateStr);
                        return (
                          <div key={fix.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:isFav?"rgba(251,191,36,.06)":"rgba(255,255,255,.03)",border:`1px solid ${isFav?"rgba(251,191,36,.3)":"rgba(16,185,129,.12)"}`,borderRadius:10}}>
                            <span style={{fontSize:20}}>{FLAGS[fix.home]||"🏳"}</span>
                            <span style={{fontWeight:700,fontSize:13,color:isFav&&fix.home===favTeam?"#fbbf24":"#e5e7eb"}}>{fix.home}</span>
                            <div style={{flex:1,textAlign:"center"}}>
                              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,color:"#6b7280"}}>VS · {bd}</div>
                              <MatchCountdown dateStr={fix.dateStr} etTime={fix.etTime} isFav={isFav}/>
                            </div>
                            <span style={{fontWeight:700,fontSize:13,color:isFav&&fix.away===favTeam?"#fbbf24":"#e5e7eb"}}>{fix.away}</span>
                            <span style={{fontSize:20}}>{FLAGS[fix.away]||"🏳"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );

                // আজকে কোনো ম্যাচ নেই — পরবর্তী match দেখাও
                if (upcoming) {
                  const isFav = favTeam && (upcoming.home===favTeam||upcoming.away===favTeam);
                  const bd = bdTime(upcoming.etTime, upcoming.dateStr);
                  return (
                    <div style={{marginBottom:24,padding:"14px 18px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:10,color:"#4b5563",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>পরবর্তী ম্যাচ</div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:18}}>{FLAGS[upcoming.home]||"🏳"}</span>
                          <span style={{fontWeight:700,fontSize:13}}>{upcoming.home}</span>
                          <span style={{color:"#4b5563",fontSize:11}}>vs</span>
                          <span style={{fontWeight:700,fontSize:13}}>{upcoming.away}</span>
                          <span style={{fontSize:18}}>{FLAGS[upcoming.away]||"🏳"}</span>
                        </div>
                        <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>{upcoming.dateStr} 2026 · {bd} BD · 📍 {upcoming.venue.split(",")[0]}</div>
                      </div>
                      <div style={{marginLeft:"auto"}}>
                        <MatchCountdown dateStr={upcoming.dateStr} etTime={upcoming.etTime} isFav={isFav}/>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

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
                    const isFavMatch = favTeam && (fix.home === favTeam || fix.away === favTeam);
                    return (
                      <div key={fix.id} className={`fcard${isFavMatch?" fav-card":""}`} style={{background:"rgba(255,255,255,.02)",border:`1px solid ${isFavMatch?"rgba(251,191,36,.4)":highlighted?"rgba(16,185,129,.35)":"rgba(255,255,255,.06)"}`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,transition:"all .2s",position:"relative"}}>

                        {/* Favorite badge */}
                        {isFavMatch && (
                          <div style={{position:"absolute",top:8,right:12,fontSize:10,fontWeight:700,color:"#fbbf24",letterSpacing:.5,display:"flex",alignItems:"center",gap:3}}>
                            ⭐ প্রিয় দল
                          </div>
                        )}

                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:38,gap:4}}>
                          <div style={{width:28,height:28,background:"rgba(16,185,129,.12)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:15,color:"#10b981"}}>{fix.grp}</div>
                        </div>
                        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,justifyContent:"flex-end"}}>
                            <span style={{fontSize:13,fontWeight:700,color:favTeam===fix.home?"#fbbf24":highlighted&&fix.home.toLowerCase().includes(fixtureSearch.toLowerCase())?"#10b981":"#e5e7eb",textAlign:"right"}}>{fix.home}</span>
                            <span style={{fontSize:22,cursor:"pointer"}} title={`${fix.home} কে favorite করো`} onClick={()=>toggleFav(fix.home)}>{FLAGS[fix.home]||"🏳"}</span>
                          </div>
                          <div style={{padding:"5px 12px",margin:"0 10px",background:isFavMatch?"rgba(251,191,36,.08)":"rgba(16,185,129,.08)",border:`1px solid ${isFavMatch?"rgba(251,191,36,.2)":"rgba(16,185,129,.2)"}`,borderRadius:7,textAlign:"center",minWidth:70}}>
                            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:"#6b7280",letterSpacing:1}}>VS</div>
                            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,color:isFavMatch?"#fbbf24":"#10b981",letterSpacing:1}}>{bd}</div>
                            <div style={{fontSize:9,color:"#4b5563"}}>BD সময়</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                            <span style={{fontSize:22,cursor:"pointer"}} title={`${fix.away} কে favorite করো`} onClick={()=>toggleFav(fix.away)}>{FLAGS[fix.away]||"🏳"}</span>
                            <span style={{fontSize:13,fontWeight:700,color:favTeam===fix.away?"#fbbf24":highlighted&&fix.away.toLowerCase().includes(fixtureSearch.toLowerCase())?"#10b981":"#e5e7eb"}}>{fix.away}</span>
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:150}}>
                          <div style={{fontSize:12,fontWeight:700,color:"#d1d5db"}}>{fix.dateStr} 2026</div>
                          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>📍 {fix.venue.split(",")[0]}</div>
                          <div style={{fontSize:10,color:"#4b5563",marginTop:1}}>{fix.venue.split(",").slice(1).join(",").trim()}</div>
                          <div style={{display:"flex",justifyContent:"flex-end"}}>
                            <MatchCountdown dateStr={fix.dateStr} etTime={fix.etTime} isFav={isFavMatch} />
                          </div>
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
                            <div style={{textAlign:"right",minWidth:150}}>
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
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
                {Object.keys(SQUADS).map(team=>(
                  <button key={team} className="squadbtn" onClick={()=>setSquadTeam(squadTeam===team?null:team)}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"8px 13px",borderRadius:8,border:`1px solid ${squadTeam===team?"#10b981":favTeam===team?"rgba(251,191,36,.5)":"rgba(255,255,255,.08)"}`,background:squadTeam===team?"rgba(16,185,129,.12)":favTeam===team?"rgba(251,191,36,.07)":"transparent",color:squadTeam===team?"#10b981":favTeam===team?"#fbbf24":"#9ca3af",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .2s"}}>
                    <span style={{fontSize:16}}>{FLAGS[team]}</span> {team}
                    {favTeam===team && <span style={{fontSize:12}}>⭐</span>}
                  </button>
                ))}
              </div>

              {!squadTeam && (
                <div style={{textAlign:"center",padding:"50px 0",color:"#4b5563"}}>
                  <div style={{fontSize:40,marginBottom:10}}>👕</div>
                  <div style={{fontWeight:600,fontSize:16}}>উপরে একটি দল বেছে নিন</div>
                  <div style={{fontSize:13,marginTop:6}}>{Object.keys(SQUADS).length}টি দলের পূর্ণ স্কোয়াড দেখুন</div>
                </div>
              )}

              {squadTeam && SQUADS[squadTeam] && (()=>{
                const sq = SQUADS[squadTeam];
                const grp = getTeamGroup(squadTeam);
                const grpFixtures = getTeamFixtures(squadTeam);
                const byPos = {GK:sq.players.filter(p=>p.pos==="GK"),DEF:sq.players.filter(p=>p.pos==="DEF"),MID:sq.players.filter(p=>p.pos==="MID"),FWD:sq.players.filter(p=>p.pos==="FWD")};
                return (
                  <div className="fi">
                    <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22}}>
                      <span style={{fontSize:56}}>{FLAGS[squadTeam]}</span>
                      <div>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:36,color:"#10b981",letterSpacing:2,lineHeight:1}}>{squadTeam}</div>
                        <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>কোচ: <span style={{color:"#d1d5db",fontWeight:600}}>{sq.coach}</span> &nbsp;·&nbsp; Group {grp}</div>
                        <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
                          {Object.entries(byPos).map(([pos,pl])=>pl.length>0&&(
                            <span key={pos} className="pill" style={{background:posColors[pos]+"22",color:posColors[pos]}}>{pos} {pl.length}</span>
                          ))}
                          <span className="pill" style={{background:"rgba(255,255,255,.05)",color:"#9ca3af"}}>মোট {sq.players.length}জন</span>
                          {/* Favorite toggle */}
                          <button onClick={()=>toggleFav(squadTeam)} style={{marginLeft:4,padding:"4px 10px",borderRadius:7,border:`1px solid ${favTeam===squadTeam?"rgba(251,191,36,.5)":"rgba(255,255,255,.1)"}`,background:favTeam===squadTeam?"rgba(251,191,36,.12)":"transparent",color:favTeam===squadTeam?"#fbbf24":"#6b7280",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                            {favTeam===squadTeam ? "⭐ প্রিয় দল" : "☆ Favorite করো"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Players by position */}
                    {["GK","DEF","MID","FWD"].map(pos=>byPos[pos].length>0&&(
                      <div key={pos} style={{marginBottom:20}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:posColors[pos]}}/>
                          <div style={{fontSize:11,fontWeight:800,color:posColors[pos],letterSpacing:2,textTransform:"uppercase"}}>
                            {pos==="GK"?"গোলকিপার":pos==="DEF"?"ডিফেন্ডার":pos==="MID"?"মিডফিল্ডার":"ফরওয়ার্ড"} ({byPos[pos].length}জন)
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:8}}>
                          {byPos[pos].map((p,i)=>(
                            <div key={i} className="scard" style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}>
                              <div style={{width:36,height:36,borderRadius:"50%",background:`${posColors[pos]}18`,border:`2px solid ${posColors[pos]}40`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:16,color:posColors[pos],flexShrink:0}}>{p.num}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:700,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                                <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{p.club}</div>
                              </div>
                              <span className="pill" style={{background:posColors[pos]+"18",color:posColors[pos],flexShrink:0}}>{pos}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Team fixtures */}
                    <div style={{marginTop:8,padding:"16px 18px",background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.12)",borderRadius:12}}>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:2,color:"#10b981",marginBottom:12}}>GROUP {grp} ম্যাচসূচি</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {grpFixtures.map((fix,i)=>{
                          const bd=bdTime(fix.etTime,"");
                          const isHome=fix.home===squadTeam;
                          return (
                            <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                              <span style={{color:"#6b7280",minWidth:55,fontSize:12}}>{fix.dateStr}</span>
                              <span style={{fontWeight:isHome?800:400,color:isHome?"#10b981":"#9ca3af"}}>{fix.home}</span>
                              <span style={{color:"#4b5563",fontSize:11}}>vs</span>
                              <span style={{fontWeight:!isHome?800:400,color:!isHome?"#10b981":"#9ca3af"}}>{fix.away}</span>
                              <span style={{marginLeft:"auto",fontFamily:"'Bebas Neue',cursive",fontSize:15,color:"#10b981"}}>{bd}</span>
                              <span style={{color:"#4b5563",fontSize:10,minWidth:130,textAlign:"right"}}>📍 {fix.venue.split(",")[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
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
