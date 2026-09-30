// ==UserScript==
// @name         Enabled+ Property Assistant TEST
// @namespace    sixx.enabledplus.tools.test
// @version      0.7.29
// @description  Local test: duplicate candidates, formatted copy, property comparison and Central GTA map check. No lead edits.
// @author       Montana (Sixx)
// @match        https://www.enabledplus.com/Lead*
// @match        https://www.enabledplus.com/WebForms/AppointmentCalendar.aspx*
// @match        https://www.redfin.ca/*/home/*
// @match        https://www.redfin.com/*/home/*
// @match        https://www.zillow.com/homedetails/*
// @match        https://www.realtor.com/realestateandhomes-detail/*
// @match        https://www.google.com/maps/*
// @match        https://www.google.com/search*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      nominatim.openstreetmap.org
// @connect      router.project-osrm.org
// @connect      www.google.com
// @connect      www.zillow.com
// @connect      www.redfin.com
// @connect      www.redfin.ca
// @connect      www.realtor.com
// ==/UserScript==

// Made by Montana. Provided for authorized internal review and testing.
// Do not reproduce, redistribute, republish, or remove this attribution without
// Montana's prior written consent. Third-party material retains its own ownership.
// Unofficial tool: not endorsed by Enabled+ or Renewal by Andersen.
(() => {
  'use strict';
  const ID='sixx-property-assistant-test', KEY='sixx-property-window-v1';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LISTINGS_KEY='sixx-property-listings-test-v1', LISTING_TTL=15*60*1000;
  const ROUTES_KEY='sixx-property-routes-test-v1', REQUESTS_KEY='sixx-property-route-requests-test-v1';
  const PROPERTY_TABS_KEY='sixx-property-auto-tabs-v1', PROPERTY_JOBS_KEY='sixx-property-tab-jobs-v1';
  const PROPERTY_SOURCE_KEY='sixx-property-selected-source-v1';
  const THEME_KEY='sixx-property-theme-v1';
  const THEMES={
    destiny:{label:'Destiny Neon',bg:'#100d20',surface:'#1c162d',field:'#120f21',text:'#f7f1ff',muted:'#dccfe5',accent:'#77e6ee',pink:'#f798d5',border:'#705273',button:'#34203f',hover:'#4c2957',heading:'#ffe2ab',header:'#241238',warning:'#ffd390',danger:'#ff8caa',dangerBg:'#321426',success:'#77ead0',successBg:'#102c2b'},
    pop:{label:'Girly Pop',bg:'#fff0f7',surface:'#fffafd',field:'#ffffff',text:'#45152f',muted:'#714360',accent:'#852d75',pink:'#9b255e',border:'#b16b97',button:'#f5d4e8',hover:'#edbfda',heading:'#701b50',header:'#f8d8eb',warning:'#784308',danger:'#a4133c',dangerBg:'#ffe1e9',success:'#17613d',successBg:'#e0f5e8'},
    green:{label:'Green',bg:'#10201c',surface:'#192e27',field:'#0d1a16',text:'#edf8ef',muted:'#c1d8c8',accent:'#8de1ac',pink:'#b8e798',border:'#61806d',button:'#284b39',hover:'#356449',heading:'#b9f3cb',header:'#163c2b',warning:'#f6d38a',danger:'#ff9aab',dangerBg:'#39202a',success:'#91eeb0',successBg:'#143828'},
    gothic:{label:'Gothic',bg:'#100f14',surface:'#1e1a24',field:'#121015',text:'#f5edf4',muted:'#d1bed0',accent:'#e6b8e4',pink:'#ffa1bd',border:'#826b82',button:'#3c2235',hover:'#593048',heading:'#ffd5df',header:'#2e1828',warning:'#eed093',danger:'#ff9eb0',dangerBg:'#3f1623',success:'#a0dfc0',successBg:'#17372a'}
  };
  // Made by Montana. Holiday palettes are artistic choices, not official religious colors.
  // Manual selection only: no religion inference, calendar switching, or extra permissions.
  function darkPalette(label,group,bg,surface,accent,pink,heading){
    return {label,group,bg,surface,field:bg,text:'#fff5fb',muted:'#ddd3df',accent,pink,border:'#827589',button:surface,hover:'#3b3044',heading,header:bg,warning:'#ffdc96',danger:'#ffb0bd',dangerBg:'#351821',success:'#a3efbd',successBg:'#123526'};
  }
  const extraPalettes=[
    ['purpleBlue','Purple & Blue','Color palettes','#141126','#211a35','#a8d9ff','#d8b7ff','#e2d0ff'],
    ['hotPink','Hot Pink','Color palettes','#230c1b','#35172e','#ffb3e0','#ffa1d6','#ffd3ec'],
    ['gold','Golden Hour','Color palettes','#211909','#302616','#ffe09c','#ffcf83','#fff0be'],
    ['powderBlue','Powder Blue','Color palettes','#101e2a','#1d2c39','#b5e1ff','#c7d5ff','#def2ff'],
    ['purpleSoftPink','Purple & Soft Pink','Color palettes','#201327','#301f39','#d9baff','#ffcade','#f5dcff'],
    ['burgundy','Burgundy','Color palettes','#260f19','#371d29','#ffc5d3','#eeb6c9','#ffe0e7'],
    ['burgundyForest','Burgundy & Forest','Color palettes','#111f1a','#24352d','#b5e9c4','#ffc0d3','#ffdae3'],
    ['dustyPink','Dusty Pink','Color palettes','#251b22','#352831','#eac2d0','#f3bccb','#ffe1e8'],
    ['brown','Cocoa Brown','Color palettes','#211813','#33271e','#ecd2ae','#e9bfae','#ffe8c9'],
    ['royalPurple','Royal Purple','Color palettes','#1b0e2c','#2a1940','#d4baff','#e6b4f5','#f0dcff'],
    ['newYear','New Year · Midnight Gold','Seasonal & secular','#101726','#202b39','#c0ddff','#ffe2a1','#fff0c8'],
    ['valentine','Valentine’s Day','Seasonal & secular','#250d1c','#381a2d','#ffc1e1','#ffadc8','#ffe0ec'],
    ['stPatrick','St. Patrick’s Day','Seasonal & secular','#0c2017','#1b3326','#b9f1bd','#ffe19c','#e6ffd7'],
    ['earthDay','Earth Day','Seasonal & secular','#101e20','#203237','#b0e8d1','#b9ddff','#e4f6cd'],
    ['pride','Pride · Rainbow Accents','Seasonal & secular','#171225','#281f36','#a9e9ff','#ffb6df','#ffe5a4'],
    ['halloween','Halloween','Seasonal & secular','#1b1026','#2c1e38','#dabdff','#ffd0a0','#ffe2b8'],
    ['thanksgiving','Thanksgiving · Harvest','Seasonal & secular','#21150f','#35261c','#ffdda6','#ffc0a5','#fff0c9'],
    ['solstice','Winter Solstice','Seasonal & secular','#0c1d2a','#1c3040','#bce9ff','#c9c5ff','#e3f5ff'],
    ['christmas','Christmas · Evergreen','Christian holidays','#102019','#22362b','#bff0c7','#ffb8bf','#ffe5a8'],
    ['advent','Advent · Violet & Rose','Christian holidays','#1c102b','#2c1d3e','#d9bfff','#ffc8e1','#efe0ff'],
    ['epiphany','Epiphany · Starlight','Christian holidays','#12152c','#222740','#c7d2ff','#ffe1a2','#fff0c8'],
    ['lent','Lent · Quiet Violet','Christian holidays','#1c1527','#2b2437','#d9c6ef','#d8c4dd','#eee1fb'],
    ['goodFriday','Good Friday · Quiet Burgundy','Christian holidays','#1d131a','#30222c','#e9c6d8','#f0bccd','#f7dce6'],
    ['easter','Easter · Lilac & Blossom','Christian holidays','#1c172b','#2b2640','#dbcaff','#ffd0e3','#fff1c5'],
    ['pentecost','Pentecost · Crimson Gold','Christian holidays','#250f16','#371e26','#ffc4c4','#ffdfaa','#fff0cf'],
    ['hanukkah','Hanukkah · Blue & Silver','Jewish holidays','#0e182a','#1d2c42','#bddfff','#d7e5f5','#eef6ff'],
    ['passover','Passover · Spring','Jewish holidays','#14201c','#25342c','#cae9c4','#ffe0ae','#f1f4d0'],
    ['roshHashanah','Rosh Hashanah · Honey','Jewish holidays','#22180f','#34271b','#ffe3a8','#ffc7bd','#fff1c9'],
    ['yomKippur','Yom Kippur · Quiet Silver','Jewish holidays','#171c25','#282f3b','#d7e2f2','#d3d5eb','#f1f3f8'],
    ['sukkot','Sukkot · Orchard','Jewish holidays','#162016','#293626','#d0efb7','#ffdeb0','#f1f3c5'],
    ['purim','Purim · Jewel Colors','Jewish holidays','#21102b','#321e40','#c7d0ff','#ffbfe4','#ffe4ae'],
    ['shavuot','Shavuot · Flowers','Jewish holidays','#172321','#283835','#c4eacf','#e4d0ff','#f2f5e0'],
    ['simchatTorah','Simchat Torah · Celebration','Jewish holidays','#111c2c','#223048','#c1e5ff','#e6c3ff','#ffe9b7'],
    ['ramadan','Ramadan · Emerald Gold','Islamic holidays & observances','#0e211f','#1d3631','#b7eed8','#ffe1a0','#fff0c4'],
    ['eidFitr','Eid al-Fitr · Rose Gold','Islamic holidays & observances','#231425','#35243a','#f2c8e7','#ffd4b3','#fff0cf'],
    ['eidAdha','Eid al-Adha · Teal Gold','Islamic holidays & observances','#0c2028','#1c3540','#aee8eb','#ffe0aa','#fff0ce'],
    ['islamicNewYear','Islamic New Year · Midnight','Islamic holidays & observances','#111a2b','#232e42','#c4dbff','#dfcaff','#ffe8b9'],
    ['ashura','Ashura · Quiet Teal','Islamic holidays & observances','#132020','#253333','#c7e2de','#d6dce9','#eaf1ed'],
    ['mawlid','Mawlid · Green & Cream','Islamic holidays & observances','#152219','#28392c','#c5ecc9','#f0debd','#fff3d8'],
    ['diwali','Diwali · Festival Lights','More celebrations','#23132a','#35233f','#e9c4ff','#ffd4a3','#fff0bc'],
    ['holi','Holi · Bright Blossoms','More celebrations','#1d142c','#30243e','#b9e8ff','#ffbfe4','#ffe7ae'],
    ['lunarNewYear','Lunar New Year · Red Gold','More celebrations','#260f15','#3a2026','#ffc6c6','#ffdfa0','#fff0c0'],
    ['nowruz','Nowruz · Spring Garden','More celebrations','#12221d','#25382e','#bceaca','#edc9ff','#fff0bd'],
    ['vesak','Vesak · Lotus Glow','More celebrations','#21172b','#33263f','#ddd0ff','#ffd0df','#ffebaf'],
    ['vaisakhi','Vaisakhi · Golden Spring','More celebrations','#201b10','#332c1e','#ffe5a6','#c7e6b5','#fff1c7'],
    ['kwanzaa','Kwanzaa · Red & Green','More celebrations','#151b16','#273429','#c5ecc6','#ffbfc2','#ffe7bc']
  ];
  for(const [key,...palette] of extraPalettes)THEMES[key]=darkPalette(...palette);
  // Made by Montana. Plain palettes use distinct full-surface colors, not one dark base.
  function daylightPalette(key,bg,surface,field,text,muted,accent,pink,button,hover){
    Object.assign(THEMES[key],{bg,surface,field,text,muted,accent,pink,button,hover,header:bg,heading:accent,border:muted,warning:'#664000',danger:'#8b1232',dangerBg:'#ffe4ea',success:'#155338',successBg:'#e1f3e3'});
  }
  daylightPalette('gold','#fff0a3','#fff8d4','#fffdf0','#3d2905','#66501b','#684400','#704015','#f2d16a','#e6c05c');
  daylightPalette('powderBlue','#ccecff','#eaf7ff','#f6fcff','#102d4c','#37556a','#004875','#343580','#acd9f2','#96cae9');
  daylightPalette('purpleSoftPink','#e8dafa','#f8eaf4','#fff7ff','#35194e','#614563','#4c246e','#762348','#d6b8ec','#c9a5e1');
  daylightPalette('dustyPink','#e8c2b9','#f5e0d5','#fff4eb','#402923','#655046','#633b31','#583c53','#d8b1a5','#cca293');
  Object.assign(THEMES.purpleBlue,{bg:'#072e5b',surface:'#0d3a70',field:'#052345',header:'#072e5b',button:'#15437a',hover:'#23528c',accent:'#90edff',pink:'#e5beff',heading:'#bcd8ff',border:'#76a9d3'});
  Object.assign(THEMES.hotPink,{bg:'#650039',surface:'#780447',field:'#470029',header:'#650039',button:'#850d53',hover:'#941862',accent:'#fff3a8',pink:'#ffffff',heading:'#ffffff',border:'#ff87c8'});
  Object.assign(THEMES.burgundy,{bg:'#4d1324',surface:'#611c2e',field:'#350b19',header:'#4d1324',button:'#70273b',hover:'#813448',accent:'#f7d49b',pink:'#ffd8d9',heading:'#ffe9ba',border:'#c98b80'});
  Object.assign(THEMES.burgundyForest,{bg:'#173b28',surface:'#214c35',field:'#0b281b',header:'#173b28',button:'#522338',hover:'#653147',accent:'#ddf4bc',pink:'#ffd0df',heading:'#fff0c3',border:'#97b58a'});
  Object.assign(THEMES.brown,{bg:'#3b2413',surface:'#4d321c',field:'#29190d',header:'#3b2413',button:'#604126',hover:'#725134',accent:'#ffe3a9',pink:'#f7c5a8',heading:'#fff0d2',border:'#bc9468'});
  Object.assign(THEMES.royalPurple,{bg:'#35116b',surface:'#471a83',field:'#25084f',header:'#35116b',button:'#56258d',hover:'#67379f',accent:'#ffe197',pink:'#eacfff',heading:'#fff1bd',border:'#b38cdd'});
  // Made by Montana. Local vector artwork: no remote images, tracking, or page interaction.
  const THEME_ICONS={
    star:'<path d="m16 3 4 8 9 2-7 6 1 10-7-5-8 5 2-10-7-6 9-2z"/>',
    moon:'<path d="M24 4A13 13 0 1 0 28 25 14 14 0 0 1 24 4Z"/>',
    bat:'<path d="m2 10 8 4 3-7 3 4 3-4 3 7 8-4-3 13-6-3-5 7-5-7-6 3z"/>',
    ghost:'<path d="M6 29V13a10 10 0 0 1 20 0v16l-5-4-5 4-5-4z"/><path d="M12 12v4m8-4v4" stroke="BACKGROUND" stroke-width="3"/>',
    tree:'<path d="m16 2 8 10h-4l8 10H4l8-10H8z"/><path d="M14 22h4v7h-4z"/>',
    truck:'<path d="M2 17h16V9h8l5 8v9H2z"/><path d="M21 11h4l3 6h-7z" fill="BACKGROUND"/><circle cx="8" cy="27" r="4"/><circle cx="25" cy="27" r="4"/><path d="m9 1 7 7h-3l5 6H1l5-6H3z"/>',
    heart:'<path d="M16 28 3 15C-4 2 12-2 16 8 21-2 36 3 29 15Z"/>',
    flower:'<g><circle cx="16" cy="8" r="6"/><circle cx="24" cy="15" r="6"/><circle cx="21" cy="24" r="6"/><circle cx="10" cy="24" r="6"/><circle cx="7" cy="14" r="6"/><circle cx="16" cy="16" r="4" fill="BACKGROUND"/></g>',
    leaf:'<path d="M4 28C-2 6 14 1 29 3 31 24 17 31 4 28Z"/><path d="m5 27 19-18" stroke="BACKGROUND" stroke-width="2"/>',
    crown:'<path d="m3 9 7 6 6-12 6 12 7-6-4 18H7z"/>',
    diamond:'<path d="m8 4 16 0 7 9-15 17L1 13z"/><path d="M1 13h30M8 4l8 26L24 4" fill="none" stroke="BACKGROUND"/>',
    wave:'<path d="M0 10Q8 1 16 10T32 10M0 20Q8 11 16 20T32 20M0 29Q8 20 16 29T32 29" fill="none" stroke="currentColor" stroke-width="3"/>',
    bow:'<path d="M15 15C-3-4-4 29 15 18v11l4-9 7 7-7-11C39-4 33 29 18 17z"/>',
    mug:'<path d="M3 11h20v15H3zM23 13h6v8h-6"/><path d="M8 8Q3 4 8 1m8 7q-5-4 0-7" fill="none" stroke="currentColor" stroke-width="2"/>',
    skyline:'<path d="M1 30V15h6v15h3V6h7v24h3V12h6v18h4V1h2v29z"/>',
    firework:'<path d="M16 1v8m0 14v8M1 16h8m14 0h8M5 5l6 6m10 10 6 6M5 27l6-6M21 11l6-6" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="3"/>',
    lantern:'<path d="M10 4h12v3H10zm-4 6h20v15H6zm4 18h12v3H10z"/><path d="M12 10v15m8-15v15" stroke="BACKGROUND" stroke-width="2"/>',
    candle:'<path d="M12 13h8v17h-8zM16 1q-10 11 0 10 9 0 0-10"/>',
    egg:'<path d="M16 2C4 3-3 29 16 30 35 29 28 3 16 2Z"/><path d="m5 19 5-3 6 3 6-3 5 3" fill="none" stroke="BACKGROUND" stroke-width="2"/>',
    cross:'<path d="M12 2h8v8h10v7H20v14h-8V17H2v-7h10z"/>',
    snow:'<path d="M16 1v30M3 8l26 16M3 24 29 8M11 4l5 4 5-4M11 28l5-4 5 4" stroke="currentColor" stroke-width="2"/>',
    apple:'<path d="M16 10C-3-4-3 29 12 30h8C35 29 36-4 16 10Zm0-3q0-7 9-6-1 7-9 6"/>',
    wheat:'<path d="M16 31V3M16 11Q2 13 5 2q11 2 11 9M16 21Q2 23 5 12q11 2 11 9M16 15Q30 17 27 6q-11 2-11 9M16 26q14 2 11-9-11 2-11 9" fill="none" stroke="currentColor" stroke-width="2"/>',
    book:'<path d="M2 4q8-3 14 2 6-5 14-2v24q-8-3-14 1-6-4-14-1z"/><path d="M16 6v23" stroke="BACKGROUND" stroke-width="2"/>',
    lotus:'<path d="M16 29Q-2 26 2 11q9 1 14 18Q8 11 16 1q8 10 0 28 18-3 14-18-9 1-14 18Z"/>',
    lamp:'<path d="M2 19h28q-4 14-14 11Q5 32 2 19Zm14-3Q4 12 16 1q12 11 0 15"/>',
    pumpkin:'<ellipse cx="16" cy="19" rx="14" ry="11"/><path d="M16 9V2h5M11 12v14m10-14v14" stroke="BACKGROUND" stroke-width="2"/>',
    globe:'<circle cx="16" cy="16" r="14"/><path d="M2 16h28M16 2q-14 14 0 28 14-14 0-28" fill="none" stroke="BACKGROUND" stroke-width="2"/>',
    rainbow:'<path d="M2 28V18a14 14 0 0 1 28 0v10M8 28V18a8 8 0 0 1 16 0v10M14 28V18a2 2 0 0 1 4 0v10" fill="none" stroke="currentColor" stroke-width="3"/>',
    menorah:'<path d="M16 2v27M2 8v9q0 8 14 8t14-8V8M6 8v8q0 6 10 6t10-6V8M10 8v7q0 4 6 4t6-4V8M14 8v6q0 2 2 2t2-2V8M9 29h14" fill="none" stroke="currentColor" stroke-width="2"/>',
    mask:'<path d="M2 6q14 7 28 0v12Q16 39 2 18z"/><path d="m7 13 5 2m8 0 5-2M10 23q6 5 12-1" fill="none" stroke="BACKGROUND" stroke-width="3"/>'
  };
  const THEME_ART={destiny:['skyline','star','wave'],pop:['bow','heart','flower'],green:['leaf','tree','leaf'],gothic:['bat','moon','crown'],purpleBlue:['moon','wave','star'],hotPink:['heart','diamond','bow'],gold:['diamond','star','crown'],powderBlue:['wave','snow','wave'],purpleSoftPink:['flower','moon','heart'],burgundy:['flower','diamond','flower'],burgundyForest:['tree','flower','leaf'],dustyPink:['bow','flower','bow'],brown:['mug','leaf','mug'],royalPurple:['crown','diamond','crown'],newYear:['firework','star','firework'],valentine:['heart','bow','heart'],stPatrick:['leaf','crown','leaf'],earthDay:['globe','leaf','wave'],pride:['rainbow','heart','star'],halloween:['bat','ghost','pumpkin'],thanksgiving:['pumpkin','wheat','leaf'],solstice:['snow','moon','tree'],christmas:['tree','truck','snow'],advent:['candle','flower','candle'],epiphany:['star','crown','star'],lent:['cross','leaf','candle'],goodFriday:['cross','candle','cross'],easter:['egg','flower','cross'],pentecost:['lamp','cross','lamp'],hanukkah:['menorah','star','menorah'],passover:['book','wheat','book'],roshHashanah:['apple','flower','apple'],yomKippur:['book','candle','book'],sukkot:['leaf','apple','tree'],purim:['mask','star','mask'],shavuot:['flower','book','wheat'],simchatTorah:['book','star','flower'],ramadan:['lantern','moon','star'],eidFitr:['moon','flower','lantern'],eidAdha:['lantern','star','leaf'],islamicNewYear:['moon','star','wave'],ashura:['wave','book','wave'],mawlid:['flower','lantern','leaf'],diwali:['lamp','flower','lamp'],holi:['flower','firework','flower'],lunarNewYear:['lantern','firework','lantern'],nowruz:['flower','apple','leaf'],vesak:['lotus','lamp','lotus'],vaisakhi:['wheat','flower','wheat'],kwanzaa:['candle','wheat','candle']};
  function themeArtwork(key){
    const t=THEMES[key],icons=THEME_ART[key]||THEME_ART.destiny;
    const shapes=icons.map((name,i)=>'<g transform="translate('+ (8+i*52)+' 3) scale(.85)" fill="'+[t.accent,t.pink,t.heading][i]+'" color="'+[t.accent,t.pink,t.heading][i]+'">'+THEME_ICONS[name].replaceAll('BACKGROUND',t.header)+'</g>').join('');
    return 'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="34" viewBox="0 0 160 34">'+shapes+'</svg>')+'")';
  }
  function applyTheme(value){
    const key=Object.hasOwn(THEMES,value)?value:'destiny',theme=THEMES[key];if(!panel)return;
    panel.dataset.theme=key;
    panel.style.setProperty('--spa-art',themeArtwork(key));
    const icon=THEME_ICONS[THEME_ART[key][0]].replaceAll('BACKGROUND',theme.accent);
    panel.style.setProperty('--spa-bubble-art','url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="'+theme.bg+'" color="'+theme.bg+'">'+icon+'</g></svg>')+'")');
    for(const [name,color] of Object.entries(theme))if(/^#[0-9a-f]{6}$/i.test(color))panel.style.setProperty('--spa-'+name,color);
    const select=panel.querySelector('#spa-theme');if(select)select.value=key;
  }
  const startupIssues=new Set();
  function savedValue(key,fallback){try{return typeof GM_getValue==='function'?GM_getValue(key,fallback):fallback;}catch{startupIssues.add('Saved results unavailable');return fallback;}}
  function saveValue(key,value){try{if(typeof GM_setValue!=='function')throw Error();GM_setValue(key,value);return true;}catch{startupIssues.add('Could not save results');return false;}}
  function watchValue(key,callback){try{if(typeof GM_addValueChangeListener==='function')GM_addValueChangeListener(key,callback);}catch{startupIssues.add('Live tab updates unavailable; results checked periodically');}}
  function propertyJobs(){const storedPropertyRequests=savedValue(PROPERTY_JOBS_KEY,[]);return Array.isArray(storedPropertyRequests)?storedPropertyRequests.filter(j=>j&&typeof j.token==='string'&&Number.isFinite(j.started)&&Date.now()-j.started<LISTING_TTL&&Date.now()>=j.started):[];}
  function updatePropertyJob(token,status){const requestsToUpdate=propertyJobs();const job=requestsToUpdate.find(j=>j.token===token);if(job){job.status=status;saveValue(PROPERTY_JOBS_KEY,requestsToUpdate);}}
  function propertyJobAllowed(job){const selected=savedValue(PROPERTY_SOURCE_KEY,'');return !!job&&(job.manual||(savedValue(PROPERTY_TABS_KEY,false)===true&&(!selected||{zillow:'Zillow',redfin:'Redfin',realtor:'Realtor.com'}[selected]===job.source)));}
  function openPropertyTabs(manual=false){
    if(!lead||!panel||(!manual&&savedValue(PROPERTY_TABS_KEY,false)!==true))return;
    const address=clean(panel.querySelector('#spa-address')?.value),identity=listingIdentity(address);
    const status=panel.querySelector('#spa-tabs-status');
    const tell=text=>{if(status)status.textContent=text;};
    if(!identity||lead.uncertain){tell('Check the physical address first.');return;}
    if(typeof GM_openInTab!=='function'){tell('Tab permission unavailable. Save the updated script and approve Tampermonkey’s tab permission.');return;}
    const key=panel.querySelector('#spa-source')?.value,source={zillow:'Zillow',redfin:'Redfin',realtor:'Realtor.com'}[key];
    if(!source){tell('Select Zillow, Redfin or Realtor.com for automatic checking.');return;}
    const results=sourceResults(savedValue(LISTINGS_KEY,[]),address,Date.now());
    if(!manual&&results.some(s=>s.source===source&&s.result)){tell(source+' already verified.');return;}
    const recentPropertyRequests=propertyJobs();if(!manual&&recentPropertyRequests.some(j=>j.identity===identity&&j.source===source&&j.status!=='Tab could not open')){tell(source+' already opened recently. Use Open selected check to reopen.');return;}
    // Limit unattended tab creation across leads, not just on this page.
    if(!manual&&recentPropertyRequests.filter(j=>!j.manual).length>=3){tell('Automatic tab limit reached. Use Open selected check if needed.');return;}
    const token=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const job={token,identity,address,source,started:Date.now(),manual,status:'Opening search'};
    if(!saveValue(PROPERTY_JOBS_KEY,[...recentPropertyRequests,job].slice(-30))){tell('Could not save tab request. No tab opened.');return;}
    try{GM_openInTab(searchUrl(key,address)+'#sixx-property-job='+encodeURIComponent(token),{active:false,insert:true,setParent:true});tell(source+' check opened. Matching results return here.');}
    catch{updatePropertyJob(token,'Tab could not open');tell(source+' tab could not open.');}
  }
  // Pure functions are also exercised by the local test suite.
  function homeownerParts(full,first='',last=''){
    if(clean(first)&&clean(last))return {first:titleCase(first),last:titleCase(last),inferred:false};
    const parts=clean(full).split(/\s+/).filter(Boolean);
    return {first:titleCase(parts.length>1?parts.slice(0,-1).join(' '):parts[0]||''),last:titleCase(parts.length>1?parts.at(-1):''),inferred:true};
  }
  function titleCase(value, address=false) {
    return clean(value).split(' ').map(word=>{
      if (address && /^(?:N|S|E|W|NE|NW|SE|SW|USA|PO|AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|ON|BC|QC|AB|MB|NB|NL|NS|NT|NU|PE|SK|YT)$/i.test(word.replace(/,$/,''))) return word.toUpperCase();
      if (/^(?:II|III|IV)$/i.test(word)) return word.toUpperCase();
      if (/^[A-Za-z]\d[A-Za-z]$|^\d[A-Za-z]\d$|^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/i.test(word)) return word.toUpperCase();
      // Preserve intentional mixed capitalization, e.g. McDonald / deVries.
      if (/[a-z]/.test(word) && /[A-Z]/.test(word) && !/^[A-Z][a-z]+[,\.]?$/.test(word)) return word;
      return word.toLowerCase().replace(/(^|[-'’])\p{L}/gu,s=>s.toUpperCase());
    }).join(' ');
  }
  function postal(value) { const s=clean(value).toUpperCase(); return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(s)?s.replace(/\s/g,''):s.replace(/-\d{4}$/,''); }
  function cleanLeadName(value){return clean(value).replace(/\s+[+*]+\s*$/,'').trim();}
  function distanceFallbackQueries(address){
    const code=String(address).match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i)?.[0];
    const tail=String(address).split(',').slice(1).join(',');
    const city=clean(tail.split(/\b(?:ON|Ontario)\b/i)[0]).replace(/[,\s]+$/,'');
    const result=[];
    if(code)result.push({precision:'postal',code:postal(code),query:code+', Canada'});
    if(city&&/\b(?:ON|Ontario)\b/i.test(tail))result.push({precision:'city',city:city.toLowerCase(),query:city+', Ontario, Canada'});
    return result;
  }
  function areaDistanceCandidate(places,fallback){
    if(!Array.isArray(places))return null;
    const matches=places.filter(p=>{
      const a=p?.address;if(a?.country_code!=='ca'||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))return false;
      if(fallback.precision==='postal')return postal(a.postcode||'')===fallback.code;
      return (/^(?:Ontario|ON)$/i.test(a.state||'')||a['ISO3166-2-lvl4']==='CA-ON')&&['city','town','village','municipality','suburb','hamlet','neighbourhood','quarter'].some(k=>clean(a[k]).toLowerCase()===fallback.city)&&/^(?:city|town|village|municipality|administrative|suburb|hamlet|neighbourhood|quarter)$/.test(p.addresstype||'');
    });
    return matches.length===1?{place:matches[0],precision:fallback.precision}:null;
  }
  function geocodeMatches(place,address){
    const a=place?.address;if(!a?.house_number||!a.road||!a.postcode)return false;
    const geocoded=clean(a.house_number)+' '+clean(a.road)+', '+clean(a.postcode);
    return !!listingIdentity(address)&&listingIdentity(geocoded)===listingIdentity(address);
  }
  function distanceCandidate(places,address){
    if(!Array.isArray(places))return null;
    const exact=places.find(p=>geocodeMatches(p,address));
    if(exact)return {place:exact,precision:'address'};
    const parts=String(address).split(','),street=clean(parts[0]);
    const house=street.match(/^(\d+[A-Z]?)\s+(.+)$/i);
    if(!house||hasExplicitUnit(street))return null;
    const city=clean(parts[1]).replace(/\s+(?:ON|Ontario)\b.*$/i,'').toLowerCase();
    if(!city)return null;
    const candidates=places.filter(p=>{
      const a=p?.address;
      if(!a||a.country_code!=='ca'||!a.road||normAddress(a.road)!==normAddress(house[2]))return false;
      // A different house number is not an approximation of this house.
      if(a.house_number&&clean(a.house_number).toLowerCase()!==house[1].toLowerCase())return false;
      if(![a.city,a.town,a.village,a.municipality].some(v=>clean(v).toLowerCase()===city))return false;
      return /^(?:Ontario|ON)$/i.test(clean(a.state))||a['ISO3166-2-lvl4']==='CA-ON';
    });
    // Ambiguous map locations must not be arbitrarily selected.
    if(candidates.length!==1)return null;
    return {place:candidates[0],precision:'street'};
  }
  function phone(value) { if (/[x*•]/i.test(value)) return ''; const s=String(value||'').replace(/\D/g,''); return s.length===11&&s[0]==='1'?s.slice(1):s.length===10?s:''; }
  function normAddress(value) {
    const words={st:'street',rd:'road',ave:'avenue',dr:'drive',blvd:'boulevard',ln:'lane',ct:'court',cir:'circle',cres:'crescent',ter:'terrace',pkwy:'parkway',pl:'place',hwy:'highway',apt:'unit',ste:'suite',n:'north',s:'south',e:'east',w:'west'};
    return clean(value).toLowerCase().replace(/#/g,' unit ').replace(/[.,]/g,'').split(/\s+/).map(x=>words[x]||x).join(' ');
  }
  function compareCandidate(row,lead) {
    const differences=[];
    if (!lead.lastName || !row.LastName || clean(row.LastName).toLowerCase()!==lead.lastName.toLowerCase()) differences.push('last name');
    if (!lead.street || !row.Address || normAddress(row.Address)!==normAddress(lead.street)) differences.push('address / unit');
    if (!lead.zip || !row.Zip || postal(row.Zip)!==postal(lead.zip)) differences.push('ZIP / postal code');
    const theirs=[row.Phone,row.CellPhone,row.WorkPhone].map(phone).filter(Boolean);
    if (!lead.phones.length || !lead.phones.some(p=>theirs.includes(p))) differences.push('phone missing or different');
    return {id:String(row.LeadID),strong:!differences.length,differences};
  }
  function centralGta(region) { const text=clean(region).replace(/[–—_-]/g,' '); return /\b(?:central\s*gta|gta\s*:?\s*central)\b/i.test(text) && !easternGta(text); }
  function easternGta(region) {return /\b(?:(?:east|eastern)\s*(?:gta|toronto)|(?:gta|toronto)\s*:?\s*(?:east|eastern))\b/i.test(clean(region).replace(/[–—_-]/g,' '));}
  function ambiguousToronto(region) {return /\b(?:toronto|gta)\b/i.test(region)&&!centralGta(region)&&!easternGta(region);}
  function effectiveRegion(region) {return region;}
  function gtaMarket(region) {return /\b(?:toronto|gta|greater\s+toronto(?:\s+area)?)\b/i.test(clean(region).replace(/[–—_-]/g,' '))||centralGta(region);}
  function canadianLead(current){
    const code=clean(current.zip),address=clean(current.address);
    if(/^\d{5}(?:-\d{4})?$/.test(code))return false;
    if(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(code+' '+address))return true;
    if(/\b\d{5}(?:-\d{4})?\s*$/.test(address))return false;
    return gtaMarket(current.region)||/\bcanada\b/i.test(current.region||'');
  }
  function assessmentPropertyType(notes) {
    const values=[...notes.matchAll(/\bProperty\s*Type\s*:\s*([^|\n]+)/gi)].map(m=>clean(m[1]));
    const unique=[...new Set(values)];
    return unique.length===1?unique[0]:unique.length>1?'Conflicting assessment types: '+unique.join(' / '):'';
  }
  function listingIdentity(address) {
    const code=[...String(address).matchAll(/\b(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/gi)].at(-1)?.[0];
    const street=clean(String(address).split(',')[0]);
    return code&&/^\d+[A-Z-]?\s/i.test(street)?normAddress(street)+'|'+postal(code):'';
  }
  function parseRedfinFacts(address,rows,facts,url,now) {
    const propertyRows=rows.map(clean).filter(s=>/\bProperty Type\s*$/i.test(s));
    const types=[...new Set(propertyRows.map(s=>clean(s.replace(/\bProperty Type\s*$/i,''))))];
    const styles=facts.filter(s=>/^Style\s*:/i.test(s)).map(s=>clean(s.replace(/^Style\s*:/i,'')));
    const developments=facts.filter(s=>/^(?:Subdivision(?: Name)?|Development(?: Name)?|Community Name|HOA Name|Association Name)\s*:/i.test(s)).map(clean);
    const identity=listingIdentity(address);
    if(!identity||types.length!==1||!types[0])return null;
    return {identity,address:clean(address),type:types[0],style:styles.join(' / '),development:[...new Set(developments)].join('; '),url,source:'Redfin',readAt:now};
  }
  function usableListing(result,address,now) {
    if(!result||typeof result.type!=='string'||!clean(result.type)||!Number.isFinite(result.readAt)||now-result.readAt>15*60*1000||result.readAt>now+1000||!listingIdentity(address)||result.identity!==listingIdentity(address))return false;
    try {return listingSource(result.url)===result.source&&!!result.source;}catch{return false;}
  }
  function listingSource(url) {
    try {const u=new URL(url);if(u.protocol!=='https:')return '';if(['www.redfin.ca','www.redfin.com'].includes(u.hostname)&&u.pathname.includes('/home/'))return 'Redfin';if(u.hostname==='www.zillow.com'&&u.pathname.startsWith('/homedetails/'))return 'Zillow';if(u.hostname==='www.realtor.com'&&u.pathname.startsWith('/realestateandhomes-detail/'))return 'Realtor.com';}catch{}return '';
  }
  function parseVisibleListing(address,types,details,url,now) {
    const source=listingSource(url),identity=listingIdentity(address);
    const values=[...new Set(types.map(clean).filter(v=>/^(?:condo(?:minium)?|town\s*(?:house|home)|single[ -]?family(?: residential| home| residence)?|multi[ -]?family(?: home)?|apartment|manufactured(?: home)?|mobile(?: home)?|manufactured\s*\/\s*mobile|co[ -]?op|duplex|triplex|land|vacant land)(?:s)?$/i.test(v)))];
    if(!source||!identity||values.length!==1)return null;
    return {identity,address:clean(address),type:values[0],style:'',development:details.filter(s=>/^(?:Subdivision(?: Name)?|Development(?: Name)?|Community Name|HOA Name|Association Name)\s*:/i.test(s)).map(clean).join('; '),url,source,readAt:now};
  }
  function sourceResults(records,address,now) {
    const valid=Array.isArray(records)?records.filter(r=>usableListing(r,address,now)):[];
    return ['Zillow','Redfin','Realtor.com'].map(source=>({source,result:valid.filter(r=>r.source===source).sort((a,b)=>b.readAt-a.readAt)[0]||null}));
  }
  function propertyLabel(value){
    const v=clean(value);
    if(/^single[ -]?family(?: residential| home| residence)?$/i.test(v))return 'Single family home';
    if(/^town\s*(?:house|home)$/i.test(v))return 'Townhouse';
    if(/^condo(?:minium)?$/i.test(v))return 'Condo';
    return v;
  }
  function structuredHousing(data,url,address,now){
    const queue=[data],found=[];let count=0;
    while(queue.length&&count++<100){const n=queue.shift();if(!n||typeof n!=='object')continue;if(Array.isArray(n)){queue.push(...n.slice(0,50));continue;}
      for(const key of ['@graph','mainEntity','about','itemOffered'])if(n[key])queue.push(n[key]);
      const a=n.address;if(!a||typeof a!=='object'||!a.streetAddress||!a.postalCode)continue;
      const full=clean(a.streetAddress)+', '+clean(a.addressLocality)+' '+clean(a.addressRegion)+' '+clean(a.postalCode);
      if(listingIdentity(full)!==listingIdentity(address))continue;
      const types=Array.isArray(n['@type'])?n['@type']:[n['@type']];
      const labels=[typeof n.accommodationCategory==='string'?n.accommodationCategory:'',...types.map(t=>t==='SingleFamilyResidence'?'Single family home':t==='Apartment'?'Apartment':'')].filter(Boolean);
      const r=parseVisibleListing(full,labels,[],url,now);if(r)found.push(r);
    }
    return found.length&&new Set(found.map(r=>r.type)).size===1?found[0]:null;
  }
  function calendarAssignment(href,rows,now) {
    let url;try{url=new URL(href,'https://www.enabledplus.com');}catch{return null;}
    const id=url.searchParams.get('L'),r=rows.map(clean);
    if(url.origin!=='https://www.enabledplus.com'||!/^\d+$/.test(id||'')||r.length<5||!/^\d{1,2}:\d{2}\s*[AP]M$/i.test(r[2])||!/^Schedule Measure$/i.test(r[4]))return null;
    const name=r[3];
    if(!/^[\p{L}][\p{L} .'-]{1,98}$/u.test(name)||/^(?:unconfirmed|confirmed|unassigned|not assigned|pending|none|cancelled|canceled|tbd)$/i.test(name))return null;
    return {id,name,readAt:now};
  }
  function validCalendarAssignment(record,id,now) {
    return !!record&&record.id===id&&typeof record.name==='string'&&record.name.length>1&&Number.isFinite(record.readAt)&&now>=record.readAt&&now-record.readAt<15*60*1000;
  }
  function consultantFromPairs(pairs) {
    const names=pairs.filter(p=>/^(?:assigned\s+)?(?:design consultant|sales rep(?:resentative)?)\s*:?$/i.test(clean(p.label))).map(p=>clean(p.value)).filter(v=>v&&!/^(?:none|unassigned|not assigned|choose|select|n\/a|pending|tbd)$/i.test(v)&&v.length<100);
    const unique=[...new Set(names)];return unique.length===1?unique[0]:'';
  }
  function parseRouteDistance(text) {
    const matches=[...String(text).matchAll(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(km|miles|mi)\b/g)];
    if(matches.length!==1)return null;
    const km=Number(matches[0][1].replace(/,/g,''))*(matches[0][2]==='km'?1:1.609344);
    return Number.isFinite(km)&&km>=0?km:null;
  }
  function routeRecordValid(r,address,now) {
    return !!r&&!!listingIdentity(address)&&r.identity===listingIdentity(address)&&r.origin==='L5N2X5'&&r.avoidTolls===true&&Number.isFinite(r.km)&&r.km>=0&&Number.isFinite(r.readAt)&&r.readAt<=now&&now-r.readAt<15*60*1000;
  }
  function manufacturedType(value) {return /\b(?:manufactured|mobile)\b/i.test(clean(value).replace(/\b(?:not|no|non)\s*[-:]?\s*(?:a\s+)?(?:manufactured|mobile)(?:\s+home)?/gi,''));}
  function condoSignal(value) {
    const text=clean(value).replace(/\b(?:not|no|non)\s*[-:]?\s*(?:a\s+)?(?:condo(?:minium)?|town\s*(?:house|home)|apartment)(?:s)?\b/gi,'');
    return /\b(?:condo(?:minium)?s?|town\s*(?:house|home)s?|row\s*(?:house|home)s?|apartments?|multi[ -]?unit)\b/i.test(text);
  }
  function hasExplicitUnit(address) {
    const text=clean(address);
    const tokens=[...text.matchAll(/(?:\b(?:unit|apt|apartment|suite|ste)\.?\s*[:#-]?\s*|#\s*)([a-z0-9]+(?:-[a-z0-9]+)?)\b/gi)].map(m=>m[1]);
    return tokens.some(v=>!/^(?:na|none|unknown|tbd|not|no|is|number|needed|required)$/i.test(v)&&(/\d/.test(v)||/^[a-z]$/i.test(v))&&!(/^(?:n)$/i.test(v)&&/\bn\s*\/\s*a\b/i.test(text)));
  }
  function unitWarning(address,leadType,manualType,listingTypeValue,notesHint) {
    const sources=[];
    if(condoSignal(leadType))sources.push('Enabled+ property type');
    if(condoSignal(manualType))sources.push('your listing selection');
    if(condoSignal(listingTypeValue))sources.push('matching property listing');
    if(notesHint)sources.push('lead notes');
    return {show:sources.length>0&&!hasExplicitUnit(address),sources};
  }
  function propertyCheckSummary(records,state){
    const types=[...new Set(records.map(r=>propertyLabel(r.type).toLowerCase()))];
    const statuses=Object.values(state?.statuses||{});
    const mismatch=statuses.some(s=>/^Address mismatch/.test(s));
    if(types.length>1)return {label:'Property types disagree · Review',warning:'Property types disagree · Review'};
    if(mismatch)return {label:records.length?'Matched source · Other address differs':'Address mismatch · Review',warning:'Listing address differs · Review'};
    if(records.length)return {label:'Verified listing · '+propertyLabel(records[0].type),warning:''};
    if(statuses.some(s=>s==='Checking'||s==='Queued'))return {label:'Checking property type…',warning:''};
    return {label:'Unavailable · Property type unverified',warning:''};
  }
  function listingAddressMismatch(expected,actual){
    const wanted=listingIdentity(expected),found=listingIdentity(actual);
    return !!wanted&&!!found&&wanted!==found;
  }
  // Made by Montana. History extraction adapted from our Not Home Guard.
  function historyResults(rows){
    const unique=rows.filter((r,i,all)=>all.findIndex(o=>o.dateText===r.dateText&&o.history===r.history&&o.doneBy===r.doneBy)===i);
    return {loadedCount:unique.length,rows:unique.filter(r=>/^(?:not\s+home|no\s+demo|demo\s+no\s+sale|dns|sale|cancelled\s+sale|canceled\s+sale)$/i.test(clean(r.history))),notHomes:unique.filter(r=>/^not\s+home$/i.test(clean(r.history))),noDemos:unique.filter(r=>/^no\s+demo$/i.test(clean(r.history))),demoNoSales:unique.filter(r=>/^(?:demo\s+no\s+sale|dns)$/i.test(clean(r.history))),sales:unique.filter(r=>/^sale$/i.test(clean(r.history))),cancelledSales:unique.filter(r=>/^cancel(?:led|ed)\s+sale$/i.test(clean(r.history)))};
  }
  function historyGuidance(results){
    const notes=[];
    if(results.notHomes.length>=2)notes.push('STOP — 2+ Not Homes: do not message-confirm. Contact Confirm Leaders in Cutting Edge before proceeding. Call the homeowner and review the result notes; a call alone does not replace leader review.');
    else if(results.notHomes.length)notes.push('1 Not Home: verify setter/source eligibility, including proxy restrictions. Under the saved confirmation guide, same-day/next-day may use message confirmation; two or more days out requires Reply C or live confirmation. Source-specific rules still apply.');
    if(results.notHomes.length>=2)notes.push('Rep Getting No Answer / reschedule replies only: with 2+ prior Not Homes, do not offer a reschedule; follow the Not Home Reply Guide and Andersen referral instructions. This is separate from confirmation leader review.');
    if(results.noDemos.length)notes.push('No Demo: read every No Demo result note. Address each red flag with the homeowner before confirming; do not assume a new appointment resolves the previous issue. If the notes are unclear, ask a leader.');
    if(results.demoNoSales.length>=2)notes.push('2+ Demo No Sales: do not message-confirm. Speak with the homeowner and establish whether this is the same project and when it was quoted.');
    else if(results.demoNoSales.length)notes.push('Demo No Sale: verify the project and prior quote date before confirming.');
    if(results.demoNoSales.length>=2&&results.notHomes.length)notes.push('Price-increase review (saved Not Home tool guidance): multiple Demo No Sales plus a Not Home. Check whether this is the same project and verify the actual quote date. Same-project quote over one year old: have the price-increase conversation before confirming. Within one year: follow the sales-rep or sales-manager escalation process. Unknown date, exactly one year, different project, or conflicting instructions: ask a leader. History-entry dates and result counts do not establish quote age.');
    if(results.cancelledSales?.length)notes.push('Cancelled Sale: review the cancellation reason and project status in Appointment History. Check current company guidance or a leader before proceeding; this result is not an appointment cancellation.');
    if(results.sales?.length)notes.push('Sale: review the sold project and current status before discussing a new appointment. A prior sale alone is not a do-not-confirm rule.');
    return notes;
  }
  function openOriginalHistory(){
    const pill=document.getElementById('leadHistoryPill'),popup=document.getElementById('leadHistoryPopup');
    if(!pill){notice('Optional Appointment History tool not detected. This tool reads history independently; use the list here and original lead notes.');return;}
    if(!popup||popup.getClientRects().length===0)pill.click();
  }
  function readAppointmentHistory(){
    const rows=[...document.querySelectorAll('.history tr')].map(row=>{
      const date=row.querySelector('.datecolumn'),result=row.querySelector('.historycolumn'),by=row.querySelector('.donebycolumn');
      return date&&result&&by?{dateText:clean(date.textContent),history:clean(result.textContent),doneBy:clean(by.textContent)}:null;
    }).filter(Boolean);
    return historyResults(rows);
  }
  function refreshHistory(){
    if(!panel||!lead)return;
    const box=panel.querySelector('#spa-history');if(!box)return;
    const result=readAppointmentHistory(),fingerprint=JSON.stringify([lead.id,result]);
    setHistoryAlarm(result.rows.length?JSON.stringify([lead.id,result.rows]):'');
    if(box.dataset.history===fingerprint)return;box.dataset.history=fingerprint;
    const total=result.rows.length;
    let bubble=panel.querySelector('#spa-history-bubble');if(!bubble){bubble=document.createElement('button');bubble.id='spa-history-bubble';bubble.type='button';panel.querySelector('.spa-heading').append(bubble);}
    bubble.hidden=!total;bubble.textContent='History review · '+total;bubble.setAttribute('aria-label',total+' appointment result flags. Open history review');
    bubble.onclick=()=>{if(panel.dataset.mini==='true')panel.querySelector('[data-action=mini]').click();const section=panel.querySelector('#spa-history')?.closest('details');if(section)section.open=true;panel.querySelector('#spa-history')?.scrollIntoView({block:'nearest'});};
    const summary=result.loadedCount?`${result.notHomes.length} Not Home · ${result.noDemos.length} No Demo · ${result.demoNoSales.length} Demo No Sale · ${result.cancelledSales.length} Cancelled Sale · ${result.sales.length} Sale`:'History unavailable or no readable rows. Review the original history; this is not clearance.';
    box.innerHTML='<p><strong>'+esc(summary)+'</strong></p><div class="spa-history-scroll" role="region" aria-label="History issues and guidance" tabindex="0">'+
      historyGuidance(result).map(text=>'<p class="status">'+esc(text)+'</p>').join('')+
      (result.rows.length?'<small>Read directly from this lead. Dates are history-entry dates; full result notes remain in the original lead history.</small>'+result.rows.map(r=>'<p class="status"><strong>'+esc(r.history)+'</strong><br>'+esc(r.dateText)+'<br><small>'+esc(r.doneBy)+'</small></p>').join(''):result.loadedCount?'<p>No matching outcomes in the readable history. This is not confirmation clearance.</p>':'<p>Waiting for readable history on the lead.</p>')+
      '</div><details><summary>Guidance sources</summary><small>Based on the saved company guidance reviewed September 8, 2026 and your Not Home tool. Open the current guides if instructions have changed; unresolved cases need leader review.</small><div class="row"><a href="https://confirmdailycalender.netlify.app/not-home-guide" target="_blank" rel="noopener noreferrer">Not Home confirmation guide</a><a href="https://confirmdailycalender.netlify.app/not-home-reply-guide" target="_blank" rel="noopener noreferrer">Not Home reply guide</a></div></details><button type="button" data-open-history>Open Appointment History tool (optional)</button>';
    box.onclick=e=>{if(e.target.closest?.('[data-open-history]'))openOriginalHistory();};
  }
  function headerSummary(current,distance) {
    const km=distance?.km;
    const types=[...new Set((current.listingTypes||[]).map(propertyLabel).filter(Boolean))];
    const label=types.length>1?'Property types differ':types[0]||current.type||'Property type unverified';
    const property=types.length?titleCase(label):current.type?titleCase(label)+' (lead only)':label;
    return {title:canadianLead(current)?'Canada · '+(Number.isFinite(km)?km.toFixed(1)+' km':distance?.error?'unavailable':'checking…'):titleCase(current.name)||'Property Assistant',
      detail:canadianLead(current)?(Number.isFinite(km)?['street','postal','city'].includes(distance.precision)?(distance.precision==='street'?'Street estimate · Verify route':distance.precision==='postal'?'Postal-area estimate · Verify house':'City-area estimate · Verify house'):(distance.estimated?'Estimated drive':'Maps distance')+(gtaMarket(current.region)?' · '+(km>150?'Above Central cutoff':km>147?'Near Central cutoff':'Below Central cutoff'):' · From Mississauga'):distance?.error?'Lookup unavailable':'Checking distance…'):[current.region||'Region unknown',property].join(' · '),
      over:canadianLead(current)&&gtaMarket(current.region)&&Number.isFinite(km)&&km>150&&!['street','postal','city'].includes(distance.precision)};
  }
  function distanceStatus(km) { return !Number.isFinite(km)||km<0?'unknown':km>150?'over':km>147?'near':'within'; }
  function typeComparison(a,b) {
    const type=v=>/town\s*(?:home|house)/i.test(v)?'town':/condo/i.test(v)?'condo':/single[ -]?family|^sf$/i.test(v)?'single':/multi[ -]?family|duplex|triplex/i.test(v)?'multi':/manufactured|mobile/i.test(v)?'mobile':'';
    const x=type(a),y=type(b);
    if(!x||!y)return {tone:'',text:'Property type not fully identified; review manually.'};
    if(x===y)return {tone:'green',text:'Property-type labels agree (manually compared).'};
    if([x,y].includes('condo'))return {tone:'',text:'Condo describes ownership and may coexist with building-type labels; review rather than assuming a mismatch.'};
    return {tone:'red',text:'Different property-type labels: review the source and Enabled+ before proceeding.'};
  }
  function routeUrl(address) { return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent('L5N 2X5, Mississauga, Ontario, Canada')+'&destination='+encodeURIComponent(address)+'&travelmode=driving&avoid=tolls'; }
  function searchUrl(source,address) {
    if(source==='maps') return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address);
    const domains={zillow:'zillow.com',redfin:/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(address)?'redfin.ca':'redfin.com',realtor:'realtor.com'};
    return 'https://www.google.com/search?q='+encodeURIComponent('site:'+domains[source]+' '+address);
  }
  function physicalAddress(street,cityLine,notes) {
    const hits=[...notes.matchAll(/\b(?:real|actual|original|physical|correct)\s+(?:zip|postal)(?:\s+code)?\s*(?:is\s*)?[:=#-]?\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/gi)].map(m=>m[1].toUpperCase());
    for(const m of notes.matchAll(/\bzip(?:\s+code)?\s+(?:was\s+)?changed\s+from\s+(\d{5})\s+to\s+\d{5}/gi)) hits.push(m[1]);
    const unique=[...new Set(hits.map(postal))];
    const routing=unique.length>0||/(?:zip|postal)[^.\n]{0,45}(?:changed|capacity|routing|do not change)|do not change[^.\n]{0,25}(?:zip|postal)/i.test(notes);
    const strip=cityLine.replace(/\b(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/gi,'').trim();
    return {routing,uncertain:routing&&unique.length!==1,address:clean(street+', '+(routing?strip:cityLine)+(routing&&unique.length===1?' '+hits[0]:''))};
  }
  let panel,identity='',generation=0,controller,lead,windowSync=false,saveTimer,scanTimer;
  const distances=new Map();
  const HISTORY_SOUND_KEY='sixx-property-history-sound-v1';
  let historyAlarmKey='',historyAcknowledged='',historySoundTimer=null,historyAudio=null,historyTone=null;
  function historySoundEnabled(){return savedValue(HISTORY_SOUND_KEY,false)===true;}
  function historySoundAllowed(){return !!historyAlarmKey&&historyAlarmKey!==historyAcknowledged&&historySoundEnabled()&&!document.hidden&&document.hasFocus();}
  function stopHistorySound(){
    if(historySoundTimer!==null){clearInterval(historySoundTimer);historySoundTimer=null;}
    if(historyTone){try{historyTone.stop();}catch{}historyTone=null;}
  }
  function historyBeep(){
    if(!historySoundAllowed()){stopHistorySound();return;}
    if(!historyAudio||historyAudio.state!=='running')return;
    try{const tone=historyAudio.createOscillator(),volume=historyAudio.createGain(),now=historyAudio.currentTime;
      tone.type='sine';tone.frequency.value=660;volume.gain.setValueAtTime(0,now);volume.gain.linearRampToValueAtTime(.08,now+.02);volume.gain.linearRampToValueAtTime(0,now+.3);
      tone.connect(volume);volume.connect(historyAudio.destination);historyTone=tone;tone.onended=()=>{tone.disconnect();volume.disconnect();if(historyTone===tone)historyTone=null;};tone.start();tone.stop(now+.32);
    }catch{stopHistorySound();}
  }
  function updateHistorySound(){
    const mute=panel?.querySelector('#spa-history-sound'),ack=panel?.querySelector('#spa-history-ack');
    const audioStatus=panel?.querySelector('#spa-audio-status');
    if(audioStatus)audioStatus.textContent=!historySoundEnabled()?'Sound off':!historyAlarmKey?'Sound on · No history flags':historyAlarmKey===historyAcknowledged?'Current alert acknowledged':document.hidden||!document.hasFocus()?'Sound paused · Tab inactive':historyAudio?.state!=='running'?'Sound on · Click here to unlock audio':'Sound on · History alert active';
    if(mute){mute.textContent=historySoundEnabled()?'Mute sound':'Enable sound';mute.setAttribute('aria-pressed',String(historySoundEnabled()));mute.title=historySoundEnabled()&&historyAudio?.state!=='running'?'Click the page once to enable browser audio':'Sound preference is remembered across leads';}
    const soundSwitch=panel?.querySelector('#spa-sound-switch');
    if(soundSwitch){soundSwitch.setAttribute('aria-checked',String(historySoundEnabled()));soundSwitch.title=historySoundEnabled()?'Mute alerts (saved across leads)':'Enable alert sound (saved across leads)';}
    const soundLabel=panel?.querySelector('#spa-sound-label');if(soundLabel)soundLabel.textContent=historySoundEnabled()?'Sound on':'Muted';
    if(ack){ack.hidden=!historyAlarmKey;ack.disabled=historyAlarmKey===historyAcknowledged;ack.textContent=ack.disabled?'Acknowledged':'Acknowledge';}
    if(!historySoundAllowed()){stopHistorySound();return;}
    if(historySoundTimer===null){historyBeep();historySoundTimer=setInterval(historyBeep,1800);}
  }
  function setHistoryAlarm(key){if(key!==historyAlarmKey){stopHistorySound();historyAlarmKey=key;historyAcknowledged='';}updateHistorySound();}
  async function unlockHistorySound(){
    if(!historySoundEnabled()||document.hidden||!document.hasFocus())return;
    try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context){if(panel)notice('This browser does not provide audio playback. Visual warnings remain active.');return;}
      const wasRunning=historyAudio?.state==='running';
      if(!historyAudio)historyAudio=new Context();if(historyAudio.state==='suspended')await historyAudio.resume();
      // An existing timer may have ticked before the browser unlocked audio.
      // Restart once on unlock so the first audible beep is immediate, not silently delayed.
      if(!wasRunning&&historyAudio.state==='running')stopHistorySound();
      updateHistorySound();
    }catch{if(panel)notice('Audio unavailable. Visual history warnings remain active.');}
  }
  let listingType='';
  let matchedListing=null;
  let matchedListings=[];
  const unitAcknowledgments=new Set();
  const unitReviewKey=()=>JSON.stringify([lead.id,panel?.querySelector('#spa-address')?.value||lead.address,lead.type,listingType,matchedListings.map(r=>r.source+':'+r.type),lead.condoHint]);
  const distanceKey=()=>JSON.stringify([lead.id,panel?.querySelector('#spa-address')?.value||lead.address,lead.region]);
  const read=selectors=>{for(const s of selectors){const n=document.querySelector(s); const v=clean(n&&(n.value??n.textContent));if(v)return v;}return '';};
  function readLead() {
    const id=new URLSearchParams(location.search).get('L');
    const name=read(['input[name="CustomerName"]','#leadinformation a']);
    const first=read(['input[name="FirstName"]']), last=read(['input[name="LastName"]']);
    const street=read(['.lead-attribute.address','input[name="Address"]']);
    const cityLine=read(['.lead-attribute.city-state-zip']);
    const zip=cityLine.match(/\b(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/i)?.[0]||read(['input[name="Zip"]','input[name="PostalCode"]']);
    const notes=[...document.querySelectorAll('textarea[name="WindowsProblems"],textarea[name="Notes"],#yellowBox,#yellowbox')].map(n=>n.value??n.textContent).join('\n');
    const dwelling=[...document.querySelectorAll('select[name="TypeOfDwelling"]')].map(n=>clean(n.selectedOptions?.[0]?.textContent)).find(v=>v&&!/^(?:choose|select|unknown)$/i.test(v))||'';
    // Current lead summary only. Never infer assignment from historical notes or logged-in agent.
    const consultantPairs=[...document.querySelectorAll('#leadinfocontrol tr')].map(row=>{const cells=[...row.children].filter(n=>/^(TD|TH)$/.test(n.tagName));return {label:cells[0]?.textContent||'',value:cells.length===2?cells[1].textContent:''};});
    let calendarRecord;try{calendarRecord=JSON.parse(localStorage.getItem('sixx-calendar-consultant-v1')||'null');}catch{}
    const summaryConsultant=consultantFromPairs(consultantPairs);
    const consultant=summaryConsultant||(validCalendarAssignment(calendarRecord,id,Date.now())?calendarRecord.name:'');
    const region=[...new Set(['.lead-attribute.sales-region','.lead-attribute.store','#selectedstorename','input[name="SalesRegion"]','input[name="Territory"]'].map(s=>read([s])).filter(Boolean))].join(' | ');
    const nameText=cleanLeadName(first&&last?first+' '+last:name);
    return {id,name:nameText,nameParts:homeownerParts(nameText,first,last),consultant,consultantSource:summaryConsultant?'lead summary':'selected calendar appointment',lastName:cleanLeadName(last)||nameText.split(/\s+/).at(-1)||'',street,cityLine,zip,rawRegion:region,region:effectiveRegion(region),
      phones:['.homephonelabel','.cellphonelabel','.workphonelabel'].map(s=>phone(read([s]))).filter(Boolean),
      type:dwelling||read(['input[name="PropertyType"]','.lead-attribute.property-type'])||assessmentPropertyType(notes),condoHint:condoSignal(notes),...physicalAddress(street,cityLine,notes)};
  }
  function styles() {
    if(document.getElementById(ID+'-style'))return;
    const style=document.createElement('style');style.id=ID+'-style';style.textContent=`
    #${ID} header .spa-heading{flex:1;min-width:0}#${ID} header small{display:block;font-size:11px;font-weight:400}#${ID} .spa-stop{display:block;color:#ff5555;font-weight:700;animation:spa-warning 2.4s ease-in-out infinite}#${ID}[data-over=true] header{border-bottom:2px solid #ff5555}@keyframes spa-warning{50%{opacity:.5}}@media(prefers-reduced-motion:reduce){#${ID} .spa-stop{animation:none}}
    #${ID}{position:fixed;right:16px;top:88px;width:320px;height:480px;min-width:245px;min-height:150px;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);resize:both;overflow:hidden;display:flex;flex-direction:column;z-index:999994;background:#282a36;color:#f8f8f2;border:1px solid #6272a4;border-radius:11px;box-shadow:0 12px 30px #0005;font:12px/1.45 'Segoe UI',sans-serif}
    #${ID} *{box-sizing:border-box}#${ID} header{display:flex;align-items:center;gap:8px;padding:10px;background:#21222c;cursor:move;touch-action:none;user-select:none}#${ID} header strong{flex:1;color:#bd93f9}#${ID} main{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:10px;scrollbar-color:#6272a4 #21222c}#${ID} section{margin-bottom:12px}#${ID} label{display:block;margin:6px 0;color:#c7c9d3}#${ID} input,#${ID} textarea,#${ID} select{width:100%;background:#21222c;color:#f8f8f2;border:1px solid #55596e;border-radius:5px;padding:6px;font:inherit}#${ID} textarea{resize:vertical;min-height:52px}#${ID} button,#${ID} a{background:#343746;color:#f8f8f2;border:1px solid #62667e;border-radius:6px;padding:5px 8px;cursor:pointer;font:inherit;text-decoration:none}#${ID} .row{display:flex;gap:6px;margin-top:7px}#${ID} .row>*{flex:1;min-width:0}#${ID} p{margin:5px 0}#${ID} small{color:#c7c9d3}#${ID} .status{padding:7px;border-left:3px solid #ffb86c;background:#21222c;border-radius:4px}#${ID} [data-tone=red]{border-color:#ff5555}#${ID} [data-tone=green]{border-color:#50fa7b}#${ID} details{margin-top:10px}#${ID} summary{cursor:pointer;color:#bd93f9}#${ID} footer{padding:7px 10px;background:#21222c;color:#c7c9d3}#${ID}[data-mini=true]{min-height:0;resize:both}#${ID}[data-mini=true] main,#${ID}[data-mini=true] footer{display:none}
    #${ID}{border-color:#767096;border-radius:16px;background:#242432;min-width:min(245px,calc(100vw - 12px));font-size:13px}
    #${ID} header{position:relative;flex-shrink:0;isolation:isolate;min-height:60px;background:linear-gradient(125deg,#35304a,#242432);padding:12px;overflow:hidden}
    #${ID} header:before{content:'';position:absolute;pointer-events:none;z-index:-1;right:-22px;top:-28px;width:135px;height:135px;border-radius:50%;opacity:.19;background:repeating-linear-gradient(0deg,transparent 0 5px,#1a1130 5px 8px),linear-gradient(170deg,#ffc778,#ff4fbb 64%,#803bff);transform:rotate(-12deg)}
    #${ID} header strong{color:#e3d1fb;font-size:14px}#${ID} header small{margin-top:3px;color:#d0ccdd}
    #${ID} main{padding:10px;scrollbar-width:thin}#${ID} main::-webkit-scrollbar{width:9px}#${ID} main::-webkit-scrollbar-thumb{background:#77718e;border:2px solid #242432;border-radius:9px}
    #${ID} section{padding:11px;background:#2e2d3e;border:1px solid #494559;border-radius:11px;margin-bottom:10px}#${ID} section>strong{display:block;color:#e3d1fb;margin-bottom:8px}
    #${ID} input,#${ID} textarea,#${ID} select{min-height:32px;background:#22222e;border-color:#676174;border-radius:7px}#${ID} input:focus-visible,#${ID} textarea:focus-visible,#${ID} select:focus-visible,#${ID} button:focus-visible,#${ID} a:focus-visible,#${ID} summary:focus-visible{outline:2px solid #dbc0ff;outline-offset:2px}
    #${ID} button,#${ID} a{min-height:30px;border-color:#777087;background:#3a354c;border-radius:8px}#${ID} button:hover,#${ID} a:hover{background:#4c4363}#${ID} .row{flex-wrap:wrap}#${ID} small{display:block;font-size:11px;line-height:1.5;color:#cecad8}
    #${ID} .status{margin:8px 0;overflow-wrap:anywhere;line-height:1.55}#${ID} [data-tone=red]{background:#36282f}#${ID} [data-tone=green]{background:#253630}
    #${ID} footer{display:flex;flex-shrink:0;align-items:center;gap:8px;padding:8px 10px;font-size:11px;border-top:1px solid #494559}#${ID} footer span{flex:1;overflow-wrap:anywhere}#${ID} footer button{flex-shrink:0;font-size:11px;padding:4px 7px}#${ID}[data-mini=true] header{padding:9px 11px}
    #${ID}[data-mini=true]{max-width:calc(100vw - 12px);border-radius:14px}
    #${ID}[data-mini=true] header{align-items:flex-start;padding:11px 12px}
    #${ID} header [data-action=mini]{width:28px;height:28px;flex-shrink:0;padding:0;border-radius:50%;background:#ffffff0c;border-color:#817398;color:#eee4ff}
    #${ID} #spa-territory-warning{font-size:10px;line-height:1.35;margin-top:7px;padding-top:6px;border-top:1px solid #ffffff20;color:#e7cca5}
    #${ID} #spa-stop{font-size:11px;line-height:1.4;margin-top:5px}
    #${ID} button:focus-visible,#${ID} a:focus-visible,#${ID} select:focus-visible{outline:2px solid #ddc4ff;outline-offset:2px}
    #${ID} [hidden]{display:none!important}#${ID} #spa-unit-badge{color:#ffd08d;font-size:11px;margin-top:5px;font-weight:600}
    /* Retro sunset + neon city palette. Decorative glow never carries a status alone. */
    #${ID}{background:#100d20;color:#f7f1ff;border:1px solid #bc4ba8;border-radius:14px;box-shadow:0 12px 32px #07040f80,0 0 16px #ed47bf1c}
    #${ID} header{background:linear-gradient(115deg,#241238,#17132d 70%,#122334);border-bottom:2px solid #fc67c1}
    #${ID} header:after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;pointer-events:none;background:linear-gradient(90deg,#ffc778,#ff5abd 48%,#65e8f0)}
    #${ID} header strong{color:#ffe2ab;font-weight:700;letter-spacing:.2px}#${ID} header small{color:#ddd1ed}
    #${ID} main{scrollbar-color:#a855a7 #100d20}#${ID} main::-webkit-scrollbar-thumb{background:#a855a7;border-color:#100d20}
    #${ID} section{background:#1c162d;border-color:#493250;border-radius:10px}#${ID} section>strong{color:#77e6ee;letter-spacing:.2px}
    #${ID} input,#${ID} textarea,#${ID} select{background:#120f21;border-color:#705273;color:#fff4ff;accent-color:#ff78ce}
    #${ID} label,#${ID} small{color:#dccfe5}#${ID} input::placeholder,#${ID} textarea::placeholder{color:#b6a4c4;opacity:1}
    #${ID} button,#${ID} a{background:#34203f;border-color:#ae548f;color:#ffe6f7;border-radius:7px;transition:background-color .15s,border-color .15s}
    #${ID} button:hover,#${ID} a:hover{background:#4c2957;border-color:#ff82d0}#${ID} button:disabled{opacity:.6;cursor:wait}
    #${ID} header [data-action=mini]{background:#162c3c;border-color:#65cdd8;color:#99f5ff}
    #${ID} summary{color:#f798d5}#${ID} .status{background:#151123;border-color:#ffc778;color:#f8edff}
    #${ID} [data-tone=red]{background:#321426;border-color:#ff738e}#${ID} [data-tone=green]{background:#102c2b;border-color:#77ead0}
    #${ID} #spa-stop{color:#ff8caa}#${ID}[data-over=true] header{border-bottom-color:#ff738e}#${ID} #spa-territory-warning,#${ID} #spa-unit-badge{color:#ffd390}
    #${ID} footer{background:#171124;border-color:#573454;color:#d8c9e5}
    #${ID} section{padding:0;margin-bottom:8px;overflow:hidden}
    #${ID} details.spa-section{margin:0}
    #${ID} .spa-section>summary{padding:10px 12px;font-weight:650;color:#77e6ee;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px}
    #${ID} .spa-section>summary::-webkit-details-marker{display:none}
    #${ID} .spa-section>summary:after{content:'+';font-size:17px;color:#f798d5}
    #${ID} .spa-section[open]>summary:after{content:'−'}
    #${ID} .spa-section[open]>summary{border-bottom:1px solid #493250}
    #${ID} .spa-section-body{padding:10px}
    #${ID} .spa-tab-toggle{display:flex;gap:7px;align-items:center}#${ID} .spa-tab-toggle input{width:auto;flex:none}#${ID} #spa-tabs-status{display:block;margin-top:5px}
    #${ID} input:focus-visible,#${ID} textarea:focus-visible,#${ID} select:focus-visible,#${ID} button:focus-visible,#${ID} a:focus-visible,#${ID} summary:focus-visible{outline:2px solid #75edee;outline-offset:2px}
    @media(prefers-reduced-motion:reduce){#${ID} button,#${ID} a{transition:none}}
    /* Palette overrides only: typography, sizing, dragging and resize rules stay unchanged. */
    #${ID}[data-theme]{background:var(--spa-bg);color:var(--spa-text);border-color:var(--spa-border)}
    #${ID}[data-theme] header{background:linear-gradient(115deg,var(--spa-header),var(--spa-bg));border-bottom-color:var(--spa-pink)}
    #${ID}[data-theme] header:before{background:repeating-linear-gradient(0deg,transparent 0 5px,var(--spa-bg) 5px 8px),linear-gradient(170deg,var(--spa-heading),var(--spa-pink),var(--spa-accent))}
    #${ID}[data-theme] header:after{background:linear-gradient(90deg,var(--spa-heading),var(--spa-pink),var(--spa-accent))}
    #${ID}[data-theme] header strong{color:var(--spa-heading)}
    #${ID}[data-theme] header small,#${ID}[data-theme] small,#${ID}[data-theme] label{color:var(--spa-muted)}
    #${ID}[data-theme] section{background:var(--spa-surface);border-color:var(--spa-border)}
    #${ID}[data-theme] .spa-section>summary{color:var(--spa-accent);border-color:var(--spa-border)}
    #${ID}[data-theme] summary,#${ID}[data-theme] .spa-section>summary:after{color:var(--spa-pink)}
    #${ID}[data-theme] input,#${ID}[data-theme] textarea,#${ID}[data-theme] select{background:var(--spa-field);color:var(--spa-text);border-color:var(--spa-border);accent-color:var(--spa-pink)}
    #${ID}[data-theme] input::placeholder,#${ID}[data-theme] textarea::placeholder{color:var(--spa-muted)}
    #${ID}[data-theme] button,#${ID}[data-theme] a{background:var(--spa-button);color:var(--spa-text);border-color:var(--spa-border)}
    #${ID}[data-theme] button:hover,#${ID}[data-theme] a:hover{background:var(--spa-hover);border-color:var(--spa-pink)}
    #${ID}[data-theme] header [data-action=mini]{background:var(--spa-button);color:var(--spa-accent);border-color:var(--spa-border)}
    #${ID}[data-theme] .status{background:var(--spa-field);color:var(--spa-text);border-color:var(--spa-warning)}
    #${ID}[data-theme] [data-tone=red]{background:var(--spa-dangerBg);border-color:var(--spa-danger)}
    #${ID}[data-theme] [data-tone=green]{background:var(--spa-successBg);border-color:var(--spa-success)}
    #${ID}[data-theme] #spa-stop{color:var(--spa-danger)}#${ID}[data-theme][data-over=true] header{border-bottom-color:var(--spa-danger)}
    #${ID}[data-theme] #spa-territory-warning,#${ID}[data-theme] #spa-unit-badge{color:var(--spa-warning);border-color:var(--spa-border)}
    #${ID}[data-theme] footer{background:var(--spa-field);color:var(--spa-muted);border-color:var(--spa-border);flex-wrap:wrap}
    #${ID} .spa-audio-settings{display:flex;align-items:center;gap:6px;flex-wrap:wrap;width:100%}
    #${ID} .spa-audio-settings button{font-size:11px;padding:3px 6px}
    #${ID} .spa-history-scroll{max-height:220px;max-height:min(220px,35vh);overflow-y:scroll;min-height:0;overscroll-behavior:contain;scrollbar-gutter:stable;padding:4px 6px 4px 0;overflow-wrap:anywhere}
    #${ID} .spa-history-scroll:focus-visible{outline:2px solid var(--spa-accent,#77e6ee);outline-offset:2px}
    #${ID} #spa-audio-status{flex-basis:100%;font-size:11px;cursor:pointer}
    #${ID} #spa-history-bubble{display:block;max-width:100%;white-space:normal;border-radius:16px;margin-top:5px;padding:4px 9px;background:var(--spa-button);color:var(--spa-text);border:1px solid var(--spa-pink);font-size:11px;animation:spa-history-flash 2.4s ease-in-out infinite}
    #${ID} #spa-history-bubble[hidden]{display:none}
    @keyframes spa-history-flash{50%{background:var(--spa-hover);box-shadow:0 0 0 2px var(--spa-danger)}}
    @media(prefers-reduced-motion:reduce){#${ID} #spa-history-bubble{animation:none}}
    #${ID} #spa-theme{width:auto;max-width:140px;font:inherit;min-height:28px;padding:3px}
    #${ID}[data-theme] main{scrollbar-color:var(--spa-border) var(--spa-bg)}#${ID}[data-theme] main::-webkit-scrollbar-thumb{background:var(--spa-border);border-color:var(--spa-bg)}
    #${ID}[data-theme] :focus-visible{outline-color:var(--spa-accent)}
    /* Made by Montana. Reflow controls, not text size, when the tool is resized. */
    #${ID}{container-type:inline-size;min-width:min(220px,calc(100vw - 12px));min-height:min(240px,calc(100vh - 12px))}
    #${ID} header{max-height:40%;overflow-y:auto;overflow-wrap:anywhere;align-items:flex-start}
    #${ID} main{min-height:45px;min-width:0}
    #${ID} footer{max-height:32%;overflow-y:auto;min-height:0}
    #${ID} .row>*{flex:1 1 110px;max-width:100%}
    #${ID} button,#${ID} a,#${ID} summary{white-space:normal;overflow-wrap:anywhere}
    #${ID} .spa-history-scroll{scrollbar-color:var(--spa-border) var(--spa-bg)}
    #${ID}[data-mini=true]{min-height:0}
    #${ID}[data-mini=true] header{max-height:none}
    /* Dedicated artwork ribbon stays below the heading, never over labels or inputs. */
    #${ID}[data-theme] header{padding-bottom:43px;min-height:95px}
    #${ID}[data-theme] header:before{display:none}
    #${ID}[data-theme] header:after{height:34px;bottom:3px;background-image:var(--spa-art);background-repeat:repeat-x;background-size:160px 34px;pointer-events:none;opacity:.85}
    #${ID}[data-mini=true] header{padding-bottom:34px;min-height:70px}
    #${ID}[data-mini=true] header:after{height:26px;background-size:125px 26px}
    #${ID} #spa-version{display:block;font-size:10px;line-height:1.4;letter-spacing:.04em;color:var(--spa-muted);margin-bottom:3px}
    #${ID} #spa-compact{display:none}
    #${ID}[data-mini=true]:not([data-bubble=true]){min-width:min(170px,calc(100vw - 12px));min-height:min(120px,calc(100vh - 12px));border-radius:12px;resize:both}
    #${ID}[data-mini=true] header{padding:8px;min-height:0;gap:5px}
    #${ID}[data-mini=true] header:after{display:block}
    #${ID}[data-mini=true] .spa-heading>:not(#spa-version):not(#spa-compact){display:none!important}
    #${ID}[data-mini=true] #spa-compact{display:block;min-width:0}
    #${ID} #spa-compact strong,#${ID} #spa-compact small{display:block;max-width:100%;min-width:0;overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere}
    #${ID} #spa-compact strong{font-size:12px;line-height:1.4}
    #${ID} #spa-compact small{font-size:10px;line-height:1.5}
    #${ID} #spa-compact .spa-compact-alert{color:var(--spa-danger)}
    #${ID} #spa-compact .spa-compact-alert:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;background:currentColor;animation:spa-notification-dot 2s ease-in-out infinite}
    @media(prefers-reduced-motion:reduce){#${ID} #spa-compact .spa-compact-alert:before{animation:none}}
    #${ID} #spa-quick-bubble{display:none}
    #${ID} #spa-settings{width:100%;margin:0}
    #${ID} #spa-settings>summary{font-size:12px;font-weight:600;padding:5px;min-height:28px}
    #${ID} .spa-settings-body{display:flex;flex-direction:column;gap:8px;padding:6px 0}
    #${ID} .spa-settings-body input[type=checkbox]{width:auto;min-height:0;margin-right:5px}
    #${ID} .spa-settings-body #spa-theme{display:block;width:100%;max-width:100%;margin-top:4px}
    #${ID} .spa-freshness{margin-top:6px;line-height:1.5}
    #${ID} .spa-section-flag{flex:none;font-size:10px;padding:2px 5px;border:1px solid currentColor;border-radius:5px;margin-left:auto}
    #${ID}[data-theme] .spa-section[data-attention=red] .spa-section-flag{color:var(--spa-danger)}
    #${ID}[data-theme] .spa-section[data-attention=amber] .spa-section-flag{color:var(--spa-warning)}
    #${ID} .spa-section-flag:before,#${ID} #spa-history-bubble:before,#${ID} .spa-stop:before{content:'';display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:currentColor;vertical-align:middle;animation:spa-notification-dot 2s ease-in-out infinite;pointer-events:none}
    @keyframes spa-notification-dot{0%,100%{opacity:1}50%{opacity:.25}}
    #${ID}[data-bubble=true]{width:56px!important;height:56px!important;min-width:56px;min-height:56px;overflow:visible;resize:none;border-radius:50%;border:0;background:transparent;box-shadow:none}
    #${ID}[data-bubble=true] header,#${ID}[data-bubble=true] main,#${ID}[data-bubble=true] footer{display:none}
    #${ID}[data-bubble=true] #spa-quick-bubble{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;width:56px;height:56px;padding:13px 3px 3px;border-radius:50%;background:linear-gradient(140deg,var(--spa-accent),var(--spa-heading));color:var(--spa-bg);border:2px solid var(--spa-pink);box-shadow:0 3px 12px #0005;touch-action:none;cursor:grab;user-select:none}
    #${ID}[data-bubble=true] #spa-quick-bubble:before{content:'';position:absolute;top:3px;left:21px;width:11px;height:11px;background:var(--spa-bubble-art) center/contain no-repeat;pointer-events:none}
    #${ID}[data-bubble=true] #spa-quick-bubble strong{font-size:15px;line-height:1.2;color:var(--spa-bg)}
    #${ID}[data-bubble=true] #spa-quick-bubble small{font-size:9px;line-height:1.2;color:var(--spa-bg)}
    #${ID} .spa-quick-count{position:absolute;right:-3px;top:-3px;min-width:18px;padding:1px 3px;border-radius:10px;background:var(--spa-dangerBg);color:var(--spa-danger);border:1px solid var(--spa-danger);font-size:10px}
    #${ID} .spa-unit-dot{position:absolute;bottom:-2px;left:-2px;width:17px;height:17px;border-radius:50%;background:var(--spa-bg);color:var(--spa-warning);border:1px solid var(--spa-warning);font-size:12px;font-weight:bold;animation:spa-notification-dot 2s ease-in-out infinite}
    #${ID} #spa-quick-bubble[data-tone=verified]{border-color:var(--spa-success)}
    #${ID} #spa-quick-bubble[data-tone=unit]{border-color:var(--spa-warning)}
    #${ID}[data-bubble=true] #spa-quick-bubble[data-mobile=true]{background:var(--spa-dangerBg);color:var(--spa-danger)}
    #${ID}[data-bubble=true] #spa-quick-bubble[data-mobile=true] strong,#${ID}[data-bubble=true] #spa-quick-bubble[data-mobile=true] small{color:var(--spa-danger)}
    @media(prefers-reduced-motion:reduce){#${ID} .spa-unit-dot{animation:none}}
    #${ID} #spa-quick-bubble[data-tone=alert]{border-color:var(--spa-danger);animation:spa-quick-pulse 2.4s ease-in-out infinite}
    @keyframes spa-quick-pulse{0%,100%{box-shadow:0 0 0 2px var(--spa-danger)}45%,65%{box-shadow:0 0 0 7px var(--spa-danger),0 0 20px 7px var(--spa-danger);transform:scale(1.07)}}
    #${ID}[data-bubble=true] #spa-quick-bubble[data-tone=alert]{animation-duration:1.8s}
    #${ID} #spa-history-bubble{animation:none;border-width:1px}
    #${ID} #spa-history-bubble:before{color:var(--spa-danger)}
    #${ID} .spa-stop{animation:none;padding:3px 5px;border-radius:4px}
    @media(prefers-reduced-motion:reduce){#${ID} .spa-section-flag:before,#${ID} #spa-history-bubble:before,#${ID} .spa-stop:before{animation:none;opacity:1}}
    @media(prefers-reduced-motion:reduce){#${ID} #spa-quick-bubble[data-tone=alert]{animation:none}}
    /* Bottom settings remain reachable, with their own bounded scrolling area. */
    #${ID}{box-sizing:border-box;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px)}
    #${ID}[data-mini=true]:not([data-bubble=true]) header{display:grid;grid-template-columns:1fr repeat(3,28px);align-items:center;padding-bottom:40px}
    #${ID}[data-mini=true] .spa-heading{display:contents}
    #${ID}[data-mini=true] #spa-version{grid-row:1;grid-column:1;font-size:10px}
    #${ID}[data-mini=true] header>button{grid-row:1;width:28px;padding:0}
    #${ID}[data-mini=true] #spa-compact{grid-row:2;grid-column:1 / -1;width:100%}
    #${ID}[data-mini=true] #spa-compact .spa-compact-alert{white-space:normal}
    #${ID} footer{display:block;max-height:45%;overflow:hidden;flex-shrink:0}
    #${ID} #spa-settings{display:flex;flex-direction:column;min-height:0}
    #${ID} #spa-settings>summary{position:sticky;top:0;background:var(--spa-surface);z-index:1}
    #${ID} .spa-settings-body{max-height:min(180px,25vh);overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:6px}
    #${ID} .spa-preferences{min-width:0;border:1px solid var(--spa-border);border-radius:6px;margin:4px 0;padding:7px}
    #${ID} .spa-preferences legend{color:var(--spa-heading)}
    #${ID} footer #spa-credit{font-size:10px}
    #${ID}[data-density=compact] main,#${ID}[data-density=compact] .spa-section-body{padding:6px}
    #${ID}[data-density=compact] .spa-section>summary{padding:6px 8px}
    #${ID}[data-density=compact] label{margin:3px 0}
    #${ID}[data-density=compact] header{padding-bottom:43px;min-height:95px}
    #${ID}[data-density=compact] header:after{display:block}
    #${ID}[data-density=large]{font-size:16px}
    #${ID}[data-density=large] small,#${ID}[data-density=large] header small,#${ID}[data-density=large] footer,#${ID}[data-density=large] footer button,#${ID}[data-density=large] .spa-audio-settings button,#${ID}[data-density=large] #spa-settings>summary{font-size:14px}
    #${ID}[data-density=large] header strong,#${ID}[data-density=large] #spa-compact strong{font-size:16px}
    #${ID}[data-density=large] #spa-compact small{font-size:13px}
    #${ID}[data-motion=steady] *,#${ID}[data-motion=steady] *:before,#${ID}[data-motion=steady] *:after{animation:none!important;transition:none!important}
    #${ID} header button{flex-shrink:0;min-width:28px}
    @media(max-height:500px){
      #${ID}[data-theme] header{padding-bottom:43px;min-height:0;max-height:40%}
      #${ID}[data-theme] header:after{display:block}
      #${ID} footer{padding:4px 6px}
      #${ID} footer #spa-notice,#${ID} footer #spa-credit{display:none}
    }
    #${ID} .spa-theme-previews{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-top:6px}
    #${ID} .spa-theme-previews button{font-size:12px;text-align:left;min-height:54px;padding:6px}
    #${ID} .spa-theme-swatches{display:flex;gap:3px;margin-bottom:4px}
    #${ID} .spa-theme-swatches i{display:block;width:15px;height:15px;border:1px solid currentColor;border-radius:50%}
    #${ID}[data-artwork=false] header:after,#${ID}[data-artwork=false] #spa-quick-bubble:before{display:none!important}
    #${ID}[data-artwork=false] header{padding-bottom:8px!important;min-height:0!important}
    /* Status chips have consistent semantic colors independent of decorative palettes. */
    #${ID} .spa-section-flag{background:#fff1c2;color:#694000}
    #${ID} [data-attention=red] .spa-section-flag,#${ID} .spa-quick-count{background:#ffe4e6;color:#9f1239;border-color:#9f1239}
    #${ID} .spa-unit-dot{background:#fff1c2;color:#694000;border-color:#694000}
    #${ID}[data-bubble=true] #spa-quick-bubble[data-mobile=true]{background:#ffe4e6;color:#9f1239;border-color:#9f1239}
    #${ID}[data-bubble=true] #spa-quick-bubble[data-mobile=true] strong,#${ID}[data-bubble=true] #spa-quick-bubble[data-mobile=true] small{color:#9f1239}
    #${ID}[data-bubble=true] #spa-quick-bubble[data-tone=verified] strong,#${ID}[data-bubble=true] #spa-quick-bubble[data-tone=unit] strong{background:#dcfce7;color:#14532d;border-radius:50%;padding:0 3px}
    /* Artwork occupies its own row instead of overlaying long header text. */
    #${ID}[data-theme] header{flex-wrap:wrap;padding-bottom:8px;min-height:0}
    #${ID}[data-theme] header:after{position:static;flex:0 0 100%;width:100%;height:30px;min-height:30px;grid-column:1 / -1;grid-row:3}
    #${ID} #spa-sound-bar{display:flex;flex:0 0 auto;align-items:center;justify-content:flex-end;gap:8px;padding:4px 9px;background:var(--spa-field);border-top:1px solid var(--spa-border);color:var(--spa-text);font-size:11px}
    #${ID} #spa-history-sound{display:none}
    #${ID} #spa-sound-switch{display:flex;align-items:center;justify-content:space-between;position:relative;width:62px;height:26px;min-height:26px;padding:2px 5px;border-radius:20px;background:var(--spa-button);border:1px solid var(--spa-border)}
    #${ID} #spa-sound-switch span{font-size:12px;z-index:1;line-height:18px}
    #${ID} #spa-sound-switch i{position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--spa-accent);transition:transform .15s}
    #${ID} #spa-sound-switch[aria-checked=true] i{transform:translateX(35px)}
    #${ID}[data-bubble=true] #spa-sound-bar{display:none}
    @media(prefers-reduced-motion:reduce){#${ID} #spa-sound-switch i{transition:none}}
    /* Both rectangular modes resize; typography grows within readable limits. */
    #${ID}:not([data-bubble=true]){resize:both}
    #${ID}[data-mini=true]:not([data-bubble=true]) header{flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto;align-content:start}
    #${ID} main{font-size:clamp(13px,3.8cqi,16px)}
    #${ID}[data-density=large] main{font-size:clamp(16px,4.4cqi,19px)}
    #${ID} main small{font-size:clamp(11px,3.1cqi,14px)}
    #${ID}[data-density=large] main small{font-size:clamp(14px,3.8cqi,17px)}
    #${ID}[data-mini=true] #spa-compact strong{font-size:clamp(13px,5.5cqi,18px);white-space:normal;overflow-wrap:anywhere}
    #${ID}[data-mini=true] #spa-compact small{font-size:clamp(11px,4.6cqi,15px);white-space:normal;overflow-wrap:anywhere}
    #${ID}[data-mini=true][data-density=large] #spa-compact strong{font-size:clamp(16px,6cqi,20px)}
    #${ID}[data-mini=true][data-density=large] #spa-compact small{font-size:clamp(14px,5cqi,17px)}
    #${ID} header button{align-self:start}
    #${ID}[data-short=true]:not([data-mini=true]) header{max-height:28%}
    #${ID}[data-short=true] footer #spa-notice,#${ID}[data-short=true] footer #spa-credit{display:none}
    #${ID}[data-short=true] .spa-settings-body{max-height:32px}
    #${ID}[data-short=true] footer{padding:3px 6px}
    #${ID} #spa-sound-bar{padding-right:18px}
    #${ID} #spa-compact .spa-source-link{display:inline;min-height:0;padding:0;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;white-space:normal;overflow-wrap:anywhere}
    /* Smaller compact rectangle; preserve artwork, scrolling and large-text preference. */
    #${ID}[data-mini=true]:not([data-bubble=true]) header{grid-template-columns:1fr repeat(3,24px);padding:5px;gap:3px}
    #${ID}[data-mini=true] header>button{width:24px;height:24px;min-height:24px}
    #${ID}[data-mini=true][data-theme] header:after{height:20px;min-height:20px;background-size:auto 20px}
    #${ID}[data-mini=true] #spa-compact{line-height:1.25}
    #${ID}[data-mini=true] #spa-compact strong{font-size:clamp(12px,5cqi,16px);line-height:1.25}
    #${ID}[data-mini=true] #spa-compact small{font-size:clamp(11px,4.4cqi,13px);line-height:1.25;margin-top:2px}
    #${ID}[data-mini=true][data-density=large] #spa-compact strong{font-size:16px}
    #${ID}[data-mini=true][data-density=large] #spa-compact small{font-size:14px}
    #${ID}[data-mini=true] #spa-sound-bar{padding:2px 18px 2px 6px;gap:4px}
    #${ID} #spa-compact .spa-source-link:hover{color:var(--spa-accent);background:transparent}
    #${ID} #spa-compact .spa-source-link:focus-visible{outline:2px solid var(--spa-accent);outline-offset:2px}
    #${ID} #spa-notification-badge{position:absolute;left:5px;top:5px;width:26px;height:24px;min-height:24px;padding:0;border-radius:20px;background:var(--spa-button);color:var(--spa-text);border:1px solid var(--spa-border);font-size:11px;z-index:2}
    #${ID} #spa-notification-badge[data-attention=true]:after{content:'';position:absolute;width:7px;height:7px;top:-2px;right:-2px;border-radius:50%;background:#ff647c;animation:spa-notification-dot 2s ease-in-out infinite}
    #${ID} #spa-version{padding-left:30px;min-height:24px}
    #${ID}[data-motion=steady] #spa-notification-badge:after{animation:none}
    @media(prefers-reduced-motion:reduce){#${ID} #spa-notification-badge:after{animation:none}}
    #${ID}-notifications{position:fixed;z-index:999994;box-sizing:border-box;width:310px;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);display:flex;flex-direction:column;overflow:hidden;background:var(--spa-surface);color:var(--spa-text);border:1px solid var(--spa-border);border-radius:12px;box-shadow:0 8px 24px #0005;font:12px/1.4 'Segoe UI',sans-serif}
    #${ID}-notifications[hidden]{display:none}
    #${ID}-notifications *{box-sizing:border-box}
    #${ID}-notifications .spa-inbox-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;background:var(--spa-header);flex-shrink:0}
    #${ID}-notifications .spa-inbox-head strong{flex:1}
    #${ID}-notifications button{background:var(--spa-button);color:var(--spa-text);border:1px solid var(--spa-border);border-radius:6px;padding:4px 7px;cursor:pointer;font:inherit}
    #${ID}-notifications button:focus-visible{outline:2px solid var(--spa-accent);outline-offset:1px}
    #${ID}-notifications .spa-inbox-list{overflow-y:auto;min-height:0;overscroll-behavior:contain;padding:6px}
    #${ID}-notifications article{padding:8px;border-bottom:1px solid var(--spa-border);overflow-wrap:anywhere}
    #${ID}-notifications article>button[data-dismiss]{float:right;margin-left:4px}
    #${ID}-notifications article small{display:block;white-space:pre-line;color:var(--spa-muted)}
    #${ID}-notifications p{margin:6px 0}
    #${ID}-notifications .spa-inbox-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
    @container (max-width:360px){
      #${ID} main,#${ID} .spa-section-body{padding:7px}
      #${ID} .row{flex-direction:column}
      #${ID} .row>*{flex:auto;width:100%}
      #${ID} .spa-section>summary{padding:8px}
      #${ID} footer{gap:5px;padding:6px}
      #${ID} footer>span{flex:1 0 100%;min-width:0}
      #${ID} footer>button{flex:1 0 100%}
      #${ID} #spa-theme{width:100%;max-width:100%;flex:1 0 100%}
    }
    `;(document.head||document.documentElement).append(style);
  }
  function displayPreferences(value){
    const p=value&&typeof value==='object'?value:{};
    return {density:['compact','comfortable','large'].includes(p.density)?p.density:'comfortable',motion:p.motion==='steady'?'steady':'pulse',distance:p.distance!==false,history:p.history!==false,property:p.property!==false,artwork:p.artwork!==false};
  }
  function applyDisplayPreferences(){
    const p=displayPreferences(savedValue('sixx-property-display-v1',{}));
    panel.dataset.density=p.density;panel.dataset.motion=p.motion;panel.dataset.artwork=String(p.artwork);
    return p;
  }
  function viewportBounds(width,height){
    return {width:Math.max(1,width-12),height:Math.max(1,height-12)};
  }
  function clamp(){const bounds=viewportBounds(innerWidth,innerHeight);panel.style.maxWidth=bounds.width+'px';panel.style.maxHeight=bounds.height+'px';for(const k of ['width','height']){const value=parseFloat(panel.style[k]);if(Number.isFinite(value)&&value>bounds[k])panel.style[k]=bounds[k]+'px';}const r=panel.getBoundingClientRect();panel.dataset.short=String(r.height<350);panel.style.left=Math.max(6,Math.min(r.left,innerWidth-r.width-6))+'px';panel.style.top=Math.max(6,Math.min(r.top,innerHeight-r.height-6))+'px';panel.style.right='auto';}
  function save(){if(windowSync)return;const r=panel.getBoundingClientRect();const minimized=panel.dataset.mini==='true';try{localStorage.setItem(KEY,JSON.stringify({left:r.left,top:r.top,width:minimized?Number(panel.dataset.w):r.width,height:minimized?Number(panel.dataset.h):r.height,compactWidth:panel.dataset.mini==='true'&&panel.dataset.bubble!=='true'?r.width:Number(panel.dataset.cw)||210,compactHeight:panel.dataset.mini==='true'&&panel.dataset.bubble!=='true'?r.height:Number(panel.dataset.ch)||170,minimized,bubble:panel.dataset.bubble==='true'}));}catch{}}
  function restore(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(!s)return;for(const k of ['left','top','width','height'])if(Number.isFinite(s[k]))panel.style[k]=s[k]+'px';panel.dataset.w=String(s.width||320);panel.dataset.h=String(s.height||480);const oldDefault=s.compactWidth===224&&s.compactHeight===220;panel.dataset.cw=String(oldDefault?210:s.compactWidth||210);panel.dataset.ch=String(oldDefault?170:s.compactHeight||170);panel.dataset.bubble=String(s.bubble===true);panel.dataset.mini=String(s.minimized===true||s.bubble===true);if(s.minimized===true&&!s.bubble){panel.style.width=panel.dataset.cw+'px';panel.style.height=panel.dataset.ch+'px';}panel.style.right='auto';miniLabel();clamp();}catch{}}
  function setPanelMode(mode){
    const r=panel.getBoundingClientRect();if(panel.dataset.mini!=='true'){panel.dataset.w=String(r.width);panel.dataset.h=String(r.height);}else if(panel.dataset.bubble!=='true'){panel.dataset.cw=String(r.width);panel.dataset.ch=String(r.height);}
    panel.dataset.bubble=String(mode==='bubble');panel.dataset.mini=String(mode!=='full');
    if(mode==='full'){panel.style.width=(Number(panel.dataset.w)||320)+'px';panel.style.height=(Number(panel.dataset.h)||480)+'px';}else if(mode==='compact'){panel.style.width=(Number(panel.dataset.cw)||210)+'px';panel.style.height=(Number(panel.dataset.ch)||170)+'px';}
    miniLabel();clamp();save();updateQuickBubble();
  }
  function quickBubbleState(current,history,distance,mobile){
    const count=history.rows.length,canada=current&&canadianLead(current),km=distance?.km;
    const label=mobile?'MH':canada&&Number.isFinite(km)?String(Math.round(km)):count?'H'+count:canada&&!distance?.error?'…':'?';
    return {label,count,tone:mobile||count?'alert':'review',unit:!mobile&&canada&&Number.isFinite(km)?'km est.':mobile?'review':count?'history':'review',target:mobile?'spa-extracted':count?'spa-history':canada?'spa-km':'spa-extracted'};
  }
  function propertyBubbleState(base,records,warning,unitReview,now=Date.now()){
    if(base.label==='MH')return {...base,label:'✕',unit:'Mobile home',target:'spa-extracted',tone:'alert',mobile:true};
    const fresh=records.filter(r=>Number.isFinite(r.readAt)&&now>=r.readAt&&now-r.readAt<LISTING_TTL);
    const types=[...new Set(fresh.map(r=>propertyLabel(r.type)))];
    if(warning||types.length>1)return {...base,label:'!',unit:'Type review',target:'spa-extracted',tone:'alert',unitReview:!!unitReview};
    const labels={'Single family home':'Single family',Townhouse:'Townhouse',Condo:'Condo'};
    if(types.length!==1||!labels[types[0]])return base;
    return {...base,label:'✓',unit:labels[types[0]],target:'spa-extracted',tone:base.count?'alert':unitReview?'unit':'verified',unitReview:!!unitReview,verified:true};
  }
  function compactPropertySources(records,check,now=Date.now()){
    const fresh=records.filter(r=>Number.isFinite(r.readAt)&&now>=r.readAt&&now-r.readAt<LISTING_TTL&&['Zillow','Redfin','Realtor.com'].includes(r.source));
    const lines=[...new Set(fresh.map(r=>r.source+' — '+propertyLabel(r.type)))];
    if(lines.length)return lines.join('\n')+(check?.warning?'\n'+check.warning:'');
    return check?.warning||(/Checking/.test(check?.label||'')?'Checking property websites…':'Property websites: not verified');
  }
  function compactSourceLinks(records,check,now=Date.now()){
    return compactPropertySources(records,check,now).split('\n').map(line=>{
      const record=records.find(r=>r.source+' — '+propertyLabel(r.type)===line&&Number.isFinite(r.readAt)&&now>=r.readAt&&now-r.readAt<LISTING_TTL&&listingSource(r.url)===r.source);
      if(!record)return esc(line);
      const url=new URL(record.url);if(url.username||url.password)return esc(line);
      return '<a class="spa-source-link" href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer" title="Open matching '+esc(record.source)+' listing">'+esc(line)+'</a>';
    }).join('<br>');
  }
  function compactSummary(current,distance,property,mobile,historyCount,flagCount,preferences={}){
    if(!current)return {title:'Waiting for lead',detail:'No lead loaded',alert:''};
    const canada=canadianLead(current)&&preferences.distance!==false;
    const title=canada?(Number.isFinite(distance?.km)?Math.round(distance.km)+' km · estimate':distance?.error?'Distance unavailable':'Checking distance…'):(current.name||'Homeowner');
    const detail=[current.region||'',mobile?'Mobile/manufactured':preferences.property===false?'':property||'Property not verified',preferences.history!==false&&historyCount?historyCount+' history results':''].filter(Boolean).join(' · ');
    const alert=mobile?'Mobile home · review':flagCount?flagCount+' sections to review':historyCount?historyCount+' history results · review':'';
    return {title,detail,alert};
  }
  function updateQuickBubble(){
    const button=panel?.querySelector('#spa-quick-bubble');if(!button)return;
    if(!lead)updateNotifications([]);
    const history=lead?readAppointmentHistory():{rows:[]};
    const mobile=!!lead&&(manufacturedType(lead.type)||manufacturedType(listingType)||matchedListings.some(r=>manufacturedType(r.type+' '+r.style)));
    const unitReview=!!lead&&unitWarning(panel.querySelector('#spa-address')?.value||lead.address,lead.type,listingType,matchedListings.map(r=>r.type).join(' / '),lead.condoHint).show&&!unitAcknowledgments.has(unitReviewKey());
    const state=propertyBubbleState(quickBubbleState(lead,history,lead?distances.get(distanceKey()):null,mobile),lead?matchedListings:[],lead?.propertyCheck?.warning,unitReview);
    const guidance=lead?historyGuidance(history).join(' '):'';
    const compact=panel.querySelector('#spa-compact');
    if(compact){
      const flags=panel.querySelectorAll('.spa-section-flag:not([hidden])').length;
      const prefs=displayPreferences(savedValue('sixx-property-display-v1',{}));
      const sources=lead&&prefs.property?compactPropertySources(matchedListings,lead.propertyCheck):'';
      const info=compactSummary(lead,lead?distances.get(distanceKey()):null,'',mobile,history.rows.length,lead?flags:0,{...prefs,property:false});
      const firstIssue=panel.querySelector('#spa-workflow strong')?.textContent?.replace(/^Next action · /,'');
      if(!mobile&&flags&&firstIssue)info.alert=firstIssue+(flags>1?' · +'+(flags-1)+' sections':'');
      compact.innerHTML='<strong>'+esc(info.title)+'</strong><small>'+esc(info.detail)+'</small>'+(sources?'<small class="spa-compact-sources">'+compactSourceLinks(matchedListings,lead.propertyCheck)+'</small>':'')+(info.alert?'<small class="spa-compact-alert">'+esc(info.alert)+'</small>':'');
      compact.title=[info.title,info.detail,sources,info.alert,'Restore for full details. Not confirmation clearance.'].filter(Boolean).join(' · ');
    }
    const summary=[lead?.name||'Waiting for lead',lead?.region||'',state.verified?'Property type read from a matching listing: '+state.unit:'',state.unitReview?'Check whether a unit number applies. Condos and townhouses do not always have one.':'',mobile?'Mobile/manufactured home: review required':'',history.rows.length+' history results needing review',guidance,panel.querySelector('#spa-title')?.textContent||'',panel.querySelector('#spa-subtitle')?.textContent||'','Open details. This indicator is not confirmation clearance.'].filter(Boolean).join(' · ');
    button.dataset.tone=state.tone;button.dataset.target=state.target;button.dataset.mobile=String(!!state.mobile);
    button.title=summary;button.setAttribute('aria-label',summary);
    button.innerHTML='<strong>'+esc(state.label)+'</strong><small>'+esc(state.unit)+'</small>'+(state.count?'<span class="spa-quick-count">'+Math.min(state.count,99)+(state.count>99?'+':'')+'</span>':'')+(state.unitReview?'<span class="spa-unit-dot" aria-hidden="true">!</span>':'');
  }
  function freshnessLabel(readAt,now=Date.now()){
    if(!Number.isFinite(readAt)||readAt>now)return 'Not verified';
    const age=Math.floor((now-readAt)/60000);
    return age===0?'Checked just now':age<15?'Checked '+age+' min ago':'Older result · Verify again';
  }
  // Made by Montana. Review is session-only, never eligibility clearance or a company-record edit.
  let reviewedWorkflowKey='';
  // Session-only inbox review never changes company records or erases underlying warnings.
  const dismissedNotifications=new Set();
  let notificationItems=[],notificationLead='',notificationTray=null,notificationRetryAt=0;
  function notificationKey(id,item){return JSON.stringify([id,item.kind,item.title,item.target,item.evidence]);}
  function positionNotifications(){
    if(!notificationTray||notificationTray.hidden||!panel)return;
    const r=panel.getBoundingClientRect(),height=Math.min(420,innerHeight-12);
    notificationTray.style.maxHeight=Math.max(80,height)+'px';
    notificationTray.style.left=Math.max(6,Math.min(r.left,innerWidth-322))+'px';
    notificationTray.style.top=Math.max(6,Math.min(r.top+34,innerHeight-height-6))+'px';
    for(const key of ['surface','text','border','header','button','accent','muted'])notificationTray.style.setProperty('--spa-'+key,panel.style.getPropertyValue('--spa-'+key));
  }
  function updateNotifications(items){
    const id=lead?.id||'';
    if(id!==notificationLead){dismissedNotifications.clear();notificationLead=id;if(notificationTray)notificationTray.hidden=true;}
    notificationItems=items;
    const visible=items.filter(item=>!dismissedNotifications.has(notificationKey(id,item)));
    const badge=panel?.querySelector('#spa-notification-badge');
    if(badge){badge.textContent=visible.length?String(Math.min(visible.length,99)):'✓';badge.dataset.attention=String(visible.length>0);badge.setAttribute('aria-label','Notifications: '+visible.length+' unreviewed flags');badge.setAttribute('aria-expanded',String(!!notificationTray&&!notificationTray.hidden));badge.title='Notifications · '+visible.length+' unreviewed';}
    if(!notificationTray)return;
    positionNotifications();
    for(const button of notificationTray.querySelectorAll('[data-notification-recheck]'))button.disabled=Date.now()<notificationRetryAt;
    const sound=notificationTray.querySelector('[data-inbox-sound]');if(sound){sound.textContent=historySoundEnabled()?'Mute':'Unmute';sound.setAttribute('aria-pressed',String(historySoundEnabled()));}
    const fingerprint=JSON.stringify([id,items,[...dismissedNotifications]]);
    if(notificationTray.dataset.content===fingerprint)return;
    notificationTray.dataset.content=fingerprint;
    const list=notificationTray.querySelector('.spa-inbox-list'),scroll=list.scrollTop;
    list.innerHTML=visible.length?items.map((item,index)=>dismissedNotifications.has(notificationKey(id,item))?'':'<article><button type="button" data-dismiss="'+index+'" aria-label="Dismiss '+esc(item.title)+' for this visit" title="Reviewed, not fixed">×</button><strong>'+esc(item.title)+'</strong><p>'+esc(item.text)+'</p><small>'+String(item.evidence||'').split('\n').map(esc).join('<br>')+'</small><div class="spa-inbox-actions"><button type="button" data-notification-open="'+index+'">Details</button><button type="button" data-notification-recheck="'+index+'">Recheck</button></div></article>').join(''):'<p>No unreviewed notifications. Dismissed flags may still need action; this is not confirmation clearance.</p>';
    list.scrollTop=scroll;
    for(const button of notificationTray.querySelectorAll('[data-notification-recheck]'))button.disabled=Date.now()<notificationRetryAt;
    notificationTray.querySelector('[data-show-dismissed]').hidden=!dismissedNotifications.size;
  }
  function setupNotifications(header){
    const badge=document.createElement('button');badge.id='spa-notification-badge';badge.type='button';badge.setAttribute('aria-label','Notifications: 0 unreviewed flags');badge.setAttribute('aria-expanded','false');badge.textContent='✓';header.append(badge);
    document.getElementById(ID+'-notifications')?.remove();
    notificationTray=document.createElement('aside');notificationTray.id=ID+'-notifications';notificationTray.hidden=true;notificationTray.setAttribute('aria-label','Lead notifications');
    notificationTray.innerHTML='<div class="spa-inbox-head"><strong>Notifications</strong><button type="button" data-inbox-sound aria-label="Toggle alert sound">Unmute</button><button type="button" data-show-dismissed hidden>Show dismissed</button><button type="button" data-close-inbox aria-label="Close notifications">×</button></div><div class="spa-inbox-list" tabindex="0"></div>';
    document.body.append(notificationTray);
    const close=()=>{notificationTray.hidden=true;badge.setAttribute('aria-expanded','false');badge.focus();};
    badge.onclick=()=>{notificationTray.hidden=!notificationTray.hidden;updateNotifications(notificationItems);positionNotifications();if(!notificationTray.hidden)notificationTray.querySelector('[data-close-inbox]').focus();};
    notificationTray.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    notificationTray.onclick=e=>{
      if(e.target.closest('[data-close-inbox]')){close();return;}
      if(e.target.closest('[data-inbox-sound]')){panel.querySelector('#spa-sound-switch').click();updateNotifications(notificationItems);return;}
      if(e.target.closest('[data-show-dismissed]')){dismissedNotifications.clear();updateNotifications(notificationItems);return;}
      const dismiss=e.target.closest('[data-dismiss]'),open=e.target.closest('[data-notification-open]'),recheck=e.target.closest('[data-notification-recheck]');
      if(dismiss){const item=notificationItems[Number(dismiss.dataset.dismiss)];if(item){dismissedNotifications.add(notificationKey(lead.id,item));updateNotifications(notificationItems);notificationTray.querySelector('[data-close-inbox]').focus();}return;}
      if(open){const item=notificationItems[Number(open.dataset.notificationOpen)];if(!item)return;close();setPanelMode('full');const target=panel.querySelector('#'+item.target),section=target?.closest('details');if(section)section.open=true;target?.scrollIntoView({block:'nearest'});return;}
      if(recheck&&Date.now()>=notificationRetryAt){notificationRetryAt=Date.now()+30000;refreshHistory();retryFailedChecks();refreshWorkflow();}
    };
    window.addEventListener('resize',positionNotifications);
  }
  function workflowItems(history,mobileEvidence,route,isCanada,property){
    const items=[];
    const add=(kind,title,text,target,evidence)=>items.push({kind,title,text,target,evidence});
    if(mobileEvidence.length)add('warning','Mobile / manufactured home detected','Review the property source and applicable policy before proceeding. Conflicting sources need manual verification.','spa-extracted',mobileEvidence.join(' · '));
    if(history.notHomes.length>=2)add('warning','2+ Not Homes: leader review','Do not message-confirm. Contact Confirm Leaders in Cutting Edge before proceeding; review the notes and call the homeowner.','spa-history',history.notHomes.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.demoNoSales.length>=2&&history.notHomes.length)add('warning','Price-increase review','Check the same-project quote date. Over one year: price-increase conversation. Within one year: sales-rep/manager escalation. Unclear cases need a leader.','spa-history',history.demoNoSales.concat(history.notHomes).map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.demoNoSales.length>=2)add('warning','2+ Demo No Sales: speak with homeowner','Do not message-confirm. Establish whether this is the same project and when it was quoted.','spa-history',history.demoNoSales.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.noDemos.length)add('warning','No Demo: resolve prior issues','Read every No Demo result note and address the red flags with the homeowner before confirming.','spa-history',history.noDemos.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.notHomes.length===1)add('review','1 Not Home: check timing and source','Same/next day may qualify for message confirmation; 2+ days needs Reply C or live confirmation. Source/proxy restrictions still apply.','spa-history',history.notHomes.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.demoNoSales.length===1)add('review','Demo No Sale: check prior quote','Verify the project and actual quote date before confirming.','spa-history',history.demoNoSales.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.cancelledSales.length)add('review','Cancelled Sale: review reason','Review cancellation reason, current project status and leader guidance. This is not an appointment cancellation.','spa-history',history.cancelledSales.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(history.sales.length)add('review','Prior Sale: review project','Check the sold project and current status before discussing another appointment. A prior sale alone is not a disqualification.','spa-history',history.sales.map(r=>r.history+' · '+r.dateText).join('\n'));
    if(isCanada){
      if(!Number.isFinite(route?.km))add('unknown','Distance not verified','Wait for the lookup or use Verify in Maps. Missing results do not mean the lead is within territory.','spa-distance',route?.error?'Distance service returned no usable result.':'Distance lookup has no result yet.');
      else if(['postal','city','street'].includes(route.precision))add('unknown','Approximate distance: verify the house','This is an area estimate, not the house route. Verify before deciding the 150 km Central GTA cutoff.','spa-distance',route.km.toFixed(1)+' km · '+route.precision+' estimate');
      else if(route.km>147)add('review','Distance near / above Central cutoff','Verify the actual route and territory. The 150 km hard cutoff is Central GTA only; estimates may include tolls.','spa-distance',route.km.toFixed(1)+' km · '+(route.estimated?'estimated drive':'entered or Maps distance'));
    }
    if(property?.warning)add('review','Property details disagree','Open the source details and resolve the conflicting property descriptions.','spa-extracted',property.warning);
    else if(!property||/unavailable|checking|unverified/i.test(property.label||''))add('unknown','Property type not verified','A blocked or missing website result is not a property-type finding. Use the selected website check if needed.','spa-extracted',property?.label||'No matched listing result yet.');
    if(!history.loadedCount)add('unknown','History unavailable','Review the original history. No readable rows is not confirmation clearance.','spa-history','No readable appointment-history rows.');
    return items;
  }
  function historyReviewCopy(history){
    return ['Appointment history review',history.rows.length?history.rows.map(r=>r.history+' | '+r.dateText).join('\n'):'No matching outcomes in readable history; verify the original history.','Dates above are history-entry dates, not verified quote dates.','Guidance:',...historyGuidance(history),'Review original result notes. This summary does not authorize confirmation.'].join('\n');
  }
  function refreshWorkflow(){
    if(!panel||!lead)return;
    const main=panel.querySelector('main');if(!main)return;
    const history=readAppointmentHistory(),evidence=[];
    if(manufacturedType(lead.type))evidence.push('Enabled+ property field: '+lead.type);
    if(manufacturedType(listingType))evidence.push('Manually compared type: '+listingType);
    for(const r of matchedListings)if(manufacturedType(r.type+' '+r.style))evidence.push(r.source+': '+r.type+(r.style?' / '+r.style:''));
    const items=workflowItems(history,evidence,distances.get(distanceKey()),canadianLead(lead),lead.propertyCheck);
    const mapCheck=addressChecks.get(clean(panel.querySelector('#spa-address')?.value));
    if(mapCheck&&mapCheck.status!=='matched')items.push({kind:mapCheck.status==='not-found'?'review':'unknown',title:mapCheck.status==='not-found'?'Address needs review':'Maps address not verified',text:mapCheck.label+'. This does not establish that the address is invalid.',target:'spa-extracted',evidence:mapCheck.label});
    const dupes=panel.querySelector('#spa-dupes');
    if(dupes?.querySelector('a'))items.push({kind:'review',title:'Possible duplicate leads',text:'Compare the returned records before proceeding.',target:'spa-dupes',evidence:dupes.textContent});
    const unit=panel.querySelector('#spa-unit-warning');
    if(unit&&!unit.hidden)items.push({kind:'review',title:'Check whether a unit applies',text:'Condos and townhouses do not always require a unit number.',target:'spa-extracted',evidence:unit.textContent});
    updateNotifications(items);
    const key=JSON.stringify([lead.id,history.rows,items]);
    let box=panel.querySelector('#spa-workflow');if(!box){box=document.createElement('section');box.id='spa-workflow';const distanceSection=main.querySelector('#spa-distance')?.closest('section');if(distanceSection)distanceSection.after(box);else main.prepend(box);}
    updateSectionFlags(items);
    const reviewed=key===reviewedWorkflowKey,fingerprint=key+reviewed;
    if(box.dataset.fingerprint===fingerprint)return;
    const wasOpen=box.querySelector('details')?.open;box.dataset.fingerprint=fingerprint;
    const top=items[0],warnings=items.filter(i=>i.kind==='warning').length,unknowns=items.filter(i=>i.kind==='unknown').length;
    box.innerHTML='<div class="spa-section-body"><strong>Next action'+(top?' · '+esc(top.title):'')+'</strong><p>'+esc(top?.text||'No listed review flags. Continue the script and required checks; this is not automatic clearance.')+'</p><small>'+warnings+' warning(s) · '+items.filter(i=>i.kind==='review').length+' review(s) · '+unknowns+' unverified check(s)'+(reviewed?' · Reviewed this session':'')+'</small><details'+(wasOpen?' open':'')+'><summary>Review details ('+items.length+')</summary><div class="spa-history-scroll" tabindex="0" role="region" aria-label="Prioritized issues and evidence">'+items.map((item,i)=>'<div class="status" data-tone="'+(item.kind==='warning'?'red':'')+'"><strong>'+esc(item.kind==='unknown'?'NOT VERIFIED':item.kind==='warning'?'WARNING':'REVIEW')+': '+esc(item.title)+'</strong><p>'+esc(item.text)+'</p><details><summary>Why this is flagged</summary><p style="white-space:pre-line">'+esc(item.evidence)+'</p></details><button type="button" data-workflow-open="'+i+'">Open relevant details</button></div>').join('')+'</div></details><div class="row"><button type="button" data-workflow-copy>Copy history summary</button>'+(items.length?'<button type="button" data-workflow-review>'+ (reviewed?'Undo reviewed':'Mark these reviewed')+'</button>':'')+'</div><small>Reviewed does not clear a warning, mute sound, or approve confirmation. Refresh reminds you again.</small></div>';
    box.onclick=e=>{
      const open=e.target.closest?.('[data-workflow-open]');if(open){const item=items[Number(open.dataset.workflowOpen)];if(!item)return;const target=panel.querySelector('#'+item.target);const section=target?.closest('details');if(section)section.open=true;target?.scrollIntoView({block:'nearest'});}
      if(e.target.closest?.('[data-workflow-copy]'))copy(historyReviewCopy(readAppointmentHistory()));
      if(e.target.closest?.('[data-workflow-review]')){reviewedWorkflowKey=reviewed?'':key;refreshWorkflow();}
    };
  }
  function updateSectionFlags(items){
    const targets={distance:'spa-distance',history:'spa-history',property:'spa-extracted'};
    for(const section of panel.querySelectorAll('details.spa-section')){
      const key=section.dataset.section,related=items.filter(i=>i.target===targets[key]);
      let count=related.length,tone=related.some(i=>i.kind==='warning')?'red':'amber';
      if(key==='duplicates'){const box=panel.querySelector('#spa-dupes');count=box?.querySelectorAll('a[href*="Lead?L="]').length||0;if(!count&&/unavailable/i.test(box?.textContent||''))count=1;}
      if(key==='copy')count=['spa-name','spa-address'].filter(id=>!clean(panel.querySelector('#'+id)?.value)).length;
      const summary=section.querySelector(':scope > summary');if(!summary)continue;
      section.dataset.attention=count?tone:'';
      let tag=summary.querySelector('.spa-section-flag');
      if(count){if(!tag){tag=document.createElement('span');tag.className='spa-section-flag';summary.append(tag);}const text=(tone==='red'?'! ':'Review ')+count;if(tag.textContent!==text)tag.textContent=text;tag.title='Open this section to review flagged or unverified information';}
      else tag?.remove();
    }
  }
  function refreshCheckFreshness(){
    if(!panel||!lead)return;
    const route=distances.get(distanceKey());
    for(const [id,text] of [['spa-distance',route?.error?'Distance check unavailable':freshnessLabel(route?.readAt)],['spa-extracted',['Zillow','Redfin','Realtor.com'].map(source=>{const r=matchedListings.find(r=>r.source===source);return source+': '+freshnessLabel(r?.readAt);}).join(' · ')]]){
      const box=panel.querySelector('#'+id);if(!box)continue;
      let label=box.querySelector('.spa-freshness');if(!label){label=document.createElement('small');label.className='spa-freshness';box.append(label);}if(label.textContent!==text)label.textContent=text;
    }
  }
  function snapBubbleToEdge(){
    if(panel.dataset.bubble!=='true'||!savedValue('sixx-property-edge-snap-v1',false))return;
    const r=panel.getBoundingClientRect();if(r.left<40)panel.style.left='6px';else if(innerWidth-r.right<40)panel.style.left=Math.max(6,innerWidth-r.width-6)+'px';clamp();
  }
  function safeIssueReport(){
    // Deliberate allowlist: never copy lead text, IDs, URLs, names, addresses, or raw errors.
    return ['Property Assistant v0.7.29','Mode: '+(panel.dataset.bubble==='true'?'bubble':panel.dataset.mini==='true'?'compact':'full'),'Theme: '+(Object.hasOwn(THEMES,panel.dataset.theme)?panel.dataset.theme:'unknown'),'Panel size: '+Math.round(panel.getBoundingClientRect().width)+' x '+Math.round(panel.getBoundingClientRect().height),'Lead loaded: '+!!lead,'Distance result present: '+!!(lead&&Number.isFinite(distances.get(distanceKey())?.km)),'Property sources with results: '+['Zillow','Redfin','Realtor.com'].filter(source=>matchedListings.some(r=>r.source===source)).join(', '),'Startup issue count: '+startupIssues.size,'Please describe what happened (do not include customer information).'].join('\n');
  }
  function miniLabel(){const b=panel.querySelector('[data-action=mini]');b.textContent=panel.dataset.mini==='true'?'+':'−';b.title=panel.dataset.mini==='true'?'Restore':'Minimize';b.setAttribute('aria-label',b.title);}
  async function copy(value){try{await navigator.clipboard.writeText(value);notice('Copied.');}catch{notice('Clipboard unavailable. Select the preview text and copy manually.');}}
  function notice(text){panel.querySelector('#spa-notice').textContent=text;}
  function resetLayout(){panel.dataset.bubble='false';panel.dataset.mini='false';panel.dataset.w='320';panel.dataset.h='480';panel.dataset.cw='210';panel.dataset.ch='170';panel.style.width='320px';panel.style.height='480px';panel.style.left=Math.max(6,innerWidth-336)+'px';panel.style.top=Math.min(88,Math.max(6,innerHeight-492))+'px';miniLabel();clamp();save();notice('Layout reset. Your results are unchanged.');}
  function refreshRoute(){
    if(!panel||!lead||!canadianLead(lead))return;
    const field=panel.querySelector('#spa-km');if(!field)return;
    const address=panel.querySelector('#spa-address').value,saved=savedValue(ROUTES_KEY,[]);
    const r=Array.isArray(saved)?saved.filter(r=>routeRecordValid(r,address,Date.now())).sort((a,b)=>b.readAt-a.readAt)[0]:null;
    if(!r){if(distances.get(distanceKey())?.automatic){distances.delete(distanceKey());field.value='';field.dispatchEvent(new Event('input'));}return;}
    field.value=String(r.km);field.dispatchEvent(new Event('input'));
    distances.set(distanceKey(),{km:r.km,automatic:true,readAt:r.readAt});
    const box=panel.querySelector('#spa-distance');box.textContent+=' Read from selected Google Maps driving route, avoid tolls checked. '+r.route;
  }
  const estimateRequests=new Map();
  let lastGeocodeAt=0;
  function transientLookupFailure(message){return /timed out|unreachable|cancelled|(?:HTTP |returned )(?:408|500|502|503|504)\b/i.test(message);}
  function estimateJson(url){return new Promise((resolve,reject)=>{
    if(typeof GM_xmlhttpRequest!=='function'){reject(Error('Network permission unavailable'));return;}
    GM_xmlhttpRequest({method:'GET',url,anonymous:true,timeout:15000,headers:{Accept:'application/json'},
      onload:r=>{try{if(r.status<200||r.status>=300)throw Error('Distance service returned '+r.status);resolve(JSON.parse(r.responseText));}catch(e){reject(e);}},
      onerror:()=>reject(Error('Distance service unreachable')),ontimeout:()=>reject(Error('Distance service timed out')),onabort:()=>reject(Error('Distance request cancelled'))});
  });}
  async function automaticDistance(){
    if(!lead||!canadianLead(lead)||!panel)return;
    const address=clean(panel.querySelector('#spa-address')?.value),key=distanceKey(),leadId=lead.id;
    const box=panel.querySelector('#spa-distance');if(!box)return;
    if(!lead.street||!listingIdentity(address)||lead.uncertain){distances.set(key,{estimated:true,error:true});box.textContent='Distance unavailable: full physical address needs review.';updateHeader();return;}
    if(distances.get(key)&&!distances.get(key).estimated)return;
    const valid=()=>panel?.isConnected&&lead.id===leadId&&distanceKey()===key&&clean(panel.querySelector('#spa-address')?.value)===address;
    const cachedEstimate=estimateRequests.get(address);
    if(cachedEstimate?.failed&&(cachedEstimate.retryAt>Date.now()||!cachedEstimate.retryAt)){
      distances.set(key,{estimated:true,error:true});box.textContent='Distance unavailable.'+(cachedEstimate.retryAt?' Retrying automatically.':' See details or verify in Maps.');
      const detail=panel.querySelector('#spa-distance-details');if(detail)detail.textContent=cachedEstimate.error||'Previous lookup failed. Use Retry checks.';updateHeader();return;
    }
    const attempts=(cachedEstimate?.attempts||0)+(cachedEstimate?.failed?1:0);
    if(cachedEstimate?.failed&&cachedEstimate.retryAt<=Date.now())estimateRequests.delete(address);
    if(cachedEstimate&&Date.now()-cachedEstimate.started>=LISTING_TTL)estimateRequests.delete(address);
    if(!estimateRequests.has(address)){
      const job=(async()=>{
        const wait=Math.max(0,lastGeocodeAt+1100-Date.now());lastGeocodeAt=Date.now()+wait;
        if(wait)await new Promise(r=>setTimeout(r,wait));
        const places=await estimateJson('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ca&limit=5&q='+encodeURIComponent(address+', Canada'));
        // A first search hit can be a road or a neighbourhood, not the house.
        // Consider the bounded result set, but never route to a nonmatching hit.
        let match=distanceCandidate(places,address);
        if(!match){
          for(const fallback of distanceFallbackQueries(address)){
            if(!valid())throw Error('Lead changed');
            const pause=Math.max(0,lastGeocodeAt+1100-Date.now());lastGeocodeAt=Date.now()+pause;
            if(pause)await new Promise(r=>setTimeout(r,pause));
            const candidates=await estimateJson('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ca&limit=5&q='+encodeURIComponent(fallback.query));
            match=areaDistanceCandidate(candidates,fallback);if(match)break;
          }
        }
        const p=match?.place,lat=Number(p?.lat),lon=Number(p?.lon);
        if(!p||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<41||lat>84||lon< -141||lon> -52)throw Error('No usable address, postal-area or city location found. Verify in Maps.');
        // Area fallbacks are labelled approximations, never house verification or cutoff clearance.
        const route=await estimateJson('https://router.project-osrm.org/route/v1/driving/-79.6441,43.589;'+lon+','+lat+'?overview=false&steps=false');
        const metres=route?.routes?.[0]?.distance;
        if(route.code!=='Ok'||typeof metres!=='number'||!Number.isFinite(metres)||metres<0)throw Error('Driving route unavailable');
        return {km:metres/1000,precision:match.precision};
      })();
      estimateRequests.set(address,{promise:job,started:Date.now(),attempts:attempts||1});if(estimateRequests.size>50)estimateRequests.delete(estimateRequests.keys().next().value);
    }
    box.textContent='Calculating driving distance automatically…';
    try{
      const entry=estimateRequests.get(address),result=await entry.promise,km=result.km;if(!valid()||(distances.get(key)&&!distances.get(key).estimated))return;
      distances.set(key,{km,precision:result.precision,estimated:true,readAt:Date.now()});panel.querySelector('#spa-km').value=String(Math.round(km*10)/10);
      const approximate=result.precision!=='address';
      box.dataset.tone=!approximate&&gtaMarket(lead.region)&&km>150?'red':'';
      const area=result.precision==='postal'?'Postal-area':result.precision==='city'?'City-area':'Street';
      box.textContent=km.toFixed(1)+(approximate?' km · '+area+' estimate, NOT house distance.':' km · Estimated drive from Mississauga.');
      const detail=panel.querySelector('#spa-distance-details');if(detail)detail.textContent=approximate?area+' location only; actual house distance may differ substantially. Do not use this estimate to decide the 150 km cutoff. OpenStreetMap / OSRM; tolls may be included.':'OpenStreetMap / OSRM route. Toll avoidance is not verified.';updateHeader();
    }catch(e){const request=estimateRequests.get(address);if(request){request.failed=true;request.error=e.message;request.retryAt=transientLookupFailure(e.message)&&request.attempts<3?Date.now()+30000*request.attempts:0;}
      if(valid()){distances.set(key,{estimated:true,error:true});box.textContent='Distance unavailable.'+(request?.retryAt?' Retrying automatically.':' See details or verify in Maps.');const detail=panel.querySelector('#spa-distance-details');if(detail)detail.textContent=e.message;updateHeader();}}
  }
  const housingChecks=new Map();
  function housingHtml(url){return new Promise((resolve,reject)=>{
    if(typeof GM_xmlhttpRequest!=='function'){reject(Error('Network permission unavailable'));return;}
    GM_xmlhttpRequest({method:'GET',url,anonymous:true,timeout:18000,onload:r=>{try{
      if(r.status!==200){reject(Error('Unavailable (HTTP '+r.status+')'));return;}
      const doc=new DOMParser().parseFromString(r.responseText,'text/html');
      const visible=doc.body?.cloneNode(true);visible?.querySelectorAll('script,style,noscript').forEach(n=>n.remove());
      const title=clean(doc.title),body=clean(visible?.textContent).slice(0,2000);
      if(/captcha|verify you are human|access denied|unusual traffic|pardon our interruption|enable javascript|turn on javascript/i.test(title+' '+body)||/\/sorry\//.test(r.finalUrl||'')){reject(Error('Site blocked automated access; no automatic result available'));return;}
      resolve({doc,url:r.finalUrl||url});
    }catch{reject(Error('Returned page could not be read'));}},onerror:()=>reject(Error('Request blocked or unavailable')),ontimeout:()=>reject(Error('Request timed out')),onabort:()=>reject(Error('Request cancelled'))});
  });}
  function housingCandidates(doc,source,address=''){
    const found=[];
    for(const a of doc.querySelectorAll('a[href]')){
      try{let u=new URL(a.getAttribute('href'),'https://www.google.com');if(u.hostname==='www.google.com'&&u.pathname==='/url')u=new URL(u.searchParams.get('q')||u.searchParams.get('url'));
        if(['zillow.com','redfin.com','redfin.ca','realtor.com'].includes(u.hostname))u.hostname='www.'+u.hostname;
        if(u.username||u.password)continue;
        if(listingSource(u.href)===source){u.hash='';u.search='';if(!found.some(r=>r.url===u.href)){const words=normAddress(address.split(',')[0]).split(' ').filter(Boolean);const haystack=normAddress((a.textContent||'')+' '+decodeURIComponent(u.pathname).replace(/-/g,' '));found.push({url:u.href,score:words.filter(w=>haystack.split(/\s+/).includes(w)).length});}}
      }catch{}
    }return found.sort((a,b)=>b.score-a.score).slice(0,3).map(r=>r.url);
  }
  function housingCandidate(doc,source,address=''){return housingCandidates(doc,source,address)[0]||'';}
  function housingFacts(doc,url,address){
    const source=listingSource(url);if(!source)return null;
    const heading=doc.querySelector('h1')?.textContent||'';
    let result;
    if(source==='Redfin')result=parseRedfinFacts(heading,[...doc.querySelectorAll('#house-info .keyDetails-row')].map(n=>n.textContent),[...doc.querySelectorAll('li')].map(n=>clean(n.textContent)),url,Date.now());
    if(source==='Zillow')result=parseVisibleListing(heading,[...doc.querySelectorAll('[aria-label="At a glance facts"] [role="listitem"]')].map(n=>n.textContent),[],url,Date.now());
    if(source==='Realtor.com')result=parseVisibleListing(heading,[...doc.querySelectorAll('main dt,main span,main p')].filter(n=>!n.children.length&&/^Property type\s*:?$/i.test(clean(n.textContent))).map(n=>n.nextElementSibling?.textContent||''),[],url,Date.now());
    if(usableListing(result,address,Date.now()))return result;
    const structured=[];for(const node of doc.querySelectorAll('script[type="application/ld+json"]')){try{structured.push(JSON.parse(node.textContent));}catch{}}
    return structuredHousing(structured,url,address,Date.now());
  }
  // Made by Montana. Maps failures are not proof that an address is wrong.
  function mapsAddressResult(text,addresses,address){
    if(/captcha|unusual traffic|access denied|enable javascript|consent\.google/i.test(text))return {status:'unavailable',label:'Google Maps unavailable · verify address manually'};
    if(/(?:couldn[’']?t|cannot|can[’']?t) find|no results found|no matching results/i.test(text))return {status:'not-found',label:'No Google Maps match · check address spelling and unit'};
    if(addresses.some(a=>listingIdentity(a)&&listingIdentity(a)===listingIdentity(address)))return {status:'matched',label:'Google Maps address matched'};
    return {status:'unavailable',label:'Google Maps address not verified · use Verify address'};
  }
  const addressChecks=new Map();
  function showAddressCheck(){
    const box=panel?.querySelector('#spa-address-status');if(!box||!lead)return;
    const result=addressChecks.get(clean(panel.querySelector('#spa-address')?.value));
    box.textContent=result?.label||'Google Maps address not checked';
    box.dataset.tone=result?.status==='matched'?'green':'';
  }
  async function automaticAddressCheck(){
    if(!lead||!panel)return;
    const address=clean(panel.querySelector('#spa-address')?.value),id=lead.id;
    if(!address)return;
    const old=addressChecks.get(address);
    if(old&&Date.now()-old.readAt<LISTING_TTL){showAddressCheck();return;}
    const valid=()=>panel?.isConnected&&lead?.id===id&&clean(panel.querySelector('#spa-address')?.value)===address;
    addressChecks.set(address,{status:'checking',label:'Checking Google Maps address…',readAt:Date.now()});showAddressCheck();
    try{
      if(lead.uncertain||!lead.street)throw Error('Physical address needs review');
      const page=await housingHtml(searchUrl('maps',address));
      if(!valid()){addressChecks.delete(address);return;}
      const url=new URL(page.url);
      if(url.hostname!=='www.google.com'||!url.pathname.startsWith('/maps'))throw Error('Maps redirected');
      const body=page.doc.body?.cloneNode(true);body?.querySelectorAll('script,style,noscript').forEach(n=>n.remove());
      const candidates=[...page.doc.querySelectorAll('[data-item-id="address"],[itemprop="streetAddress"]')].map(n=>clean(n.textContent).replace(/^Address:\s*/i,''));
      addressChecks.set(address,{...mapsAddressResult(clean(body?.textContent),candidates,address),readAt:Date.now()});
    }catch{
      if(!valid()){addressChecks.delete(address);return;}
      addressChecks.set(address,{status:'unavailable',label:'Google Maps unavailable · verify address manually',readAt:Date.now()});
    }
    if(addressChecks.size>50)addressChecks.delete(addressChecks.keys().next().value);
    if(valid()){showAddressCheck();refreshWorkflow();}
  }
  function retryFailedChecks(){
    if(!lead||!panel)return;
    const address=clean(panel.querySelector('#spa-address')?.value);
    const map=addressChecks.get(address);
    if(map?.status!=='matched'&&map?.status!=='checking'){addressChecks.delete(address);automaticAddressCheck();}
    const route=distances.get(distanceKey()),request=estimateRequests.get(address);
    if(canadianLead(lead)&&!Number.isFinite(route?.km)&&(!request||request.failed)){estimateRequests.delete(address);automaticDistance();}
    const housing=housingChecks.get(address);
    if(!housing||!Object.values(housing.statuses).some(s=>s==='Checking'||s==='Queued')){housingChecks.delete(address);automaticHousing(false);}
    if(/unavailable/i.test(panel.querySelector('#spa-dupes')?.textContent||''))duplicateCheck().catch(()=>notice('Duplicate lookup unavailable.'));
  }
  async function automaticHousing(allowTabs=true){
    if(!lead||!panel)return;
    const address=clean(panel.querySelector('#spa-address')?.value);
    if(!lead.street||!listingIdentity(address)||lead.uncertain)return;
    // Start the selected opt-in search immediately, even when background results are cached.
    // Do not wait for up to six sequential remote requests before opening the user's chosen site.
    if(allowTabs)openPropertyTabs(false);
    const currentLeadId=lead.id,valid=()=>panel?.isConnected&&lead?.id===currentLeadId&&clean(panel.querySelector('#spa-address')?.value)===address;
    const existing=housingChecks.get(address),retryDue=existing?.retryAt&&existing.retryAt<=Date.now();
    if(existing&&!retryDue&&Date.now()-existing.started<LISTING_TTL)return;
    const state=retryDue?{...existing,started:Date.now(),attempts:existing.attempts+1,retryAt:0}:{started:Date.now(),attempts:1,retryAt:0,statuses:{Zillow:'Queued',Redfin:'Queued','Realtor.com':'Queued'}};housingChecks.set(address,state);
    if(housingChecks.size>30)housingChecks.delete(housingChecks.keys().next().value);
    for(const [key,source] of [['zillow','Zillow'],['redfin','Redfin'],['realtor','Realtor.com']]){
      if(sourceResults(savedValue(LISTINGS_KEY,[]),address,Date.now()).some(s=>s.source===source&&s.result)){state.statuses[source]='Matched';continue;}
      if(retryDue&&!transientLookupFailure(state.statuses[source]))continue;
      if(clean(panel.querySelector('#spa-address')?.value)!==address)return;
      state.statuses[source]='Checking';refreshListing();
      try{
        const search=await housingHtml(searchUrl(key,address));
        if(!valid()){if(housingChecks.get(address)===state)housingChecks.delete(address);return;}
        if(new URL(search.url).hostname!=='www.google.com')throw Error('Search redirected; manual check needed');
        let candidates=housingCandidates(search.doc,source,address);
        if(!candidates.length){
          const broad=await housingHtml('https://www.google.com/search?q='+encodeURIComponent(address+' '+source));
          if(!valid()){if(housingChecks.get(address)===state)housingChecks.delete(address);return;}
          if(new URL(broad.url).hostname!=='www.google.com')throw Error('Search redirected; manual check needed');
          candidates=housingCandidates(broad.doc,source,address);
        }
        if(!candidates.length)throw Error('Automated search found no readable listing link; a listing may still exist. Try Search address.');
        let result=null,mismatch=false;
        for(const candidate of candidates){
          const page=await housingHtml(candidate);
          if(!valid()){if(housingChecks.get(address)===state)housingChecks.delete(address);return;}
          if(listingSource(page.url)!==source)continue;
          result=housingFacts(page.doc,page.url,address);if(result)break;
          mismatch=mismatch||listingAddressMismatch(address,page.doc.querySelector('h1')?.textContent||'');
        }
        if(!result)throw Error(mismatch?'Address mismatch: returned listings did not verify this address. Review manually.':'Listing links found, but address/property type could not be read. Review manually.');
        const old=savedValue(LISTINGS_KEY,[]);if(!saveValue(LISTINGS_KEY,[result,...(Array.isArray(old)?old.filter(r=>r&&!(r.identity===result.identity&&r.source===source)&&Date.now()-r.readAt<LISTING_TTL):[])].slice(0,30)))throw Error('Could not save listing result');
        state.statuses[source]='Matched';
      }catch(e){state.statuses[source]=e.message;}
      if(clean(panel.querySelector('#spa-address')?.value)===address)refreshListing();
    }
    if(state.attempts<3&&Object.values(state.statuses).some(transientLookupFailure))state.retryAt=Date.now()+30000*state.attempts;
    if(allowTabs&&valid())openPropertyTabs(false);
  }
  function resumeAutomaticChecks(){
    if(!panel||!lead||document.hidden)return;
    const address=clean(panel.querySelector('#spa-address')?.value),now=Date.now();
    const distance=estimateRequests.get(address),housing=housingChecks.get(address);
    if(distance?.retryAt&&distance.retryAt<=now)automaticDistance();
    if(housing?.retryAt&&housing.retryAt<=now)automaticHousing();
  }
  function housingStatus(address){const state=housingChecks.get(address);return state?'<small>'+esc(Object.entries(state.statuses).map(([site,status])=>site+': '+status).join(' · '))+'<br>'+esc('Check started '+new Date(state.started).toLocaleTimeString())+'</small>':'';}
  function refreshListing(){
    if(!panel||!lead)return;
    const box=panel.querySelector('#spa-extracted');if(!box)return;
    const address=panel.querySelector('#spa-address')?.value||lead.address;
    const saved=savedValue(LISTINGS_KEY,[]);
    const sources=sourceResults(saved,address,Date.now());matchedListings=sources.map(s=>s.result).filter(Boolean);matchedListing=matchedListings[0]||null;
    lead.listingTypes=matchedListings.map(r=>r.type);
    const summary=propertyCheckSummary(matchedListings,housingChecks.get(clean(address)));
    lead.propertyCheck=summary;
    const conflict=matchedListings.some((a,i)=>matchedListings.slice(i+1).some(b=>propertyLabel(a.type).toLowerCase()!==propertyLabel(b.type).toLowerCase()));
    box.dataset.tone=matchedListings.some(r=>manufacturedType(r.type+' '+r.style))?'red':'';
    if(!matchedListings.length){box.innerHTML='<strong>'+esc(summary.label)+'</strong><details><summary>Check details</summary>'+housingStatus(address)+'</details>';updateHeader();return;}
    const types=[...new Set(matchedListings.map(r=>propertyLabel(r.type)))],developments=[...new Set(matchedListings.map(r=>r.development).filter(Boolean))];
    box.innerHTML=`<strong>${esc(summary.label)}</strong><small>${esc(matchedListings.map(r=>r.source+': '+r.type).join(' · '))}</small>${conflict?'<p>Website labels differ. Review before relying on this result.</p>':`<small>${esc(typeComparison(lead.type,types[0]).text)}</small>`}${developments.length?`<p>${esc(developments.join(' · '))}</p>`:''}<details><summary>Source details</summary>${matchedListings.map(r=>`<p><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.source)}</a> · ${esc(new Date(r.readAt).toLocaleTimeString())}</p>`).join('')}<small>Street/unit and postal code matched. Check the city too. Unavailable sources do not prove a property is not a condo. Results expire after 15 minutes.</small></details>`;updateHeader();
  }
  function updateHeader(){const facts=panel.querySelector('#spa-extracted');if(facts&&matchedListings.length){let status=facts.querySelector('.housing-status');if(!status){status=document.createElement('div');status.className='housing-status';(facts.querySelector('details')||facts).append(status);}status.innerHTML=housingStatus(panel.querySelector('#spa-address')?.value||lead.address);}const s=headerSummary(lead,distances.get(distanceKey()));panel.querySelector('#spa-title').textContent=s.title;panel.querySelector('#spa-subtitle').textContent=s.detail;panel.dataset.over=String(s.over);const stop=panel.querySelector('#spa-stop');stop.hidden=!(manufacturedType(lead.type)||manufacturedType(listingType)||matchedListings.some(r=>manufacturedType(r.type+' '+r.style)));stop.textContent=stop.hidden?'':"CAN'T DO WORK · Manufactured/mobile";stop.style.display=stop.hidden?'none':'block';
    let checkBadge=panel.querySelector('#spa-check-badge');if(!checkBadge){checkBadge=document.createElement('small');checkBadge.id='spa-check-badge';panel.querySelector('.spa-heading').append(checkBadge);}
    checkBadge.textContent=lead.propertyCheck?.warning||(!canadianLead(lead)?lead.propertyCheck?.label:'')||'';checkBadge.hidden=!checkBadge.textContent;
    const warning=unitWarning(panel.querySelector('#spa-address')?.value||lead.address,lead.type,listingType,matchedListings.map(r=>r.type).join(' / '),lead.condoHint);
    const acknowledged=unitAcknowledgments.has(unitReviewKey());warning.show=warning.show&&!acknowledged;
    const badge=panel.querySelector('#spa-unit-badge');badge.hidden=!warning.show;badge.textContent=warning.show?'Check unit number':'';
    const detail=panel.querySelector('#spa-unit-warning');if(detail){detail.hidden=!warning.show;detail.textContent=warning.show?'Check whether a unit applies. Not all condos or townhouses need one.':'';}
    const unitButton=panel.querySelector('#spa-unit-reviewed');if(unitButton){unitButton.hidden=!(warning.show||acknowledged);unitButton.textContent=acknowledged?'No unit applies · Undo':'Checked: no unit applies';}
  }
  // Made by Montana. Preserve creator credit when reviewing this interface.
  function startPanel(){styles();panel=document.createElement('aside');panel.id=ID;panel.setAttribute('aria-label','Property Assistant test panel');panel.innerHTML='<header><div class="spa-heading"><small id="spa-version">TEST · v0.7.29</small><div id="spa-compact" aria-live="polite"></div><strong id="spa-title">Property Assistant · TEST</strong><small id="spa-subtitle"></small><span id="spa-stop" class="spa-stop" style="display:none"></span></div><button data-action="mini" aria-label="Minimize">−</button></header><main></main><footer><span id="spa-notice" role="status" aria-live="polite">TEST · No company records changed.</span><button id="spa-reset-layout" title="Restore default window position and size">Reset layout</button><small id="spa-credit" style="flex-basis:100%" title="Made by Montana. Authorized internal review and testing only. No reproduction, redistribution, republication, or removal of attribution without Montana’s prior written consent. Unofficial tool.">Made by Montana</small></footer>';document.body.append(panel);restore();panel.querySelector('#spa-reset-layout').onclick=resetLayout;
    const unitBadge=document.createElement('small');unitBadge.id='spa-unit-badge';unitBadge.hidden=true;panel.querySelector('.spa-heading').append(unitBadge);
    const audioControls=document.createElement('div');audioControls.className='spa-audio-settings';audioControls.innerHTML='<button type="button" id="spa-history-sound">Enable sound</button><button type="button" id="spa-history-ack" hidden>Acknowledge</button><small id="spa-audio-status" role="status"></small>';panel.querySelector('footer').append(audioControls);
    panel.querySelector('#spa-audio-status').onclick=unlockHistorySound;
    panel.querySelector('#spa-history-sound').onclick=()=>{const enabled=!historySoundEnabled();if(!saveValue(HISTORY_SOUND_KEY,enabled)){notice('Could not save sound preference.');return;}updateHistorySound();if(enabled)unlockHistorySound();};
    panel.querySelector('#spa-history-ack').onclick=()=>{historyAcknowledged=historyAlarmKey;updateHistorySound();};updateHistorySound();
    const themeSelect=document.createElement('select');themeSelect.id='spa-theme';themeSelect.setAttribute('aria-label','Color theme');
    const themeGroups=new Map();
    function favoriteThemes(){const value=savedValue('sixx-property-favorite-themes-v1',[]);return Array.isArray(value)?[...new Set(value.filter(key=>Object.hasOwn(THEMES,key)))]:[];}
    function rebuildThemes(){
    const current=panel.dataset.theme||savedValue(THEME_KEY,'destiny'),favorites=favoriteThemes();themeSelect.replaceChildren();themeGroups.clear();
    for(const [value,theme] of Object.entries(THEMES).sort(([a],[b])=>Number(favorites.includes(b))-Number(favorites.includes(a)))){const groupName=favorites.includes(value)?'Favorites':theme.group||'Original themes';if(!themeGroups.has(groupName)){const group=document.createElement('optgroup');group.label=groupName;themeGroups.set(groupName,group);themeSelect.append(group);}const option=document.createElement('option');option.value=value;option.textContent=theme.label;themeGroups.get(groupName).append(option);}
    themeSelect.value=current;
    }
    rebuildThemes();
    panel.querySelector('footer').prepend(themeSelect);applyTheme(savedValue(THEME_KEY,'destiny'));
    themeSelect.onchange=()=>{applyTheme(themeSelect.value);if(!saveValue(THEME_KEY,themeSelect.value))notice('Theme changed; could not save preference.');};
    const settings=document.createElement('details');settings.id='spa-settings';
    applyDisplayPreferences();
    const settingsTitle=document.createElement('summary');settingsTitle.textContent='⚙ Settings';settingsTitle.setAttribute('aria-label','Settings: appearance, minimized details, motion, sound and layout');settings.append(settingsTitle);
    const settingsBody=document.createElement('div');settingsBody.className='spa-settings-body';settings.append(settingsBody);
    const themeLabel=document.createElement('label');themeLabel.textContent='Color theme';themeLabel.append(themeSelect);settingsBody.append(themeLabel,audioControls,panel.querySelector('#spa-reset-layout'));
    function saveDisplay(key,value){
      const prefs=displayPreferences(savedValue('sixx-property-display-v1',{}));prefs[key]=value;
      if(!saveValue('sixx-property-display-v1',prefs)){notice('Could not save display preference.');return;}
      applyDisplayPreferences();updateQuickBubble();clamp();
    }
    const appearance=document.createElement('fieldset');appearance.className='spa-preferences';
    const legend=document.createElement('legend');legend.textContent='Display & accessibility';appearance.append(legend);
    for(const [key,label,options] of [['density','Spacing & text',[['compact','Compact spacing'],['comfortable','Comfortable'],['large','Large text']]],['motion','Notifications',[['pulse','Pulsing dots'],['steady','Steady dots (no animation)']]]]){
      const labelNode=document.createElement('label');labelNode.textContent=label;
      const select=document.createElement('select');select.id='spa-pref-'+key;
      for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
      select.value=displayPreferences(savedValue('sixx-property-display-v1',{}))[key];select.onchange=()=>saveDisplay(key,select.value);
      labelNode.append(select);appearance.append(labelNode);
    }
    const minimized=document.createElement('fieldset');minimized.className='spa-preferences';
    const miniLegend=document.createElement('legend');miniLegend.textContent='Compact view details';minimized.append(miniLegend);
    for(const [key,label] of [['distance','Canadian distance'],['history','History count'],['property','Property type']]){
      const labelNode=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id='spa-pref-'+key;
      input.checked=displayPreferences(savedValue('sixx-property-display-v1',{}))[key];input.onchange=()=>saveDisplay(key,input.checked);
      labelNode.append(input,document.createTextNode(' '+label));minimized.append(labelNode);
    }
    const help=document.createElement('small');help.textContent='Important warnings always remain visible. Each main section remembers whether you leave it open or closed.';minimized.append(help);
    settingsBody.append(appearance,minimized);
    const resetAppearance=document.createElement('button');resetAppearance.textContent='Reset appearance';
    resetAppearance.title='Reset theme, size and position only. Other preferences and results stay unchanged.';
    resetAppearance.onclick=()=>{applyTheme('destiny');saveValue(THEME_KEY,'destiny');resetLayout();notice('Appearance reset. Other preferences and results kept.');};settingsBody.append(resetAppearance);
    const artworkLabel=document.createElement('label'),artworkInput=document.createElement('input');artworkInput.type='checkbox';artworkInput.checked=displayPreferences(savedValue('sixx-property-display-v1',{})).artwork;
    artworkInput.onchange=()=>saveDisplay('artwork',artworkInput.checked);artworkLabel.append(artworkInput,document.createTextNode(' Show theme artwork'));appearance.append(artworkLabel);
    const favorite=document.createElement('button');favorite.textContent='☆ Toggle favorite for current theme';favorite.title='Add or remove the selected theme from Favorites at the top of the theme list.';
    favorite.onclick=()=>{const key=panel.dataset.theme,list=favoriteThemes();if(!saveValue('sixx-property-favorite-themes-v1',list.includes(key)?list.filter(v=>v!==key):[...list,key])){notice('Could not save favorites.');return;}rebuildThemes();notice(THEMES[key].label+(favoriteThemes().includes(key)?' added to favorites.':' removed from favorites.'));};
    const gallery=document.createElement('details'),galleryTitle=document.createElement('summary'),swatches=document.createElement('div');galleryTitle.textContent='Preview all themes';gallery.append(galleryTitle,swatches);swatches.className='spa-theme-previews';
    for(const [key,t] of Object.entries(THEMES)){
      const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Use '+t.label+' theme');button.style.background=t.bg;button.style.color=t.text;button.style.borderColor=t.border;
      const colors=document.createElement('span');colors.className='spa-theme-swatches';colors.setAttribute('aria-hidden','true');
      for(const color of [t.bg,t.surface,t.accent,t.pink]){const dot=document.createElement('i');dot.style.background=color;colors.append(dot);}
      button.append(colors,document.createTextNode(t.label));button.onclick=()=>{applyTheme(key);saveValue(THEME_KEY,key);};swatches.append(button);
    }
    themeLabel.after(favorite,gallery);
    const guide=document.createElement('details'),guideTitle=document.createElement('summary'),guideText=document.createElement('p');guideTitle.textContent='Version & update help';guideText.textContent='TEST v0.7.29 · Made by Montana. Install the new test script, disable older Property Assistant copies, then refresh your lead tabs. Keep the separate historic tool if you use it. Check marks mean a matching property type was read, not permission to confirm. Red X: mobile/manufactured; amber: review needed. External checks can be unavailable. No company records are changed.';guide.append(guideTitle,guideText);settingsBody.append(guide);
    const snapLabel=document.createElement('label'),snapInput=document.createElement('input');snapInput.type='checkbox';snapInput.checked=savedValue('sixx-property-edge-snap-v1',false)===true;snapInput.onchange=()=>{if(!saveValue('sixx-property-edge-snap-v1',snapInput.checked))notice('Could not save edge snapping preference.');};snapLabel.append(snapInput,document.createTextNode(' Snap bubble near screen edges'));settingsBody.append(snapLabel);
    const report=document.createElement('button');report.textContent='Copy issue report';report.title='Copies tool diagnostics only. No homeowner information.';report.onclick=()=>copy(safeIssueReport());settingsBody.append(report);panel.querySelector('footer').prepend(settings);
    const soundBar=document.createElement('div');soundBar.id='spa-sound-bar';
    soundBar.innerHTML='<span id="spa-sound-label">Muted</span><button id="spa-sound-switch" type="button" role="switch" aria-label="Alert sound" aria-checked="false"><span aria-hidden="true">🔇</span><i aria-hidden="true"></i><span aria-hidden="true">🔊</span></button>';
    panel.append(soundBar);soundBar.querySelector('button').onclick=()=>panel.querySelector('#spa-history-sound').click();updateHistorySound();
    const header=panel.querySelector('header');
    setupNotifications(header);
    const settingsShortcut=document.createElement('button');settingsShortcut.textContent='⚙';settingsShortcut.title='Settings';settingsShortcut.setAttribute('aria-label','Open settings');
    settingsShortcut.onclick=()=>{setPanelMode('full');settings.open=!settings.open;if(settings.open)settingsTitle.focus();};header.append(settingsShortcut);
    header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button,a'))return;const r=panel.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;header.setPointerCapture(e.pointerId);header.onpointermove=m=>{panel.style.left=m.clientX-x+'px';panel.style.top=m.clientY-y+'px';panel.style.right='auto';clamp();};header.onpointerup=header.onpointercancel=()=>{header.onpointermove=null;save();};};
    panel.querySelector('[data-action=mini]').onclick=()=>setPanelMode(panel.dataset.mini==='true'?'full':'compact');
    const bubbleShortcut=document.createElement('button');bubbleShortcut.textContent='○';bubbleShortcut.title='Bubble mode';bubbleShortcut.setAttribute('aria-label','Bubble mode');bubbleShortcut.onclick=()=>setPanelMode('bubble');header.append(bubbleShortcut);
    const quick=document.createElement('button');quick.id='spa-quick-bubble';panel.append(quick);
    let dragged=false;
    quick.onpointerdown=e=>{if(e.button!==0)return;dragged=false;const r=panel.getBoundingClientRect(),x=e.clientX,y=e.clientY;quick.setPointerCapture(e.pointerId);quick.onpointermove=m=>{if(Math.hypot(m.clientX-x,m.clientY-y)>4)dragged=true;if(!dragged)return;panel.style.left=r.left+m.clientX-x+'px';panel.style.top=r.top+m.clientY-y+'px';panel.style.right='auto';clamp();};quick.onpointerup=quick.onpointercancel=()=>{quick.onpointermove=null;snapBubbleToEdge();save();};};
    quick.onclick=()=>{if(dragged){dragged=false;return;}const target=quick.dataset.target;setPanelMode('full');const item=panel.querySelector('#'+target);const section=item?.closest('details');if(section)section.open=true;item?.scrollIntoView({block:'nearest'});};
    updateQuickBubble();const quickTimer=setInterval(()=>{if(!quick.isConnected){clearInterval(quickTimer);return;}updateQuickBubble();refreshCheckFreshness();refreshWorkflow();},1500);
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{clamp();save();},220);}).observe(panel);
    else {panel.addEventListener('pointerup',()=>{clamp();save();});startupIssues.add('Resize observer unavailable');}
    window.addEventListener('storage',e=>{if(e.key===KEY){windowSync=true;restore();setTimeout(()=>windowSync=false,500);}});
    window.addEventListener('resize',()=>{clamp();save();});
  }
  function setupSections(main){
    let preferences={};try{preferences=JSON.parse(localStorage.getItem('sixx-property-sections-v1')||'{}')||{};}catch{}
    const definitions=[['distance','spa-distance'],['history','spa-history'],['duplicates','spa-dupes'],['property','spa-extracted'],['copy','spa-name']];
    for(const [key,id] of definitions){
      const section=main.querySelector('#'+id)?.closest('section');if(!section)continue;
      const title=section.querySelector(':scope > strong');if(!title)continue;
      const details=document.createElement('details');details.className='spa-section';details.dataset.section=key;
      details.open=preferences[key]!==false;
      const summary=document.createElement('summary');summary.textContent=title.textContent;
      const body=document.createElement('div');body.className='spa-section-body';title.remove();
      while(section.firstChild)body.append(section.firstChild);
      details.append(summary,body);section.append(details);
      details.addEventListener('toggle',()=>{try{const saved=JSON.parse(localStorage.getItem('sixx-property-sections-v1')||'{}')||{};saved[key]=details.open;localStorage.setItem('sixx-property-sections-v1',JSON.stringify(saved));}catch{}});
      main.append(section);
    }
  }
  function renderLead(){const previousDistance=distances.get(distanceKey());const main=panel.querySelector('main');main.innerHTML=`
    <section><strong>Copy details</strong><input id="spa-name" type="hidden" value="${esc(titleCase(lead.name))}"><label>Homeowner first name<input id="spa-first-name" value="${esc((lead.nameParts||homeownerParts(lead.name)).first)}"></label><label>Homeowner last name<input id="spa-last-name" value="${esc((lead.nameParts||homeownerParts(lead.name)).last)}"></label><small>${(lead.nameParts||homeownerParts(lead.name)).inferred?'Name split inferred. Check compound surnames or multiple homeowners before copying.':'Name fields read from the lead. Check spelling before copying.'}</small><div class="row"><button id="spa-copy-first">Copy first name</button><button id="spa-copy-last">Copy last name</button></div><label>Address<textarea id="spa-address">${esc(titleCase(lead.address,true))}</textarea></label><small>Check spelling before copying.</small>
    ${lead.routing?`<p class="status">Routing ZIP instructions found. ${lead.uncertain?'Physical ZIP needs review before lookup/copy.':'Physical ZIP used in preview; original lead unchanged.'}</p>`:''}
    <div class="row"><button id="spa-copy-name">Copy name</button><button id="spa-copy-address">Copy address</button><button id="spa-copy-both">Copy both</button></div><label>Design consultant<input id="spa-consultant" value="${esc(titleCase(lead.consultant))}" placeholder="Not detected; verify assignment"></label><div class="row"><button id="spa-copy-consultant">Copy consultant</button><button id="spa-copy-contract">Copy all three</button></div></section>
    <section><strong>Appointment history &amp; warnings</strong><div id="spa-history" aria-live="polite">Reading history…</div></section>
    <section><strong>Duplicate leads</strong><div id="spa-dupes" class="status">Waiting to check…</div><button id="spa-recheck">Recheck</button></section>
    <section><strong>Property details</strong><div id="spa-extracted" class="status">Checking saved listing details…</div><div class="row"><select id="spa-source" aria-label="Verification source"><option value="zillow">Zillow</option><option value="redfin">Redfin</option><option value="realtor">Realtor.com</option><option value="maps">Google Maps</option></select><button id="spa-verify">Search address</button></div><div id="spa-unit-warning" class="status" role="status" hidden></div><button id="spa-unit-reviewed" hidden>Checked: no unit applies</button>
    <details><summary>Compare a listing</summary><p>Enabled+ type: ${esc(lead.type||'Not detected')}</p><label>Address copied from listing<input id="spa-listing-address" placeholder="Full address including unit and postal code"></label><label>Property type shown<select id="spa-listing-type"><option value="">Not checked / unavailable</option>Single family</option>Townhouse</option>Condo</option>Multifamily</option>Manufactured / mobile</option>Other</option></select></label><div id="spa-comparison" class="status">Manual comparison, not automatically verified.</div></details></section>
    ${canadianLead(lead)?`<section><strong>Canada distance</strong><div id="spa-distance" class="status">Calculating automatically…</div><button id="spa-route">Verify in Maps</button><details><summary>Distance settings &amp; details</summary><label>Verified distance (km)<input id="spa-km" type="number" min="0" step="0.1" placeholder="Automatic"></label><p>Estimate from central Mississauga. Maps uses L5N 2X5 with avoid tolls; results may differ. The 150 km cutoff applies to Central GTA only, not Eastern GTA or other markets.</p><div id="spa-distance-details"></div></details></section>`:''}`;
    const get=id=>panel.querySelector('#'+id);
    const syncName=()=>{get('spa-name').value=clean(get('spa-first-name').value+' '+get('spa-last-name').value);};
    for(const part of ['first','last']){get('spa-'+part+'-name').oninput=syncName;get('spa-copy-'+part).onclick=()=>{const value=titleCase(get('spa-'+part+'-name').value);if(!value){notice('Check the homeowner '+part+' name before copying.');return;}copy(value);};}
    syncName();
    const tabs=document.createElement('div');tabs.innerHTML='<label class="spa-tab-toggle"><input id="spa-auto-tabs" type="checkbox"> Auto-open selected site only</label><small>Uses the dropdown below. One tab per check, with this address. Shares the address with Google and the selected site.</small><button id="spa-open-tabs" type="button">Open selected check</button><small id="spa-tabs-status" role="status"></small>';
    get('spa-extracted').after(tabs);
    get('spa-auto-tabs').checked=savedValue(PROPERTY_TABS_KEY,false)===true;
    get('spa-auto-tabs').onchange=e=>{if(!saveValue(PROPERTY_TABS_KEY,e.target.checked)){e.target.checked=false;notice('Could not save automatic tab setting.');return;}if(e.target.checked)openPropertyTabs(false);else get('spa-tabs-status').textContent='Automatic tabs off. Existing tabs stay open.';};
    get('spa-open-tabs').onclick=()=>openPropertyTabs(true);
    const savedSource=savedValue(PROPERTY_SOURCE_KEY,'');
    get('spa-source').value=['zillow','redfin','realtor','maps'].includes(savedSource)?savedSource:/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(lead.address)?'redfin':'zillow';
    get('spa-source').onchange=()=>{if(!saveValue(PROPERTY_SOURCE_KEY,get('spa-source').value)){notice('Could not save selected site.');return;}openPropertyTabs(false);};
    get('spa-copy-name').onclick=()=>copy(get('spa-name').value);
    get('spa-copy-address').onclick=()=>copy(get('spa-address').value);
    get('spa-copy-both').onclick=()=>copy(get('spa-name').value+'\n'+get('spa-address').value);
    get('spa-consultant').onchange=e=>{e.target.value=titleCase(e.target.value);};
    get('spa-copy-consultant').onclick=()=>{const value=titleCase(get('spa-consultant').value);if(!value){notice('Consultant not detected. Verify the assignment first.');return;}copy(value);};
    get('spa-copy-contract').onclick=()=>{const values=[titleCase(get('spa-name').value),titleCase(get('spa-address').value,true),titleCase(get('spa-consultant').value)];if(values.some(v=>!v)){notice('Name, full address and verified consultant are needed for Copy all three.');return;}copy(values.join('\n'));};
    get('spa-unit-reviewed').onclick=()=>{const key=unitReviewKey();if(unitAcknowledgments.has(key))unitAcknowledgments.delete(key);else unitAcknowledgments.add(key);updateHeader();};
    get('spa-verify').onclick=()=>{const address=clean(get('spa-address').value);if(!lead.street||!address){notice('Address missing. Check the lead.');return;}window.open(searchUrl(get('spa-source').value,address),'_blank','noopener');};
    get('spa-recheck').onclick=()=>duplicateCheck();
    const compare=()=>{const address=clean(get('spa-listing-address').value),type=get('spa-listing-type').value,box=get('spa-comparison');listingType=type;updateHeader();const same=address&&normAddress(address)===normAddress(get('spa-address').value),comparison=typeComparison(lead.type,type);box.dataset.tone=manufacturedType(type)||comparison.tone==='red'?'red':same&&comparison.tone==='green'?'green':'';box.textContent=(manufacturedType(type)?"CAN'T DO WORK: manufactured/mobile homes are out of scope in all territories. ":'')+(address?(same?'Address text matches. ':'Address differs: review spelling, unit and postal code. '):'No listing address entered. ')+comparison.text;};
    get('spa-listing-address').oninput=compare;get('spa-listing-type').onchange=compare;get('spa-address').oninput=compare;
    if(get('spa-route')){const section=get('spa-route').closest('section');main.prepend(section);get('spa-km').value=distances.get(distanceKey())?.km??'';get('spa-route').onclick=()=>window.open(routeUrl(get('spa-address').value),'_blank','noopener');get('spa-km').oninput=e=>{const value=e.target.value,level=value===''?'unknown':distanceStatus(Number(value)),box=get('spa-distance');if(level==='unknown')distances.delete(distanceKey());else distances.set(distanceKey(),{km:Number(value)});if(distances.size>50)distances.delete(distances.keys().next().value);updateHeader();box.dataset.tone=level==='over'?'red':level==='within'?'green':'';box.textContent=level==='unknown'?'Not checked.':level==='over'?'Over 150 km: beyond hard cutoff. Review before proceeding.':level==='near'?'Above 147 km: close to cutoff. Recheck route settings.':'Within 150 km based on your entered distance; other eligibility checks still apply.';};get('spa-km').dispatchEvent(new Event('input'));}
    get('spa-address').addEventListener('input',()=>{distances.delete(distanceKey());if(get('spa-km')){get('spa-km').value='';get('spa-km').dispatchEvent(new Event('input'));}updateHeader();});
    get('spa-address').addEventListener('input',refreshListing);
    const addressRow=document.createElement('div');addressRow.innerHTML='<small id="spa-address-status" role="status">Google Maps address not checked</small><button type="button" id="spa-address-verify">Verify address in Maps</button>';
    get('spa-extracted').after(addressRow);
    addressRow.querySelector('button').onclick=()=>{const address=clean(get('spa-address').value);if(address)window.open(searchUrl('maps',address),'_blank','noopener,noreferrer');};
    if(get('spa-route'))get('spa-route').onclick=()=>{const address=clean(get('spa-address').value),id=listingIdentity(address);if(!id){notice('A full street address and postal code are needed.');return;}const old=savedValue(REQUESTS_KEY,[]),now=Date.now();const stored=saveValue(REQUESTS_KEY,[{identity:id,readAt:now},...(Array.isArray(old)?old.filter(r=>r&&r.identity!==id&&now-r.readAt<LISTING_TTL):[])].slice(0,10));window.open(routeUrl(address),'_blank','noopener');notice(stored?'In Maps open Options so Avoid tolls can be verified. The selected driving distance will return here.':'Result storage unavailable. Read the route and enter kilometres manually.');};
    if(canadianLead(lead)){
      let warning=panel.querySelector('#spa-territory-warning');if(!warning){warning=document.createElement('small');warning.id='spa-territory-warning';panel.querySelector('.spa-heading').append(warning);}
      warning.textContent='150 km cutoff: Central GTA only.';
      if(previousDistance?.estimated)distances.set(distanceKey(),previousDistance);
    }else {
      panel.querySelector('#spa-territory-warning')?.remove();
    }
    const retry=document.createElement('button');retry.textContent='Retry failed checks';retry.id='spa-retry-checks';retry.title='Retry unsuccessful checks only; keep successful results, layout and settings';
    get('spa-extracted').after(retry);retry.onclick=()=>{retry.disabled=true;retryFailedChecks();setTimeout(()=>{if(retry.isConnected)retry.disabled=false;},30000);};
    setupSections(main);
    refreshHistory();refreshListing();refreshRoute();updateHeader();automaticDistance();automaticHousing();automaticAddressCheck();
    get('spa-address').addEventListener('change',()=>automaticDistance());
    get('spa-address').addEventListener('change',()=>automaticHousing());
    get('spa-address').addEventListener('change',()=>automaticAddressCheck());
  }
  async function duplicateCheck(){controller?.abort();const token=++generation,current=lead;const box=panel.querySelector('#spa-dupes');
    if(!current.id||!current.lastName||!current.street||!current.zip){box.textContent='Unavailable: name, address, postal code or lead ID missing.';return;}
    box.textContent='Checking Enabled+…';box.dataset.tone='';controller=new AbortController();const requestController=controller;const timer=setTimeout(()=>requestController.abort(),15000);
    try{const res=await fetch('/Services/NewLeadHelperService.asmx/GetDuplicateLeads',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({FirstName:'',LastName:current.lastName,Address:current.street,ZipCode:current.zip,Phone:current.phones[0]||''})});if(!res.ok)throw Error('Service returned '+res.status);const data=await res.json();if(!Array.isArray(data.d))throw Error('Unexpected response format');if(token!==generation)return;
      const seen=new Set();const matches=data.d.filter(r=>r&&/^\d+$/.test(String(r.LeadID))&&String(r.LeadID)!==current.id&&!seen.has(String(r.LeadID))&&seen.add(String(r.LeadID))).map(r=>compareCandidate(r,current));
      box.dataset.tone=matches.length?'':'green';box.innerHTML=matches.length?matches.map(m=>`<p><a href="https://www.enabledplus.com/Lead?L=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">Lead ${esc(m.id)}</a>: ${m.strong?'Strong match; review record':esc(m.differences.join(', '))}</p>`).join(''):'No other candidates returned by Enabled+. Not a guarantee that none exist.';
    }catch(error){if(token===generation)box.textContent='Check unavailable: '+(error.name==='AbortError'?'timed out or cancelled':error.message)+'. Use Recheck.';}finally{clearTimeout(timer);}
  }
  function scan(){
    if(!document.body)return;
    try {
      // Mount before parsing lead data. A failed optional reader must not suppress the panel.
      if(!panel||!panel.isConnected){panel=null;identity='';startPanel();panel.querySelector('main').textContent='Loading lead details…';}
      const next=readLead();if(!next.id){setHistoryAlarm('');generation++;controller?.abort();lead=null;identity='';listingType='';matchedListing=null;matchedListings=[];panel.querySelector('main').textContent='Waiting for current lead details…';panel.querySelector('#spa-title').textContent='Property Assistant · Waiting';panel.querySelector('#spa-subtitle').textContent='';panel.querySelector('#spa-stop').style.display='none';const historyBubble=panel.querySelector('#spa-history-bubble');if(historyBubble)historyBubble.hidden=true;for(const id of ['spa-check-badge','spa-unit-badge','spa-territory-warning']){const badge=panel.querySelector('#'+id);if(badge)badge.textContent='';}notice('Waiting for the lead ID. Refresh the lead if this remains.');return;}
      const key=JSON.stringify(next);if(key===identity){refreshHistory();resumeAutomaticChecks();return;}
      generation++;controller?.abort();lead=next;listingType='';matchedListing=null;matchedListings=[];
      renderLead();identity=key; // Only cache successful rendering so the next scan can retry a failure.
      duplicateCheck().catch(()=>notice('Duplicate lookup unavailable. Other checks remain available.'));
      notice(startupIssues.size?'v0.7.29 · '+[...startupIssues].join('; '):'v0.7.29 TEST · Read-only');
    }catch(error){identity='';setHistoryAlarm('');if(panel?.querySelector('#spa-notice'))notice('v0.7.29 · Lead reader could not finish ('+String(error?.name||'Error')+'). Retrying automatically.');}
  }
  function schedule(){clearTimeout(scanTimer);scanTimer=setTimeout(scan,600);}
  if(location.hostname==='www.enabledplus.com'&&/\/WebForms\/AppointmentCalendar\.aspx$/i.test(location.pathname)){
    // Observe only the appointment the user opens. Never change or intercept navigation.
    const capture=e=>{
      const a=e.target.closest?.('a[href*="LeadLockHandler"]');if(!a)return;
      const table=a.closest('table');if(!table)return;
      const record=calendarAssignment(a.href,[...table.rows].map(r=>r.innerText),Date.now());
      try{if(record)localStorage.setItem('sixx-calendar-consultant-v1',JSON.stringify(record));else localStorage.removeItem('sixx-calendar-consultant-v1');}catch{}
    };
    document.addEventListener('click',capture,true);document.addEventListener('auxclick',capture,true);return;
  }
  if(location.hostname==='www.google.com'&&location.pathname==='/search'){
    const token=new URLSearchParams(location.hash.slice(1)).get('sixx-property-job');
    const job=propertyJobs().find(j=>j.token===token);if(!job)return;
    let done=false,timer;
    const inspect=()=>{
      if(done)return;
      if(!propertyJobAllowed(job)){done=true;updatePropertyJob(token,'Automatic tabs switched off');return;}
      const text=clean(document.body?.innerText).slice(0,6000);
      if(/captcha|unusual traffic|verify you are human|access denied|enable javascript/i.test(text)){done=true;updatePropertyJob(token,'Search needs your attention');return;}
      const target=housingCandidate(document,job.source,job.address);if(!target)return;
      done=true;updatePropertyJob(token,'Reading listing');location.assign(target+'#sixx-property-job='+encodeURIComponent(token));
    };
    inspect();const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(inspect,700);});observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{observer.disconnect();if(!done){done=true;updatePropertyJob(token,'No readable listing link; check the search tab');}},30000);return;
  }
  if(location.hostname==='www.google.com'){
    // Read only a user-opened, explicitly requested route. Never submit or edit Maps controls.
    let timer,last='';
    const capture=()=>{
      const origin=document.querySelector('input[aria-label^="Starting point"]')?.value||'',address=document.querySelector('input[aria-label^="Destination"]')?.value||'';
      const requests=savedValue(REQUESTS_KEY,[]),id=listingIdentity(address),now=Date.now();
      if(!id||!Array.isArray(requests)||!requests.some(r=>r.identity===id&&now-r.readAt<LISTING_TTL)||!/L5N\s?2X5/i.test(origin))return;
      if(!document.querySelector('input[aria-label="Avoid tolls"]')?.checked)return;
      const cards=[...document.querySelectorAll('[data-trip-index][role="link"]')].filter(n=>n.querySelector('[aria-label="Driving"]'));
      if(cards.length!==1)return;
      const km=parseRouteDistance(cards[0].innerText);if(km===null)return;
      const route=clean(cards[0].querySelector('h1')?.innerText),fingerprint=JSON.stringify([id,km,route]);if(fingerprint===last)return;last=fingerprint;
      const old=savedValue(ROUTES_KEY,[]);saveValue(ROUTES_KEY,[{identity:id,km,origin:'L5N2X5',avoidTolls:true,route,readAt:now},...(Array.isArray(old)?old.filter(r=>r&&r.identity!==id&&now-r.readAt<LISTING_TTL):[])].slice(0,10));
    };
    capture();new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(capture,1200);}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});document.addEventListener('change',capture);return;
  }
  if(['www.redfin.ca','www.redfin.com','www.zillow.com','www.realtor.com'].includes(location.hostname)) {
    // Read ordinary user/opt-in tabs. Never solve challenges or alter website records.
    const jobToken=new URLSearchParams(location.hash.slice(1)).get('sixx-property-job');
    const tabJob=propertyJobs().find(j=>j.token===jobToken);
    let last='',timer;
    const capture=()=>{
      const source=listingSource(location.origin+location.pathname);if(!source)return;
      let result;
      if(tabJob){
        if(!propertyJobAllowed(tabJob))return;
        if(source!==tabJob.source){updatePropertyJob(jobToken,'Listing source mismatch');return;}
        result=housingFacts(document,location.origin+location.pathname,tabJob.address);
        if(!result){updatePropertyJob(jobToken,'Waiting for matching property details');return;}
      }
      else if(source==='Redfin')result=parseRedfinFacts(document.querySelector('h1')?.innerText||'',
        [...document.querySelectorAll('#house-info .keyDetails-row')].map(n=>n.innerText),
        [...document.querySelectorAll('li')].map(n=>clean(n.innerText)).filter(s=>/^(?:Style|Subdivision(?: Name)?|Development(?: Name)?|Community Name|HOA Name|Association Name)\s*:/i.test(s)),location.origin+location.pathname,Date.now());
      else if(source==='Zillow')result=parseVisibleListing(document.querySelector('h1')?.innerText||'',[...document.querySelectorAll('[aria-label="At a glance facts"] [role="listitem"]')].map(n=>clean(n.innerText)),[],location.origin+location.pathname,Date.now());
      else {
        // Conservative semantic reader. If labelled property facts are absent, keep unknown.
        const root=document.querySelector('main');
        const labels=root?[...root.querySelectorAll('dt,span,p')].filter(n=>n.children.length===0&&/^Property type\s*:?$/i.test(clean(n.innerText))):[];
        const types=labels.map(n=>clean(n.nextElementSibling?.innerText||''));
        result=parseVisibleListing(root?.querySelector('h1')?.innerText||'',types,[],location.origin+location.pathname,Date.now());
      }
      if(!result)return;
      const fingerprint=JSON.stringify({...result,readAt:0});if(fingerprint===last)return;last=fingerprint;
      const old=savedValue(LISTINGS_KEY,[]),recent=Array.isArray(old)?old.filter(r=>r&&Date.now()-r.readAt<LISTING_TTL&&!(r.identity===result.identity&&r.source===result.source)):[];
      saveValue(LISTINGS_KEY,[result,...recent].slice(0,30));
      if(tabJob)updatePropertyJob(jobToken,'Matched');
    };
    capture();window.addEventListener('focus',()=>{last='';capture();});new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(capture,700);}).observe(document.body,{childList:true,subtree:true,characterData:true});return;
  }
  scan();
  watchValue(LISTINGS_KEY,refreshListing);
  watchValue(ROUTES_KEY,refreshRoute);
  if(startupIssues.size&&panel)notice('v0.7.29 · '+[...startupIssues].join('; '));
  watchValue(HISTORY_SOUND_KEY,updateHistorySound);
  document.addEventListener('pointerdown',unlockHistorySound,{passive:true});document.addEventListener('keydown',unlockHistorySound);
  window.addEventListener('blur',stopHistorySound);window.addEventListener('focus',updateHistorySound);window.addEventListener('pagehide',stopHistorySound);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHistorySound();else updateHistorySound();});
  window.addEventListener('focus',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  watchValue(THEME_KEY,()=>applyTheme(savedValue(THEME_KEY,'destiny')));
  watchValue(PROPERTY_SOURCE_KEY,()=>{const select=panel?.querySelector('#spa-source'),value=savedValue(PROPERTY_SOURCE_KEY,'');if(select&&['zillow','redfin','realtor','maps'].includes(value))select.value=value;});
  watchValue(PROPERTY_TABS_KEY,()=>{const toggle=panel?.querySelector('#spa-auto-tabs');if(toggle)toggle.checked=savedValue(PROPERTY_TABS_KEY,false)===true;});
  watchValue(PROPERTY_JOBS_KEY,()=>{const status=panel?.querySelector('#spa-tabs-status');if(status&&lead){const id=listingIdentity(panel.querySelector('#spa-address')?.value);status.textContent=propertyJobs().filter(j=>j.identity===id).map(j=>j.source+': '+j.status).join(' · ');}});
  window.addEventListener('focus',refreshRoute);
  setInterval(()=>{if(!document.hidden)refreshRoute();},60000);
  window.addEventListener('focus',refreshListing);setInterval(()=>{if(!document.hidden)refreshListing();},60000);
  if(typeof MutationObserver==='function')new MutationObserver(records=>{if(records.some(r=>!r.target.parentElement?.closest('#'+ID)&&!r.target.closest?.('#'+ID)))schedule();}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('DOMContentLoaded',scan,{once:true});
  document.addEventListener('change',e=>{if(!e.target.closest('#'+ID))schedule();});window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);
  // Pause polling in background tabs. Only recent route/listing results use Tampermonkey storage.
  setInterval(()=>{if(!document.hidden)scan();},5000);
  // Made by Montana. No reproduction or redistribution without prior written consent.
})();
