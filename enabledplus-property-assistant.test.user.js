// ==UserScript==
// @name         Enabled+ Property Assistant TEST
// @namespace    sixx.enabledplus.tools.test
// @version      0.6.0
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
  function applyTheme(value){
    const key=Object.hasOwn(THEMES,value)?value:'destiny',theme=THEMES[key];if(!panel)return;
    panel.dataset.theme=key;
    for(const [name,color] of Object.entries(theme))if(name!=='label')panel.style.setProperty('--spa-'+name,color);
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
    if(results.some(s=>s.source===source&&s.result)){tell(source+' already verified.');return;}
    const recentPropertyRequests=propertyJobs();if(recentPropertyRequests.some(j=>j.identity===identity&&j.source===source)){tell(source+' already opened recently.');return;}
    // Limit unattended tab creation across leads, not just on this page.
    if(!manual&&recentPropertyRequests.filter(j=>!j.manual).length>=3){tell('Automatic tab limit reached. Use Open selected check if needed.');return;}
    const token=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const job={token,identity,address,source,started:Date.now(),manual,status:'Opening search'};
    if(!saveValue(PROPERTY_JOBS_KEY,[...recentPropertyRequests,job].slice(-30))){tell('Could not save tab request. No tab opened.');return;}
    try{GM_openInTab(searchUrl(key,address)+'#sixx-property-job='+encodeURIComponent(token),{active:false,insert:true,setParent:true});tell(source+' check opened. Matching results return here.');}
    catch{updatePropertyJob(token,'Tab could not open');tell(source+' tab could not open.');}
  }
  // Pure functions are also exercised by the local test suite.
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
  function headerSummary(current,distance) {
    const km=distance?.km;
    const types=[...new Set((current.listingTypes||[]).map(propertyLabel).filter(Boolean))];
    const label=types.length>1?'Property types differ':types[0]||current.type||'Property type unverified';
    const property=types.length?titleCase(label):current.type?titleCase(label)+' (lead only)':label;
    return {title:canadianLead(current)?'Canada · '+(Number.isFinite(km)?km.toFixed(1)+' km':distance?.error?'unavailable':'checking…'):titleCase(current.name)||'Property Assistant',
      detail:canadianLead(current)?(Number.isFinite(km)?distance.precision==='street'?'Street estimate · Verify route':(distance.estimated?'Estimated drive':'Maps distance')+(gtaMarket(current.region)?' · '+(km>150?'Above Central cutoff':km>147?'Near Central cutoff':'Below Central cutoff'):' · From Mississauga'):distance?.error?'Lookup unavailable':'Checking distance…'):[current.region||'Region unknown',property].join(' · '),
      over:canadianLead(current)&&gtaMarket(current.region)&&Number.isFinite(km)&&km>150&&distance.precision!=='street'};
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
    return {id,name:nameText,consultant,consultantSource:summaryConsultant?'lead summary':'selected calendar appointment',lastName:cleanLeadName(last)||nameText.split(/\s+/).at(-1)||'',street,cityLine,zip,rawRegion:region,region:effectiveRegion(region),
      phones:['.homephonelabel','.cellphonelabel','.workphonelabel'].map(s=>phone(read([s]))).filter(Boolean),
      type:dwelling||read(['input[name="PropertyType"]','.lead-attribute.property-type'])||assessmentPropertyType(notes),condoHint:condoSignal(notes),...physicalAddress(street,cityLine,notes)};
  }
  function styles() {
    if(document.getElementById(ID+'-style'))return;
    const style=document.createElement('style');style.id=ID+'-style';style.textContent=`
    #${ID} header .spa-heading{flex:1;min-width:0}#${ID} header small{display:block;font-size:11px;font-weight:400}#${ID} .spa-stop{display:block;color:#ff5555;font-weight:700;animation:spa-warning 2.4s ease-in-out infinite}#${ID}[data-over=true] header{border-bottom:2px solid #ff5555}@keyframes spa-warning{50%{opacity:.5}}@media(prefers-reduced-motion:reduce){#${ID} .spa-stop{animation:none}}
    #${ID}{position:fixed;right:16px;top:88px;width:320px;height:480px;min-width:245px;min-height:150px;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);resize:both;overflow:hidden;display:flex;flex-direction:column;z-index:999994;background:#282a36;color:#f8f8f2;border:1px solid #6272a4;border-radius:11px;box-shadow:0 12px 30px #0005;font:12px/1.45 'Segoe UI',sans-serif}
    #${ID} *{box-sizing:border-box}#${ID} header{display:flex;align-items:center;gap:8px;padding:10px;background:#21222c;cursor:move;touch-action:none;user-select:none}#${ID} header strong{flex:1;color:#bd93f9}#${ID} main{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:10px;scrollbar-color:#6272a4 #21222c}#${ID} section{margin-bottom:12px}#${ID} label{display:block;margin:6px 0;color:#c7c9d3}#${ID} input,#${ID} textarea,#${ID} select{width:100%;background:#21222c;color:#f8f8f2;border:1px solid #55596e;border-radius:5px;padding:6px;font:inherit}#${ID} textarea{resize:vertical;min-height:52px}#${ID} button,#${ID} a{background:#343746;color:#f8f8f2;border:1px solid #62667e;border-radius:6px;padding:5px 8px;cursor:pointer;font:inherit;text-decoration:none}#${ID} .row{display:flex;gap:6px;margin-top:7px}#${ID} .row>*{flex:1;min-width:0}#${ID} p{margin:5px 0}#${ID} small{color:#c7c9d3}#${ID} .status{padding:7px;border-left:3px solid #ffb86c;background:#21222c;border-radius:4px}#${ID} [data-tone=red]{border-color:#ff5555}#${ID} [data-tone=green]{border-color:#50fa7b}#${ID} details{margin-top:10px}#${ID} summary{cursor:pointer;color:#bd93f9}#${ID} footer{padding:7px 10px;background:#21222c;color:#c7c9d3}#${ID}[data-mini=true]{width:245px!important;height:auto!important;min-height:0;resize:none}#${ID}[data-mini=true] main,#${ID}[data-mini=true] footer{display:none}
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
    #${ID}[data-mini=true]{width:270px!important;max-width:calc(100vw - 12px);border-radius:14px}
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
    #${ID} #spa-theme{width:auto;max-width:140px;font:inherit;min-height:28px;padding:3px}
    #${ID}[data-theme] main{scrollbar-color:var(--spa-border) var(--spa-bg)}#${ID}[data-theme] main::-webkit-scrollbar-thumb{background:var(--spa-border);border-color:var(--spa-bg)}
    #${ID}[data-theme] :focus-visible{outline-color:var(--spa-accent)}
    `;(document.head||document.documentElement).append(style);
  }
  function clamp(){const r=panel.getBoundingClientRect();panel.style.left=Math.max(6,Math.min(r.left,innerWidth-r.width-6))+'px';panel.style.top=Math.max(6,Math.min(r.top,innerHeight-r.height-6))+'px';panel.style.right='auto';}
  function save(){if(windowSync)return;const r=panel.getBoundingClientRect();const minimized=panel.dataset.mini==='true';try{localStorage.setItem(KEY,JSON.stringify({left:r.left,top:r.top,width:minimized?Number(panel.dataset.w):r.width,height:minimized?Number(panel.dataset.h):r.height,minimized}));}catch{}}
  function restore(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(!s)return;for(const k of ['left','top','width','height'])if(Number.isFinite(s[k]))panel.style[k]=s[k]+'px';panel.dataset.w=String(s.width||320);panel.dataset.h=String(s.height||480);panel.dataset.mini=String(s.minimized===true);panel.style.right='auto';miniLabel();clamp();}catch{}}
  function miniLabel(){const b=panel.querySelector('[data-action=mini]');b.textContent=panel.dataset.mini==='true'?'+':'−';b.title=panel.dataset.mini==='true'?'Restore':'Minimize';b.setAttribute('aria-label',b.title);}
  async function copy(value){try{await navigator.clipboard.writeText(value);notice('Copied.');}catch{notice('Clipboard unavailable. Select the preview text and copy manually.');}}
  function notice(text){panel.querySelector('#spa-notice').textContent=text;}
  function resetLayout(){panel.dataset.mini='false';panel.dataset.w='320';panel.dataset.h='480';panel.style.width='320px';panel.style.height='480px';panel.style.left=Math.max(6,innerWidth-336)+'px';panel.style.top=Math.min(88,Math.max(6,innerHeight-492))+'px';miniLabel();clamp();save();notice('Layout reset. Your results are unchanged.');}
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
    if(cachedEstimate?.failed&&cachedEstimate.retryAt>Date.now())return;
    if(cachedEstimate?.failed&&!cachedEstimate.retryAt)return;
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
        const match=distanceCandidate(places,address),p=match?.place,lat=Number(p?.lat),lon=Number(p?.lon);
        if(Array.isArray(places)&&places.length&&!p)throw Error('Map results did not match the house or an unambiguous street in the same city; the lead address may still be valid');
        if(!p||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<41||lat>84||lon< -141||lon> -52)throw Error('Address not located');
        // Do not silently substitute a postal-code centre for the homeowner address.
        // Street-level matches are explicitly labelled and never treated as house verification.
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
      const approximate=result.precision==='street';
      box.dataset.tone=!approximate&&gtaMarket(lead.region)&&km>150?'red':'';
      box.textContent=km.toFixed(1)+(approximate?' km · Street estimate. Verify house route.':' km · Estimated drive from Mississauga.');
      const detail=panel.querySelector('#spa-distance-details');if(detail)detail.textContent=approximate?'Street/city matched; house/postal location unverified. Do not use this estimate to decide eligibility.':'OpenStreetMap / OSRM route. Toll avoidance is not verified.';updateHeader();
    }catch(e){const request=estimateRequests.get(address);if(request){request.failed=true;request.retryAt=transientLookupFailure(e.message)&&request.attempts<3?Date.now()+30000*request.attempts:0;}
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
  function housingCandidate(doc,source){
    for(const a of doc.querySelectorAll('a[href]')){
      try{let u=new URL(a.getAttribute('href'),'https://www.google.com');if(u.hostname==='www.google.com'&&u.pathname==='/url')u=new URL(u.searchParams.get('q')||u.searchParams.get('url'));
        if(listingSource(u.href)===source){u.hash='';u.search='';return u.href;}
      }catch{}
    }return '';
  }
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
  async function automaticHousing(){
    if(!lead||!panel)return;
    const address=clean(panel.querySelector('#spa-address')?.value);
    if(!lead.street||!listingIdentity(address)||lead.uncertain)return;
    const existing=housingChecks.get(address),retryDue=existing?.retryAt&&existing.retryAt<=Date.now();
    if(existing&&!retryDue&&Date.now()-existing.started<LISTING_TTL)return;
    const state=retryDue?{...existing,started:Date.now(),attempts:existing.attempts+1,retryAt:0}:{started:Date.now(),attempts:1,retryAt:0,statuses:{Zillow:'Queued',Redfin:'Queued','Realtor.com':'Queued'}};housingChecks.set(address,state);
    if(housingChecks.size>30)housingChecks.delete(housingChecks.keys().next().value);
    for(const [key,source] of [['zillow','Zillow'],['redfin','Redfin'],['realtor','Realtor.com']]){
      if(retryDue&&!transientLookupFailure(state.statuses[source]))continue;
      if(clean(panel.querySelector('#spa-address')?.value)!==address)return;
      state.statuses[source]='Checking';refreshListing();
      try{
        const search=await housingHtml(searchUrl(key,address));
        if(new URL(search.url).hostname!=='www.google.com')throw Error('Search redirected; manual check needed');
        const candidate=housingCandidate(search.doc,source);if(!candidate)throw Error('No listing found in search');
        const page=await housingHtml(candidate);if(listingSource(page.url)!==source)throw Error('Listing redirected; manual check needed');
        const result=housingFacts(page.doc,page.url,address);if(!result){
          const heading=page.doc.querySelector('h1')?.textContent||'';
          if(listingAddressMismatch(address,heading))throw Error('Address mismatch: listing house, street, unit or postal code differs. Result rejected.');
          throw Error('Address or property type could not be verified');
        }
        const old=savedValue(LISTINGS_KEY,[]);if(!saveValue(LISTINGS_KEY,[result,...(Array.isArray(old)?old.filter(r=>r&&!(r.identity===result.identity&&r.source===source)&&Date.now()-r.readAt<LISTING_TTL):[])].slice(0,30)))throw Error('Could not save listing result');
        state.statuses[source]='Matched';
      }catch(e){state.statuses[source]=e.message;}
      if(clean(panel.querySelector('#spa-address')?.value)===address)refreshListing();
    }
    if(state.attempts<3&&Object.values(state.statuses).some(transientLookupFailure))state.retryAt=Date.now()+30000*state.attempts;
    if(clean(panel.querySelector('#spa-address')?.value)===address)openPropertyTabs(false);
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
  function startPanel(){styles();panel=document.createElement('aside');panel.id=ID;panel.setAttribute('aria-label','Property Assistant test panel');panel.innerHTML='<header><div class="spa-heading"><strong id="spa-title">Property Assistant · TEST</strong><small id="spa-subtitle"></small><span id="spa-stop" class="spa-stop" style="display:none"></span></div><button data-action="mini" aria-label="Minimize">−</button></header><main></main><footer><span id="spa-notice" role="status" aria-live="polite">TEST · No company records changed.</span><button id="spa-reset-layout" title="Restore default window position and size">Reset layout</button><small id="spa-credit" style="flex-basis:100%" title="Made by Montana. Authorized internal review and testing only. No reproduction, redistribution, republication, or removal of attribution without Montana’s prior written consent. Unofficial tool.">Made by Montana</small></footer>';document.body.append(panel);restore();panel.querySelector('#spa-reset-layout').onclick=resetLayout;
    const unitBadge=document.createElement('small');unitBadge.id='spa-unit-badge';unitBadge.hidden=true;panel.querySelector('.spa-heading').append(unitBadge);
    const themeSelect=document.createElement('select');themeSelect.id='spa-theme';themeSelect.setAttribute('aria-label','Color theme');
    for(const [value,theme] of Object.entries(THEMES)){const option=document.createElement('option');option.value=value;option.textContent=theme.label;themeSelect.append(option);}
    panel.querySelector('footer').prepend(themeSelect);applyTheme(savedValue(THEME_KEY,'destiny'));
    themeSelect.onchange=()=>{applyTheme(themeSelect.value);if(!saveValue(THEME_KEY,themeSelect.value))notice('Theme changed; could not save preference.');};
    const header=panel.querySelector('header');header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const r=panel.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;header.setPointerCapture(e.pointerId);header.onpointermove=m=>{panel.style.left=m.clientX-x+'px';panel.style.top=m.clientY-y+'px';panel.style.right='auto';clamp();};header.onpointerup=header.onpointercancel=()=>{header.onpointermove=null;save();};};
    panel.querySelector('[data-action=mini]').onclick=()=>{const r=panel.getBoundingClientRect();if(panel.dataset.mini!=='true'){panel.dataset.w=String(r.width);panel.dataset.h=String(r.height);panel.dataset.mini='true';}else{panel.dataset.mini='false';panel.style.width=(Number(panel.dataset.w)||320)+'px';panel.style.height=(Number(panel.dataset.h)||480)+'px';}miniLabel();clamp();save();};
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{clamp();save();},220);}).observe(panel);
    else {panel.addEventListener('pointerup',()=>{clamp();save();});startupIssues.add('Resize observer unavailable');}
    window.addEventListener('storage',e=>{if(e.key===KEY){windowSync=true;restore();setTimeout(()=>windowSync=false,500);}});
    window.addEventListener('resize',()=>{clamp();save();});
  }
  function setupSections(main){
    let preferences={};try{preferences=JSON.parse(localStorage.getItem('sixx-property-sections-v1')||'{}')||{};}catch{}
    const definitions=[['distance','spa-distance'],['duplicates','spa-dupes'],['property','spa-extracted'],['copy','spa-name']];
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
    <section><strong>Copy details</strong><label>Homeowner<input id="spa-name" value="${esc(titleCase(lead.name))}"></label><label>Address<textarea id="spa-address">${esc(titleCase(lead.address,true))}</textarea></label><small>Check spelling before copying.</small>
    ${lead.routing?`<p class="status">Routing ZIP instructions found. ${lead.uncertain?'Physical ZIP needs review before lookup/copy.':'Physical ZIP used in preview; original lead unchanged.'}</p>`:''}
    <div class="row"><button id="spa-copy-name">Copy name</button><button id="spa-copy-address">Copy address</button><button id="spa-copy-both">Copy both</button></div><label>Design consultant<input id="spa-consultant" value="${esc(titleCase(lead.consultant))}" placeholder="Not detected; verify assignment"></label><div class="row"><button id="spa-copy-consultant">Copy consultant</button><button id="spa-copy-contract">Copy all three</button></div></section>
    <section><strong>Duplicate leads</strong><div id="spa-dupes" class="status">Waiting to check…</div><button id="spa-recheck">Recheck</button></section>
    <section><strong>Property details</strong><div id="spa-extracted" class="status">Checking saved listing details…</div><div class="row"><select id="spa-source" aria-label="Verification source"><option value="zillow">Zillow</option><option value="redfin">Redfin</option><option value="realtor">Realtor.com</option><option value="maps">Google Maps</option></select><button id="spa-verify">Search address</button></div><div id="spa-unit-warning" class="status" role="status" hidden></div><button id="spa-unit-reviewed" hidden>Checked: no unit applies</button>
    <details><summary>Compare a listing</summary><p>Enabled+ type: ${esc(lead.type||'Not detected')}</p><label>Address copied from listing<input id="spa-listing-address" placeholder="Full address including unit and postal code"></label><label>Property type shown<select id="spa-listing-type"><option value="">Not checked / unavailable</option>Single family</option>Townhouse</option>Condo</option>Multifamily</option>Manufactured / mobile</option>Other</option></select></label><div id="spa-comparison" class="status">Manual comparison, not automatically verified.</div></details></section>
    ${canadianLead(lead)?`<section><strong>Canada distance</strong><div id="spa-distance" class="status">Calculating automatically…</div><button id="spa-route">Verify in Maps</button><details><summary>Distance settings &amp; details</summary><label>Verified distance (km)<input id="spa-km" type="number" min="0" step="0.1" placeholder="Automatic"></label><p>Estimate from central Mississauga. Maps uses L5N 2X5 with avoid tolls; results may differ. The 150 km cutoff applies to Central GTA only, not Eastern GTA or other markets.</p><div id="spa-distance-details"></div></details></section>`:''}`;
    const get=id=>panel.querySelector('#'+id);
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
    if(get('spa-route'))get('spa-route').onclick=()=>{const address=clean(get('spa-address').value),id=listingIdentity(address);if(!id){notice('A full street address and postal code are needed.');return;}const old=savedValue(REQUESTS_KEY,[]),now=Date.now();const stored=saveValue(REQUESTS_KEY,[{identity:id,readAt:now},...(Array.isArray(old)?old.filter(r=>r&&r.identity!==id&&now-r.readAt<LISTING_TTL):[])].slice(0,10));window.open(routeUrl(address),'_blank','noopener');notice(stored?'In Maps open Options so Avoid tolls can be verified. The selected driving distance will return here.':'Result storage unavailable. Read the route and enter kilometres manually.');};
    if(canadianLead(lead)){
      let warning=panel.querySelector('#spa-territory-warning');if(!warning){warning=document.createElement('small');warning.id='spa-territory-warning';panel.querySelector('.spa-heading').append(warning);}
      warning.textContent='150 km cutoff: Central GTA only.';
      if(previousDistance?.estimated)distances.set(distanceKey(),previousDistance);
    }else {
      panel.querySelector('#spa-territory-warning')?.remove();
    }
    const retry=document.createElement('button');retry.textContent='Retry checks';retry.id='spa-retry-checks';retry.title='Retry property, distance and duplicate checks without changing your layout or settings';
    get('spa-extracted').after(retry);retry.onclick=()=>{retry.disabled=true;const address=clean(get('spa-address').value);housingChecks.delete(address);estimateRequests.delete(address);if(distances.get(distanceKey())?.estimated)distances.delete(distanceKey());automaticHousing();automaticDistance();duplicateCheck().catch(()=>notice('Duplicate lookup unavailable.'));setTimeout(()=>{if(retry.isConnected)retry.disabled=false;},30000);};
    setupSections(main);
    refreshListing();refreshRoute();updateHeader();automaticDistance();automaticHousing();
    get('spa-address').addEventListener('change',()=>automaticDistance());
    get('spa-address').addEventListener('change',()=>automaticHousing());
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
      const next=readLead();if(!next.id){generation++;controller?.abort();lead=null;identity='';listingType='';matchedListing=null;matchedListings=[];panel.querySelector('main').textContent='Waiting for current lead details…';panel.querySelector('#spa-title').textContent='Property Assistant · Waiting';panel.querySelector('#spa-subtitle').textContent='';panel.querySelector('#spa-stop').style.display='none';for(const id of ['spa-check-badge','spa-unit-badge','spa-territory-warning']){const badge=panel.querySelector('#'+id);if(badge)badge.textContent='';}notice('Waiting for the lead ID. Refresh the lead if this remains.');return;}
      const key=JSON.stringify(next);if(key===identity){resumeAutomaticChecks();return;}
      generation++;controller?.abort();lead=next;listingType='';matchedListing=null;matchedListings=[];
      renderLead();identity=key; // Only cache successful rendering so the next scan can retry a failure.
      duplicateCheck().catch(()=>notice('Duplicate lookup unavailable. Other checks remain available.'));
      notice(startupIssues.size?'v0.6.0 · '+[...startupIssues].join('; '):'v0.6.0 TEST · Read-only');
    }catch(error){identity='';if(panel?.querySelector('#spa-notice'))notice('v0.6.0 · Lead reader could not finish ('+String(error?.name||'Error')+'). Retrying automatically.');}
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
      const target=housingCandidate(document,job.source);if(!target)return;
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
  if(startupIssues.size&&panel)notice('v0.6.0 · '+[...startupIssues].join('; '));
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
