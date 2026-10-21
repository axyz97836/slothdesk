'use strict';

const el = (id) => document.getElementById(id);
const state = { files: [], suggestions: [], organized: {}, connected: false, installed: [], working: false, batches: 0 };
const tags = { '.txt':'TXT', '.md':'MD', '.csv':'CSV', '.json':'JSON', '.py':'PY', '.js':'JS', '.html':'HTML', '.log':'LOG', '.yaml':'YAML', '.yml':'YML' };
let toastTimer;

function toast(message, error=false) {
  const t=el('toast'); t.textContent=message; t.classList.toggle('error',error); t.hidden=false;
  window.clearTimeout(toastTimer); toastTimer=window.setTimeout(()=>{t.hidden=true},6000);
}
async function request(url, data) {
  const opts = data===undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const r=await fetch(url,opts);
  const body=await r.json();
  if(!r.ok) throw new Error(body.error||`Request failed (${r.status})`);
  return body;
}
const bytes=(count)=> count<1024 ? `${count} B` : `${(count/1024).toFixed(1)} KB`;
const create=(tag, klass, text)=>{const node=document.createElement(tag);if(klass)node.className=klass;if(text!==undefined)node.textContent=text;return node};
function busy(flag){state.working=flag;updateButtons()}
function updateButtons(){
  const available=state.files.filter(f=>f.supported).length>0;
  el('analyze-button').disabled=state.working||!state.connected||!available;
  el('analyze-button').textContent=state.working?'Reading files locally…':'✦  Analyze my inbox  ↗';
  el('demo-button').disabled=state.working;
  el('refresh-button').disabled=state.working;
  el('undo-button').disabled=state.working||state.batches<1;
  el('apply-button').disabled=state.working||state.suggestions.filter(s=>s.selected).length===0;
  el('export-button').disabled=state.suggestions.length===0;
}
async function refresh(){
  try {
    const [status, files]=await Promise.all([request('/api/status'),request('/api/files')]);
    state.files=files.files;
    state.organized=status.organized;
    state.batches=status.batches;
    const info=status.ollama;
    state.installed=info.models;
    state.connected=info.reachable&&info.models.length>0;
    const select=el('model-select');const previous=select.value;
    select.replaceChildren();
    const options = info.models.length ? info.models : [status.recommended_model];
    for(const model of options){let o=create('option',null,model);o.value=model;select.append(o)}
    select.value=options.includes(previous)?previous:(options.includes(status.recommended_model)?status.recommended_model:options[0]);
    const ms=el('model-status');ms.replaceChildren();const dot=create('span','state-dot');
    let text;
    if(!info.reachable){text='Ollama is not running. Start it to analyze files.';dot.classList.add('error')}
    else if(!info.models.length){text='Ollama is running, but no local model is installed.';dot.classList.add('error')}
    else{text=`Ready · ${info.models.length} local model${info.models.length>1?'s':''} available`;dot.classList.add('ready')}
    ms.append(dot,create('span',null,text));
    el('stat-inbox').textContent=state.files.length;
    el('stat-organized').textContent=Object.values(state.organized).reduce((a,b)=>a+b,0);
    el('inbox-label').textContent=state.files.length;
    renderFiles();renderCategories();renderReview();updateButtons();
  } catch(err){toast(err.message,true)}
}
function renderFiles(){
  const root=el('file-list');root.replaceChildren();
  if(!state.files.length){root.append(create('div','empty-inline','Your inbox is enjoying a break. Add files in data/inbox/ or try the sample files.'));return}
  for(const f of state.files){
    const row=create('div','file-row');const ext='.'+f.name.split('.').pop().toLowerCase();
    row.append(create('span','file-icon',tags[ext]||'FILE'));
    const block=create('div','file-text');block.append(create('strong',null,f.name),create('small',null,bytes(f.size)));row.append(block);
    if(!f.supported)row.append(create('span','file-warning','Too large'));
    root.append(row);
  }
}
function renderCategories(){
  const root=el('categories');root.replaceChildren();
  const cats=['Study','Code','Finance','Reading','Personal','Projects','Other'];
  for(const name of cats){
    const count=state.organized[name]||0;
    const item=create('div','category');item.append(create('span','category-icon','▤'));
    const inf=create('div','category-info');inf.append(create('strong',null,name),create('small',null,`${count} file${count===1?'':'s'}`));item.append(inf);root.append(item);
  }
}
function renderReview(){
  const root=el('review-list');root.replaceChildren();
  el('stat-suggestions').textContent=state.suggestions.length;
  el('nav-count').textContent=state.suggestions.length;
  el('review-label').textContent=state.suggestions.length;
  const selected=state.suggestions.filter(s=>s.selected).length;
  el('review-selection').textContent=state.suggestions.length ? `${selected} of ${state.suggestions.length} selected`:'No suggestions yet';
  if(!state.suggestions.length){
    const empty=create('div','review-empty');const mark=create('div','review-empty-icon','✳');
    empty.append(mark,create('h3',null,'A little quiet in here.'),create('p',null,'Analyze a few inbox files and your AI suggestions will show up for review.'));
    root.append(empty);updateButtons();return;
  }
  for(const s of state.suggestions){
    const card=create('article','review-card');
    const cb=create('input','review-check');cb.type='checkbox';cb.checked=s.selected;
    cb.setAttribute('aria-label',`Approve ${s.name}`);
    cb.addEventListener('change',()=>{s.selected=cb.checked;updateButtons();el('review-selection').textContent=`${state.suggestions.filter(x=>x.selected).length} of ${state.suggestions.length} selected`});
    card.append(cb);
    const content=create('div');content.append(create('div','review-title',s.name),create('p','review-summary',s.summary||'No summary provided'));
    const controls=create('div','review-controls');
    const group1=create('label',null,'DESTINATION CATEGORY');const select=create('select');select.setAttribute('aria-label',`Destination for ${s.name}`);
    for(const category of ['Study','Code','Finance','Reading','Personal','Projects','Other']){const opt=create('option',null,category);opt.value=category;select.append(opt)}
    select.value=s.category;select.addEventListener('change',()=>{s.category=select.value});group1.append(select);
    const group2=create('label',null,'SUGGESTED FILENAME');const input=create('input');input.type='text';input.value=s.suggested_name;input.maxLength=120;input.setAttribute('aria-label',`New filename for ${s.name}`);input.addEventListener('input',()=>{s.suggested_name=input.value});group2.append(input);
    controls.append(group1,group2);content.append(controls,create('div','review-why',s.reason?`Why: ${s.reason}`:'Review the AI suggestion before approving.'));
    card.append(content);root.append(card);
  }
  updateButtons();
}
async function loadSamples(){
  busy(true);
  try{const result=await request('/api/demo',{});await refresh();toast(result.created.length?`Added ${result.created.length} fictional sample files to your inbox.`:'Sample files are already present. Nothing overwritten.')}catch(err){toast(err.message,true)}finally{busy(false)}
}
async function analyze(){
  const names=state.files.filter(f=>f.supported).slice(0,12).map(f=>f.name);
  if(!names.length)return;
  busy(true);toast(`Asking ${el('model-select').value} to read ${names.length} files locally. This can take a minute…`);
  try{
    const result=await request('/api/analyze',{files:names,model:el('model-select').value});
    state.suggestions=result.suggestions.map(s=>({...s,selected:true}));renderReview();
    const failure=result.errors.length?` ${result.errors.length} file(s) need another try.`:'';
    toast(`AI finished ${result.suggestions.length} suggestion(s) in ${result.elapsed_seconds}s.${failure}`,!!result.errors.length);
    el('review').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){toast(err.message,true)}finally{busy(false)}
}
async function approve(){
  const items=state.suggestions.filter(s=>s.selected).map(s=>({name:s.name,category:s.category,suggested_name:s.suggested_name}));
  if(!items.length)return;
  busy(true);
  try{
    const result=await request('/api/apply',{items});
    const moved=new Set(result.moved.map(x=>x.source));state.suggestions=state.suggestions.filter(s=>!moved.has(s.name));
    await refresh();
    toast(`${result.moved.length} file(s) organized.${result.errors.length?' '+result.errors.length+' could not be moved.':''}`,!!result.errors.length);
    if(result.errors.length)console.warn('Local move errors:',result.errors.map(e=>e.message));
  }catch(err){toast(err.message,true)}finally{busy(false)}
}
async function undo(){
  if(!window.confirm('Move the files from your latest organization batch back into the inbox? Existing files will never be overwritten.'))return;
  busy(true);
  try{
    const result=await request('/api/undo',{});
    state.suggestions=[];await refresh();
    toast(`${result.restored.length} file(s) returned to the inbox.${result.errors.length?' Some could not be restored.':''}`,!!result.errors.length);
  }catch(err){toast(err.message,true)}finally{busy(false)}
}
function exportPlan(){
  if(!state.suggestions.length)return;
  const csv=(value)=>'"'+String(value??'').replace(/"/g,'""')+'"';
  const rows=[['Original Name','Suggested Name','Category','Summary','Reason','Approved'],
    ...state.suggestions.map(s=>[s.name,s.suggested_name,s.category,s.summary,s.reason,s.selected?'Yes':'No'])];
  const content=rows.map(row=>row.map(csv).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='slothdesk-review-plan.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('refresh-button').addEventListener('click',refresh);
el('demo-button').addEventListener('click',loadSamples);
el('analyze-button').addEventListener('click',analyze);
el('apply-button').addEventListener('click',approve);
el('undo-button').addEventListener('click',undo);
el('export-button').addEventListener('click',exportPlan);
refresh();
