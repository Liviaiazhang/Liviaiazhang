const fs = require("fs");
const https = require("https");

// ================= CONFIG =================
const TIMEZONE   = "America/New_York";
const BASE_PRICE = 1400;              // synthetic "share price" anchor
const ALWAYS_UP  = true;             // showcase mode: always a small green gain
const SIGNALS    = ["STRONG BUY", "OPEN TO OFFERS", "HIRE SIGNAL", "UNDERVALUED"];

// --- weather ---
const WEATHER_CITY = "Boston";        // your city
const WEATHER_UNITS = "imperial";     // "imperial" = °F, "metric" = °C
const OWM_KEY = process.env.OWM_KEY || "";   // set as a GitHub Actions secret
const WEATHER_FALLBACK = { temp: "—", icon: "\u2601\ufe0f", sky: "offline" }; // used if API fails

const TAPE_ITEMS = [
  "MS INFORMATION SYSTEMS @ NORTHEASTERN",
  "SOFTWARE / DATA ENGINEER",
  "NOW BUILDING: FINNSPHERE \u2014 AI FINANCIAL RESEARCH ASSISTANT",
  "OPEN TO 2026 NEW GRAD ROLES",
  "PYTHON \u00b7 SQL \u00b7 REACT \u00b7 AWS \u00b7 DOCKER",
  "LET'S CONNECT \u2197 linkedin.com/in/di-olivia-zhang-b0b382333",
];
// ==========================================

function mulberry32(seed){return function(){seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function ctx(){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:TIMEZONE,month:"short",day:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t)?.value;
  const now=new Date();const start=new Date(now.getFullYear(),0,0);
  return{date:`${g("month")} ${g("day")} ${g("year")}  ${g("hour")}:${g("minute")}`,year:now.getFullYear(),month:now.getMonth()+1,doy:Math.floor((now-start)/86400000)};
}

// map OpenWeatherMap "main" condition -> emoji + short label
function skyToIcon(main){
  const m=(main||"").toLowerCase();
  if(m.includes("clear"))   return{icon:"\u2600\ufe0f",   sky:"clear skies"};
  if(m.includes("cloud"))   return{icon:"\u26c5",          sky:"partly cloudy"};
  if(m.includes("rain")||m.includes("drizzle")) return{icon:"\ud83c\udf27\ufe0f",sky:"rain"};
  if(m.includes("thunder")) return{icon:"\u26c8\ufe0f",   sky:"storms"};
  if(m.includes("snow"))    return{icon:"\u2744\ufe0f",   sky:"snow"};
  if(m.includes("mist")||m.includes("fog")||m.includes("haze")) return{icon:"\ud83c\udf2b\ufe0f",sky:"foggy"};
  return{icon:"\ud83c\udf24\ufe0f",sky:main?main.toLowerCase():"clear"};
}

function fetchWeather(){
  return new Promise(resolve=>{
    if(!OWM_KEY){ return resolve(WEATHER_FALLBACK); }
    const unit=WEATHER_UNITS==="metric"?"\u00b0C":"\u00b0F";
    const url=`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(WEATHER_CITY)}&units=${WEATHER_UNITS}&appid=${OWM_KEY}`;
    const req=https.get(url,res=>{
      let d="";res.on("data",c=>d+=c);
      res.on("end",()=>{
        try{
          const j=JSON.parse(d);
          if(!j.main||!j.weather){ return resolve(WEATHER_FALLBACK); }
          const{icon,sky}=skyToIcon(j.weather[0].main);
          resolve({temp:`${Math.round(j.main.temp)}${unit}`,icon,sky});
        }catch(e){ resolve(WEATHER_FALLBACK); }
      });
    });
    req.on("error",()=>resolve(WEATHER_FALLBACK));
    req.setTimeout(8000,()=>{req.destroy();resolve(WEATHER_FALLBACK);});
  });
}

function buildSpark(){
  const c=ctx();const rng=mulberry32(c.year*100+c.month);
  const N=12,x0=16,x1=504,top=258,bot=298,base=300;let v=0.42;const pts=[];
  for(let i=0;i<N;i++){const step=i<N-1?(rng()-0.5)*0.22+0.02:(rng()*0.10+0.03);v=clamp(v+step,0.08,0.94);pts.push([Math.round(x0+i*(x1-x0)/(N-1)),Math.round(bot-v*(bot-top))]);}
  return{line:"M"+pts.map(p=>`${p[0]} ${p[1]}`).join(" L "),area:`M${x0} ${base} `+pts.map(p=>`L ${p[0]} ${p[1]}`).join(" ")+` L ${x1} ${base} Z`};
}

(async function main(){
  const c=ctx();
  const rngDay=mulberry32(c.year*1000+c.doy);
  const pct=ALWAYS_UP?rngDay()*2.5+0.3:rngDay()*8-2.5;   // showcase: +0.3%..+2.8%
  const up=pct>=0;const dirColor=up?"#3fb950":"#f85149";
  const trend=`${up?"\u25b2":"\u25bc"} ${up?"+":""}${pct.toFixed(1)}%`;
  const price=(BASE_PRICE*(1+pct/100)).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const spark=buildSpark();
  const signal=SIGNALS[c.doy%SIGNALS.length];
  const cups=3+(c.doy%6);const coffee="\u2593".repeat(cups)+`  ${cups} cups`;
  const w=await fetchWeather();

  const tape="    "+TAPE_ITEMS.join("      \u2022      ")+"      \u2022  ";
  const tapeW=Math.round(tape.length*8.0);
  const tapeDur=Math.max(16,Math.round(tapeW/48));

  let svg=fs.readFileSync("template.svg","utf8")
    .replaceAll("{{DIR_COLOR}}",dirColor)
    .replace("{{DATE}}",esc(c.date))
    .replace("{{PRICE}}",esc(price))
    .replace("{{TREND}}",esc(trend))
    .replace("{{SIGNAL}}",esc(signal))
    .replace("{{CITY}}",esc(WEATHER_CITY))
    .replace("{{TEMP}}",esc(w.temp))
    .replace("{{ICON}}",w.icon)
    .replace("{{SKY}}",esc(w.sky))
    .replace("{{COFFEE}}",esc(coffee))
    .replace("{{SPARK_AREA}}",spark.area)
    .replace("{{SPARK_LINE}}",spark.line)
    .replace("{{TAPE_W}}",tapeW)
    .replace("{{TAPE_X2}}",76+tapeW)
    .replace("{{TAPE_DUR}}",tapeDur)
    .replaceAll("{{TAPE}}",esc(tape));

  fs.writeFileSync("ticker.svg",svg);
  console.log("ticker.svg:",{trend,price,weather:w,signal});
})();
