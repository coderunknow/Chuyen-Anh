(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))o(t);new MutationObserver(t=>{for(const s of t)if(s.type==="childList")for(const h of s.addedNodes)h.tagName==="LINK"&&h.rel==="modulepreload"&&o(h)}).observe(document,{childList:!0,subtree:!0});function p(t){const s={};return t.integrity&&(s.integrity=t.integrity),t.referrerPolicy&&(s.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?s.credentials="include":t.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function o(t){if(t.ep)return;t.ep=!0;const s=p(t);fetch(t.href,s)}})();async function qt(){try{const n=await fetch("./data/vocabulary.json");if(!n.ok)throw new Error(`HTTP ${n.status}`);const r=await n.json();if(!Array.isArray(r))throw new Error("Invalid format");return r}catch(n){try{const r=await fetch("/data/vocabulary.json");if(r.ok)return await r.json()}catch(r){}throw new Error("Không thể tải dữ liệu từ vựng: "+n.message)}}async function It(){try{const n=await fetch("./data/meta.json");return n.ok?await n.json():null}catch(n){try{const r=await fetch("/data/meta.json");if(r.ok)return await r.json()}catch(r){}return null}}const L={NEW:"new",LEARNING:"learning",WEAK:"weak",REVIEW:"review",MASTERED:"mastered"};function Mt(n){return{id:n,state:L.NEW,correctCount:0,wrongCount:0,streak:0,lastReviewed:null,nextReview:Date.now(),ease:2.5,interval:0,difficulty:0}}function Q(n,r){const p={...n};for(const o of r)p[o.id]||(p[o.id]=Mt(o.id));return p}function Dt(n,r,p=0){const o=Date.now();let{ease:t,interval:s,streak:h,correctCount:v,wrongCount:l,state:a}=n;r?(v+=1,h+=1,a===L.NEW?(s=1,a=L.LEARNING):a===L.LEARNING?(s=h>=2?3:1,v>=3&&h>=2&&(a=L.REVIEW)):a===L.WEAK?(s=Math.max(1,Math.round(s*.5+1)),h>=2&&(a=L.REVIEW)):a===L.REVIEW?(s=Math.round(s*t),s>=21&&v>=5&&h>=3&&(a=L.MASTERED)):a===L.MASTERED&&(s=Math.round(s*t*1.1)),t=Math.min(2.8,t+.08),p&&p<3e3&&(t=Math.min(2.8,t+.02))):(l+=1,h=0,t=Math.max(1.3,t-.2),a===L.MASTERED||a===L.REVIEW?(s=1,a=L.WEAK):(L.LEARNING,s=0,a=L.WEAK)),s=Math.max(0,Math.min(s,180));const u=o+s*24*60*60*1e3,x=v+l,q=x>0?l/x:0,H=Math.min(1,Math.max(0,q*.7+(2.8-t)/1.5*.3));return x>=3&&q>.5&&a!==L.NEW&&(a=L.WEAK),{...n,state:a,correctCount:v,wrongCount:l,streak:h,lastReviewed:o,nextReview:u,ease:t,interval:s,difficulty:H}}function bt(n,r=Date.now()){return n.nextReview<=r}function Rt(n,r,p={}){const{size:o=20,mode:t="due",favorites:s=null}=p,h=Date.now(),v=Object.values(r);let l=[];if(t==="favorites"&&s){const a=new Set(s);l=n.filter(u=>a.has(u.id)).map(u=>({vocab:u,progress:r[u.id]}))}else if(t==="new")l=n.filter(a=>{const u=r[a.id];return u&&u.state===L.NEW}).map(a=>({vocab:a,progress:r[a.id]}));else if(t==="weak")l=v.filter(a=>a.state===L.WEAK).map(a=>({vocab:n.find(u=>u.id===a.id),progress:a})).filter(a=>a.vocab),l.sort((a,u)=>u.progress.wrongCount-a.progress.wrongCount);else if(t==="due"){const a=v.filter($=>bt($,h)),u=a.filter($=>$.state===L.WEAK),x=a.filter($=>$.state===L.LEARNING),q=a.filter($=>$.state===L.REVIEW),H=a.filter($=>$.state===L.NEW);if(l=[...u,...x,...q,...H].map($=>({vocab:n.find(A=>A.id===$.id),progress:$})).filter($=>$.vocab),l.length<o){const $=new Set(l.map(P=>P.vocab.id)),A=n.filter(P=>!$.has(P.id)).map(P=>({vocab:P,progress:r[P.id]}));A.sort((P,I)=>{const B={weak:0,learning:1,new:2,review:3,mastered:4};return(B[P.progress.state]||5)-(B[I.progress.state]||5)}),l=[...l,...A]}}else if(t==="random"){l=n.map(a=>({vocab:a,progress:r[a.id]}));for(let a=l.length-1;a>0;a--){const u=Math.floor(Math.random()*(a+1));[l[a],l[u]]=[l[u],l[a]]}}else l=n.map(a=>({vocab:a,progress:r[a.id]}));if(t!=="due"&&t!=="weak"){const a={};for(const R of l){const $=R.progress.state;a[$]||(a[$]=[]),a[$].push(R)}const u=Object.keys(a),x=[];let q=0,H=!0;for(;H&&x.length<l.length;){H=!1;for(const R of u)a[R][q]&&(x.push(a[R][q]),H=!0);q++}t!=="random"&&x.length===l.length&&(l=x)}return l.slice(0,o)}function tt(n){const r=Object.values(n),p=r.length,o={new:0,learning:0,weak:0,review:0,mastered:0};let t=0,s=0,h=0;const v=Date.now();for(const a of r)o[a.state]!==void 0&&o[a.state]++,t+=a.correctCount,s+=a.wrongCount,bt(a,v)&&h++;const l=t+s>0?Math.round(t/(t+s)*100):0;return{total:p,...o,due:h,correct:t,wrong:s,accuracy:l,learned:p-o.new}}const xt="flashcard-progress-v1",mt="flashcard-prefs-v1",yt="flashcard-favorites-v1",wt="flashcard-history-v1",kt="flashcard-streak-v1",et={sessionSize:20,keyboardShortcuts:!0,darkMode:!1,sound:!1};function st(){try{const n=localStorage.getItem(xt);if(!n)return{};const r=JSON.parse(n);return typeof r=="object"&&r!==null?r:{}}catch(n){return console.warn("Failed to load progress",n),{}}}function nt(n){try{localStorage.setItem(xt,JSON.stringify(n))}catch(r){throw console.warn("Cannot save progress (storage full?)",r),new Error("Không thể lưu tiến trình trên thiết bị này.")}}function it(){try{const n=localStorage.getItem(mt);return n?{...et,...JSON.parse(n)}:{...et}}catch(n){return{...et}}}function _(n){try{localStorage.setItem(mt,JSON.stringify(n))}catch(r){console.warn("Cannot save prefs",r)}}function rt(){try{const n=localStorage.getItem(yt);if(!n)return new Set;const r=JSON.parse(n);return new Set(Array.isArray(r)?r:[])}catch(n){return new Set}}function $t(n){try{localStorage.setItem(yt,JSON.stringify([...n]))}catch(r){console.warn("Cannot save favorites",r)}}function ot(){try{const n=localStorage.getItem(wt);if(!n)return[];const r=JSON.parse(n);return Array.isArray(r)?r:[]}catch(n){return[]}}function dt(n){try{const r=n.slice(-50);localStorage.setItem(wt,JSON.stringify(r))}catch(r){console.warn("Cannot save history",r)}}function lt(){try{const n=localStorage.getItem(kt);return n?JSON.parse(n):{current:0,longest:0,lastDate:null}}catch(n){return{current:0,longest:0,lastDate:null}}}function ct(n){try{localStorage.setItem(kt,JSON.stringify(n))}catch(r){console.warn("Cannot save streak",r)}}function ht(){return{version:1,exportedAt:new Date().toISOString(),progress:st(),prefs:it(),favorites:[...rt()],history:ot(),streak:lt()}}function At(n){if(!n||typeof n!="object")throw new Error("Invalid import format");if(n.version!==1)throw new Error("Unsupported version");if(n.progress&&typeof n.progress=="object"){for(const[r,p]of Object.entries(n.progress)){if(!p||typeof p!="object")throw new Error(`Invalid progress for ${r}`);if(typeof p.correctCount!="number"||typeof p.wrongCount!="number")throw new Error(`Invalid counts for ${r}`)}nt(n.progress)}n.prefs&&_(n.prefs),Array.isArray(n.favorites)&&$t(new Set(n.favorites)),Array.isArray(n.history)&&dt(n.history),n.streak&&ct(n.streak)}function gt(n,r,p){return n.map(o=>{const t=r[o.id];return{id:o.id,word:o.word,wordLower:o.word.toLowerCase(),meaningLower:(o.meaning||"").toLowerCase(),posLower:(o.pos||"").toLowerCase(),tagsLower:(o.tags||[]).map(s=>s.toLowerCase()).join(" "),state:t?t.state:"new",progress:t,fav:p?p.has(o.id):!1,entry:o}})}function Ot(n,r,p={}){const o=(r||"").toLowerCase().trim(),{state:t,pos:s,favoritesOnly:h,tag:v}=p;let l=n;if(t&&t!=="all")if(t==="due"){const a=Date.now();l=l.filter(u=>u.progress&&u.progress.nextReview<=a)}else t==="favorites"?l=l.filter(a=>a.fav):l=l.filter(a=>a.state===t);return s&&s!=="all"&&(l=l.filter(a=>a.posLower===s.toLowerCase())),h&&(l=l.filter(a=>a.fav)),v&&v!=="all"&&(l=l.filter(a=>a.tagsLower.includes(v.toLowerCase()))),o&&(l=l.map(a=>{let u=0;return a.wordLower===o?u+=100:a.wordLower.startsWith(o)?u+=80:a.wordLower.includes(o)&&(u+=60),a.meaningLower.includes(o)&&(u+=40,a.meaningLower.startsWith(o)&&(u+=10)),a.posLower.includes(o)&&(u+=5),a.tagsLower.includes(o)&&(u+=5),{...a,score:u}}).filter(a=>a.score>0).sort((a,u)=>u.score-a.score)),l}function Ht(n,r="az"){const p=[...n];switch(r){case"az":p.sort((o,t)=>o.word.localeCompare(t.word));break;case"za":p.sort((o,t)=>t.word.localeCompare(o.word));break;case"difficulty":p.sort((o,t)=>{var s,h;return(((s=t.progress)==null?void 0:s.difficulty)||0)-(((h=o.progress)==null?void 0:h.difficulty)||0)});break;case"newest":p.sort((o,t)=>{const s=parseInt(o.id,10)||0;return(parseInt(t.id,10)||0)-s});break;case"mostWrong":p.sort((o,t)=>{var s,h;return(((s=t.progress)==null?void 0:s.wrongCount)||0)-(((h=o.progress)==null?void 0:h.wrongCount)||0)});break;case"dueSoon":p.sort((o,t)=>{var s,h;return(((s=o.progress)==null?void 0:s.nextReview)||0)-(((h=t.progress)==null?void 0:h.nextReview)||0)});break}return p}const k={RECOGNITION:"recognition",RECALL:"recall",SPELLING:"spelling",CLOZE:"cloze",CONTEXT:"context"};function U(n){const r=[...n];for(let p=r.length-1;p>0;p--){const o=Math.floor(Math.random()*(p+1));[r[p],r[o]]=[r[o],r[p]]}return r}function at(n,r,p,o="meaning"){const t=n.filter(v=>v.id!==r.id),s=U(t),h=[];for(const v of s){if(h.length>=p)break;const l=o==="meaning"?v.meaning:v.word;l&&l!==r[o]&&h.push(v)}return h}function Pt(n,r,p,o=null){let t=o;if(!t){const v=p.state,l=Math.random();v==="new"?t=l<.7?k.RECOGNITION:k.RECALL:v==="learning"?l<.4?t=k.RECOGNITION:l<.7?t=k.RECALL:t=k.SPELLING:v==="weak"?l<.3?t=k.RECOGNITION:l<.6?t=k.RECALL:t=k.SPELLING:v==="review"?l<.25?t=k.RECOGNITION:l<.5?t=k.RECALL:l<.75?t=k.CLOZE:t=k.SPELLING:l<.3?t=k.CLOZE:l<.6?t=k.SPELLING:t=k.RECALL}const s=n.vocab;(t===k.CLOZE||t===k.CONTEXT)&&(!s.examples||s.examples.length===0)&&(t=Math.random()<.5?k.RECOGNITION:k.RECALL);let h={};if(t===k.RECOGNITION){const v=at(r,s,3,"meaning"),l=U([{id:s.id,text:s.meaning,correct:!0},...v.map(a=>({id:a.id,text:a.meaning,correct:!1}))]);h={mode:t,prompt:s.word,subPrompt:s.pos,options:l,answer:s.meaning,hint:null}}else if(t===k.RECALL){const v=at(r,s,3,"word"),l=U([{id:s.id,text:s.word,correct:!0},...v.map(a=>({id:a.id,text:a.word,correct:!1}))]);h={mode:t,prompt:s.meaning,subPrompt:`(${s.pos})`,options:l,answer:s.word,hint:null}}else if(t===k.SPELLING)h={mode:t,prompt:s.meaning,subPrompt:`${s.pos} • ${s.word.length} chữ cái`,options:null,answer:s.word,hint:s.word[0]+"•".repeat(s.word.length-1)};else if(t===k.CLOZE||t===k.CONTEXT){const v=s.examples&&s.examples[0]?s.examples[0]:null;let l="";if(v){const x=new RegExp(s.word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi");l=v.replace(x,"______")}else l=`______ : ${s.meaning}`;const a=at(r,s,3,"word"),u=U([{id:s.id,text:s.word,correct:!0},...a.map(x=>({id:x.id,text:x.word,correct:!1}))]);h={mode:t,prompt:l,subPrompt:s.pos,options:u,answer:s.word,hint:s.meaning}}return h}function jt(n,r){if(n.mode===k.SPELLING){const p=n.answer.toLowerCase().trim(),o=(r||"").toLowerCase().trim();return p===o}else{const p=n.options.find(o=>o.id===r||o.text===r);return p?p.correct:!1}}async function Wt(n){let r=[],p=null,o={},t=it(),s=rt(),h=ot(),v=lt(),l=[],a="learn",u=null,x=null,q={correct:0,wrong:0,startTime:null},H=null,R=!1;try{const[e,i]=await Promise.all([qt(),It()]);r=e,p=i}catch(e){n.innerHTML=`
      <div class="app-shell">
        <div style="max-width:600px;margin:80px auto;padding:32px;text-align:center">
          <div style="width:64px;height:64px;margin:0 auto 16px;background:var(--danger-light);border-radius:50%;display:grid;place-items:center;font-size:28px">⚠️</div>
          <h2 style="margin-bottom:12px;font-weight:800">Không thể tải dữ liệu từ vựng</h2>
          <p style="color:var(--text-muted);margin-bottom:24px;font-size:14px">${e.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Thử tải lại trang</button>
          <p style="margin-top:20px;font-size:12px;color:var(--text-light)">Kiểm tra file data/vocabulary.json tồn tại và đúng định dạng</p>
        </div>
      </div>`,console.error(e);return}o=Q(st(),r),nt(o),l=gt(r,o,s);function $(){document.documentElement.setAttribute("data-theme",t.darkMode?"dark":"light")}$();function A(){try{nt(o),$t(s),dt(h),ct(v),_(t),l=gt(r,o,s)}catch(e){I(e.message,"error")}}function P(){const e=new Date().toISOString().split("T")[0];if(v.lastDate!==e){const i=new Date(Date.now()-864e5).toISOString().split("T")[0];if(v.lastDate===i)v.current+=1;else if(!v.lastDate)v.current=1;else{const d=new Date(v.lastDate),c=new Date(e),m=Math.floor((c-d)/864e5);m===1?v.current+=1:m>1&&(v.current=1)}v.lastDate=e,v.longest=Math.max(v.longest,v.current),ct(v)}}function I(e,i="info"){const d=document.querySelector(".toast");d&&d.remove();const c=document.createElement("div");c.className="toast",c.innerHTML=`<span>${i==="error"?"⚠️":i==="success"?"✅":"💡"}</span><span>${S(e)}</span>`,document.body.appendChild(c),setTimeout(()=>{c.style.opacity="0",c.style.transform="translateX(-50%) translateY(10px)",setTimeout(()=>c.remove(),200)},3e3)}function B(){var i,d;const e=tt(o);n.innerHTML=`
      <div class="app-shell">
        <header class="header">
          <div class="header-inner">
            <a class="logo" href="#" aria-label="Trang chủ" onclick="event.preventDefault(); navigate('learn')">
              <span class="logo-icon">CA</span>
              <span class="logo-text">
                <span class="logo-title">Chuyên Anh</span>
                <span class="logo-sub">Flashcard • ${r.length} từ</span>
              </span>
            </a>
            <div class="header-meta">
              <span>📚 ${p?`${p.count||r.length}`:r.length} từ</span>
              <span class="dot"></span>
              <span title="Đến hạn">⏰ ${e.due}</span>
              <span class="dot"></span>
              <span title="Streak">🔥 ${v.current}</span>
            </div>
            <div class="header-actions">
              <button class="btn btn-ghost btn-sm" id="btn-theme" title="Đổi giao diện (Dark/Light)" aria-label="Đổi theme">🌓</button>
              <button class="btn btn-ghost btn-sm" id="btn-export" title="Xuất dữ liệu" aria-label="Export">⤓ Export</button>
            </div>
          </div>
        </header>
        <div class="main">
          <aside class="sidebar">
            <div class="card">
              <div class="card-header"><h3>Điều hướng</h3></div>
              <div class="card-padding" style="padding:10px">
                <nav class="nav" id="nav" role="navigation" aria-label="Main navigation">
                  <button class="nav-btn ${a==="learn"?"active":""}" data-view="learn" aria-current="${a==="learn"?"page":""}">
                    <span class="nav-icon">📖</span><span>Học</span><span class="badge">${e.due}</span>
                  </button>
                  <button class="nav-btn ${a==="dashboard"?"active":""}" data-view="dashboard">
                    <span class="nav-icon">📊</span><span>Dashboard</span>
                  </button>
                  <button class="nav-btn ${a==="search"?"active":""}" data-view="search">
                    <span class="nav-icon">🔍</span><span>Tra cứu</span><span class="badge">${r.length}</span>
                  </button>
                  <button class="nav-btn ${a==="settings"?"active":""}" data-view="settings">
                    <span class="nav-icon">⚙️</span><span>Cài đặt</span>
                  </button>
                </nav>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Tiến độ tổng quan</h3><span style="font-size:11px;color:var(--text-muted)">${e.accuracy}% chính xác</span></div>
              <div class="card-padding">
                <div class="stats-grid">
                  <div class="stat"><div class="stat-value">${e.total}</div><div class="stat-label">Tổng</div></div>
                  <div class="stat"><div class="stat-value">${e.mastered}</div><div class="stat-label">Thành thạo</div></div>
                  <div class="stat"><div class="stat-value">${e.learning+e.review}</div><div class="stat-label">Đang học</div></div>
                  <div class="stat"><div class="stat-value">${e.weak}</div><div class="stat-label">Từ yếu</div></div>
                </div>
                <div style="margin-top:14px">
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px">
                    <span>Độ chính xác</span><span style="font-weight:700;color:var(--text)">${e.accuracy}%</span>
                  </div>
                  <div style="height:8px;background:var(--bg-muted);border-radius:99px;overflow:hidden;border:1px solid var(--border)">
                    <div style="height:100%;width:${e.accuracy}%;background:var(--primary-gradient);border-radius:99px;transition:width 0.5s var(--ease)"></div>
                  </div>
                </div>
                <div style="margin-top:12px;display:flex;gap:6px;height:22px;border-radius:99px;overflow:hidden;background:var(--bg-muted);border:1px solid var(--border);padding:2px">
                  <div style="flex:${e.new||.5};background:#94a3b8;border-radius:99px" title="New: ${e.new}"></div>
                  <div style="flex:${e.learning||.5};background:#fbbf24;border-radius:99px" title="Learning: ${e.learning}"></div>
                  <div style="flex:${e.weak||.5};background:#f87171;border-radius:99px" title="Weak: ${e.weak}"></div>
                  <div style="flex:${e.review||.5};background:#60a5fa;border-radius:99px" title="Review: ${e.review}"></div>
                  <div style="flex:${e.mastered||.5};background:#4ade80;border-radius:99px" title="Mastered: ${e.mastered}"></div>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Phím tắt</h3></div>
              <div class="card-padding">
                <div style="font-size:12px;color:var(--text-muted);display:grid;gap:8px">
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Chọn đáp án</span><span class="kbd">1-4</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Xác nhận / Tiếp</span><span class="kbd">Enter</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Tiếp tục</span><span class="kbd">Space</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Bỏ qua</span><span class="kbd">N</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Yêu thích</span><span class="kbd">F</span></div>
                </div>
              </div>
            </div>
          </aside>
          <main class="content" id="content" role="main"></main>
        </div>
        <footer class="footer">
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;align-items:center">
            <span>📚 Vocabulary: ${r.length} words</span>
            <span style="width:4px;height:4px;background:var(--border-strong);border-radius:50%"></span>
            <span>🔄 Updated: ${(p==null?void 0:p.updated)||"local"}</span>
            <span style="width:4px;height:4px;background:var(--border-strong);border-radius:50%"></span>
            <span>🔨 Build: ${(p==null?void 0:p.commit)||"dev"}</span>
          </div>
          <div style="margin-top:8px;opacity:0.8">Frontend-only • localStorage • Spaced repetition • Active recall • Interleaving</div>
        </footer>
      </div>
    `,n.querySelectorAll("[data-view]").forEach(c=>{c.addEventListener("click",()=>F(c.dataset.view))}),(i=n.querySelector("#btn-theme"))==null||i.addEventListener("click",()=>{t.darkMode=!t.darkMode,_(t),$(),I(t.darkMode?"Đã bật Dark mode":"Đã bật Light mode","success")}),(d=n.querySelector("#btn-export"))==null||d.addEventListener("click",()=>{const c=ht(),m=new Blob([JSON.stringify(c,null,2)],{type:"application/json"}),E=URL.createObjectURL(m),T=document.createElement("a");T.href=E,T.download=`flashcard-backup-${new Date().toISOString().split("T")[0]}.json`,T.click(),URL.revokeObjectURL(E),I("Đã xuất dữ liệu","success")}),Z()}function F(e){a=e,n.querySelectorAll(".nav-btn").forEach(i=>{const d=i.dataset.view===e;i.classList.toggle("active",d),i.setAttribute("aria-current",d?"page":"")}),Z(),window.scrollTo({top:0,behavior:"smooth"})}function Z(){const e=n.querySelector("#content");e&&(a==="learn"?pt(e):a==="dashboard"?Et(e):a==="search"?Lt(e):a==="settings"&&Tt(e))}function pt(e){if(u&&u.length>0){Y(e);return}const i=tt(o),d=i.due,c=i.new,m=i.weak,E=s.size;e.innerHTML=`
      <div class="content-header">
        <h1 class="content-title">Học từ vựng Chuyên Anh</h1>
        <p class="content-subtitle">Hệ thống học thông minh ưu tiên từ yếu và đến hạn, áp dụng active recall, spaced repetition và interleaving để tối ưu ghi nhớ lâu dài.</p>
      </div>
      <div class="session-options">
        <button class="session-card" data-session="due" aria-label="Học từ đến hạn">
          <div class="session-card-icon">📅</div>
          <h4>Đến hạn hôm nay</h4>
          <p>Ôn từ đã đến lúc cần nhớ lại để củng cố trí nhớ dài hạn</p>
          <div class="count">⏰ ${d} từ</div>
        </button>
        <button class="session-card" data-session="weak" aria-label="Học từ yếu">
          <div class="session-card-icon">⚠️</div>
          <h4>Từ yếu</h4>
          <p>Tập trung vào từ hay sai, tăng tần suất xuất hiện</p>
          <div class="count">🎯 ${m} từ</div>
        </button>
        <button class="session-card" data-session="new" aria-label="Học từ mới">
          <div class="session-card-icon">🆕</div>
          <h4>Từ mới</h4>
          <p>Khám phá từ chưa từng gặp, bắt đầu hành trình ghi nhớ</p>
          <div class="count">✨ ${c} từ</div>
        </button>
        <button class="session-card" data-session="random" aria-label="Học ngẫu nhiên">
          <div class="session-card-icon">🎲</div>
          <h4>Ngẫu nhiên</h4>
          <p>Ôn tập đa dạng, trộn lẫn các loại từ để tăng phân biệt</p>
          <div class="count">🔀 ${r.length} từ</div>
        </button>
        <button class="session-card" data-session="favorites" aria-label="Học từ yêu thích">
          <div class="session-card-icon">⭐</div>
          <h4>Yêu thích</h4>
          <p>Ôn lại những từ bạn đã đánh dấu quan trọng</p>
          <div class="count">💛 ${E} từ</div>
        </button>
        <button class="session-card" data-session="quick10" aria-label="Học nhanh 10 từ">
          <div class="session-card-icon">⚡</div>
          <h4>Nhanh 10 từ</h4>
          <p>Phiên học siêu tốc, phù hợp giờ giải lao</p>
          <div class="count">⚡ 10 từ</div>
        </button>
        <button class="session-card" data-session="quick20" aria-label="Học 20 từ">
          <div class="session-card-icon">📚</div>
          <h4>20 từ</h4>
          <p>Cân bằng thời gian và hiệu quả, khuyến nghị hàng ngày</p>
          <div class="count">📖 20 từ</div>
        </button>
        <button class="session-card" data-session="quick30" aria-label="Học 30 từ">
          <div class="session-card-icon">🚀</div>
          <h4>30 từ</h4>
          <p>Phiên học sâu, thử thách trí nhớ</p>
          <div class="count">🔥 30 từ</div>
        </button>
      </div>
      <div class="card">
        <div class="card-header"><h3>💡 Gợi ý học tập hiệu quả</h3></div>
        <div class="card-padding">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:var(--primary-light);border-radius:8px;display:grid;place-items:center;flex-shrink:0">🧠</div><div><div style="font-weight:700;font-size:13px">Active Recall</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Cố gắng nhớ trước khi chọn đáp án, não hoạt động mạnh hơn khi tự truy xuất</div></div></div>
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:#d1fae5;border-radius:8px;display:grid;place-items:center;flex-shrink:0">⏱️</div><div><div style="font-weight:700;font-size:13px">Spaced Repetition</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Từ sai xuất hiện lại sớm, từ đúng được giãn cách để tối ưu đường cong quên</div></div></div>
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:#fef3c7;border-radius:8px;display:grid;place-items:center;flex-shrink:0">🔀</div><div><div style="font-weight:700;font-size:13px">Interleaving</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Các loại từ trộn lẫn giúp phân biệt tốt hơn so với học theo cụm</div></div></div>
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:#dbeafe;border-radius:8px;display:grid;place-items:center;flex-shrink:0">💬</div><div><div style="font-weight:700;font-size:13px">Feedback ngay</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Xem lại nghĩa, ví dụ và lỗi sai ngay sau mỗi câu để điều chỉnh</div></div></div>
          </div>
        </div>
      </div>
    `,e.querySelectorAll("[data-session]").forEach(T=>{T.addEventListener("click",()=>St(T.dataset.session))})}function St(e){let i="due",d=t.sessionSize||20;e==="due"?(i="due",d=20):e==="weak"?(i="weak",d=20):e==="new"?(i="new",d=20):e==="random"?(i="random",d=20):e==="favorites"?(i="favorites",d=20):e==="quick10"?(i="due",d=10):e==="quick20"?(i="due",d=20):e==="quick30"&&(i="due",d=30);const c=Rt(r,o,{size:d,mode:i,favorites:s});if(c.length===0){I(e==="favorites"?"Chưa có từ yêu thích nào. Hãy đánh dấu ⭐ ở trang tra cứu!":"Không có từ nào cho phiên này. Thử chế độ khác nhé!","info");return}u=c,q={correct:0,wrong:0,startTime:Date.now(),total:c.length,mode:i},R=!1,J(),Z(),P()}function J(){if(!u||u.length===0){vt();return}const e=u[0];x=Pt(e,r,e.progress),H=Date.now(),R=!1}function Y(e){var D,K;if(!u||u.length===0){pt(e);return}const i=u[0],d=x,c=i.progress,m=u.length,E=q.total,T=E-m,f=E>0?Math.round(T/E*100):0,C=s.has(i.vocab.id);e.innerHTML=`
      <div class="flashcard-container">
        <div class="progress-bar" role="progressbar" aria-valuenow="${f}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${f}%"></div></div>
        <div class="flashcard">
          <div class="flashcard-header">
            <span style="display:flex;align-items:center;gap:8px"><span style="background:var(--bg-muted);border:1px solid var(--border);padding:3px 10px;border-radius:99px;font-weight:700;font-size:12px">${T+1} / ${E}</span><span style="color:var(--text-muted)">• ${m} còn lại</span></span>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="vocab-state state-${c.state}" title="Trạng thái: ${c.state}">${c.state}</span>
              <button class="fav-btn ${C?"active":""}" id="fav-btn" title="Yêu thích (F)" aria-label="Yêu thích">${C?"★":"☆"}</button>
              <button class="btn btn-ghost btn-sm" id="skip-btn" title="Bỏ qua (N)">Bỏ qua ⏭️</button>
            </div>
          </div>
          <div class="flashcard-body">
            <div class="flashcard-mode">${d.mode} • ${S(i.vocab.pos)} • ${S(i.vocab.word.length+" chữ")}</div>
            <div class="flashcard-prompt">${S(d.prompt)}</div>
            ${d.subPrompt?`<div class="flashcard-sub">${S(d.subPrompt)}</div>`:""}
            <div id="question-area"></div>
            <div id="feedback-area"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:12px;color:var(--text-muted);flex-wrap:wrap;gap:8px">
          <span style="display:flex;gap:12px;flex-wrap:wrap">
            <span>🔥 Khó: ${Math.round((c.difficulty||0)*100)}%</span>
            <span>❌ Sai: ${c.wrongCount}</span>
            <span>✅ Đúng: ${c.correctCount}</span>
            <span>⚡ Streak: ${c.streak}</span>
          </span>
          <span>Nhấn <span class="kbd">1-4</span> để chọn • <span class="kbd">Enter</span> để tiếp</span>
        </div>
      </div>
    `;const N=e.querySelector("#question-area"),y=e.querySelector("#feedback-area");if(d.mode==="spelling"){N.innerHTML=`
        <div class="spelling-input">
          <input type="text" id="spell-input" placeholder="Gõ từ tiếng Anh..." autocomplete="off" spellcheck="false" aria-label="Nhập từ tiếng Anh" />
          <button class="btn btn-primary" id="submit-spell">Xác nhận ↵</button>
        </div>
        ${d.hint?`<div style="font-size:12px;color:var(--text-light);margin-top:8px;display:flex;gap:6px;align-items:center"><span>💡 Gợi ý:</span><code style="background:var(--bg-muted);padding:2px 8px;border-radius:99px;border:1px solid var(--border);font-family:var(--font-mono)">${S(d.hint)}</code></div>`:""}
      `;const j=N.querySelector("#spell-input"),z=N.querySelector("#submit-spell");setTimeout(()=>j.focus(),80);const w=()=>{R||ut(j.value.trim(),y,N)};z.addEventListener("click",w),j.addEventListener("keydown",b=>{b.key==="Enter"&&(b.preventDefault(),w())})}else{const j=d.options.map((z,w)=>`
        <button class="option-btn" data-id="${S(z.id)}" data-index="${w}" aria-label="Lựa chọn ${w+1}: ${S(z.text)}">
          <span class="option-index">${w+1}</span>
          <span style="flex:1">${S(z.text)}</span>
        </button>
      `).join("");N.innerHTML=`<div class="flashcard-options" role="radiogroup">${j}</div>`,N.querySelectorAll(".option-btn").forEach(z=>{z.addEventListener("click",()=>{R||ut(z.dataset.id,y,N)})})}(D=e.querySelector("#fav-btn"))==null||D.addEventListener("click",()=>{s.has(i.vocab.id)?(s.delete(i.vocab.id),I("Đã bỏ yêu thích","info")):(s.add(i.vocab.id),I("Đã thêm vào yêu thích ⭐","success")),A(),Y(e)}),(K=e.querySelector("#skip-btn"))==null||K.addEventListener("click",()=>{const j=u.shift();u.push(j),J(),Y(e),I("Đã bỏ qua, sẽ gặp lại cuối phiên","info")}),e.dataset.hasQuestion="1"}function ut(e,i,d){var N;if(!x||!u||R)return;R=!0;const c=u[0],m=jt(x,e),E=Date.now()-H;d.querySelectorAll("button").forEach(y=>y.disabled=!0);const T=d.querySelector("input");T&&(T.disabled=!0),x.mode!=="spelling"&&d.querySelectorAll(".option-btn").forEach(y=>{const D=x.options.find(K=>K.id===y.dataset.id);D!=null&&D.correct&&y.classList.add("correct"),y.dataset.id===e&&!m&&y.classList.add("wrong")});const f=Dt(c.progress,m,E);o[c.vocab.id]=f,A(),m?q.correct++:q.wrong++;const C=c.vocab;i.innerHTML=`
      <div class="feedback ${m?"correct":"wrong"}" role="alert">
        <div class="answer">${m?"✅ Chính xác! Tuyệt vời!":`❌ Chưa đúng. Đáp án: <strong>${S(x.answer)}</strong>`}</div>
        <div class="detail">
          <div style="font-size:14px;margin:8px 0"><strong style="font-size:16px">${S(C.word)}</strong> <span style="background:var(--bg-muted);padding:2px 8px;border-radius:99px;font-size:11px;border:1px solid var(--border)">${S(C.pos)}</span> — ${S(C.meaning)}</div>
          ${C.examples&&C.examples.length?`<div style="margin-top:8px;padding:10px;background:rgba(0,0,0,0.03);border-radius:8px;border-left:3px solid var(--border-strong)"><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:700">Ví dụ</span><div style="font-style:italic;margin-top:4px">${S(C.examples[0])}</div></div>`:""}
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px">
            <span style="background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">🔥 Streak: ${f.streak}</span>
            <span style="background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">⏰ Lần tới: ${zt(f.nextReview)}</span>
            <span style="background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">📊 Khó: ${Math.round(f.difficulty*100)}%</span>
          </div>
        </div>
        <button class="btn btn-primary w-full mt-4" id="next-btn" style="margin-top:16px">Tiếp tục <span class="kbd" style="margin-left:8px;background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.2);color:white">Enter</span></button>
      </div>
    `,(N=i.querySelector("#next-btn"))==null||N.addEventListener("click",()=>{if(u.shift(),u.length===0)vt();else{J();const y=document.querySelector("#content");y&&Y(y)}}),setTimeout(()=>{var y;return(y=i.querySelector("#next-btn"))==null?void 0:y.focus()},120)}function vt(){var T,f;const e=q.total,i=q.correct,d=q.wrong,c=e>0?Math.round(i/e*100):0,m=Math.round((Date.now()-q.startTime)/1e3);h.push({date:new Date().toISOString(),total:e,correct:i,wrong:d,accuracy:c,durationSec:m,mode:q.mode}),dt(h);const E=document.querySelector("#content");E&&(E.innerHTML=`
      <div style="max-width:640px;margin:0 auto;text-align:center">
        <div class="card" style="padding:36px 28px;overflow:visible">
          <div style="width:80px;height:80px;margin:0 auto 20px;background:var(--success-light);border-radius:50%;display:grid;place-items:center;font-size:40px;border:3px solid var(--success);animation:correctPop 0.6s var(--ease-spring)">🎉</div>
          <h2 style="font-size:28px;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px">Hoàn thành xuất sắc!</h2>
          <p style="color:var(--text-muted);margin-bottom:24px;font-size:14px">Bạn đã học ${e} từ trong ${m}s • Chế độ: ${q.mode}</p>
          <div class="dashboard-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
            <div class="dashboard-card" style="padding:16px"><h4>Chính xác</h4><div class="value" style="font-size:24px;color:${c>=80?"var(--success)":c>=50?"var(--warning)":"var(--danger)"}">${c}%</div></div>
            <div class="dashboard-card" style="padding:16px"><h4>Đúng</h4><div class="value" style="font-size:24px;color:var(--success)">${i}</div></div>
            <div class="dashboard-card" style="padding:16px"><h4>Sai</h4><div class="value" style="font-size:24px;color:var(--danger)">${d}</div></div>
            <div class="dashboard-card" style="padding:16px"><h4>Thời gian</h4><div class="value" style="font-size:24px">${m}s</div></div>
          </div>
          <div style="margin-top:20px;padding:14px;background:var(--bg-muted);border-radius:var(--radius-sm);border:1px dashed var(--border);font-size:13px;color:var(--text-muted)">
            ${c>=90?"🌟 Xuất sắc! Bạn đang làm rất tốt, hãy duy trì streak!":c>=70?"💪 Khá tốt! Ôn lại từ sai để cải thiện thêm nhé.":"📚 Cố gắng! Từ yếu sẽ được ưu tiên ở phiên sau."}
          </div>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
            <button class="btn btn-primary" id="continue-btn">📖 Học tiếp</button>
            <button class="btn btn-ghost" id="dashboard-btn">📊 Xem Dashboard</button>
          </div>
        </div>
      </div>
    `,(T=E.querySelector("#continue-btn"))==null||T.addEventListener("click",()=>{u=null,x=null,F("learn")}),(f=E.querySelector("#dashboard-btn"))==null||f.addEventListener("click",()=>{u=null,x=null,F("dashboard")}),u=null,x=null)}function Et(e){const i=tt(o),d=h.slice(-10).reverse();e.innerHTML=`
      <div class="content-header">
        <h1 class="content-title">Dashboard tiến độ</h1>
        <p class="content-subtitle">Theo dõi hành trình học tập, streak và lịch sử ôn tập của bạn</p>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-card"><h4>📚 Tổng từ</h4><div class="value">${i.total}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Toàn bộ kho từ vựng</div></div>
        <div class="dashboard-card"><h4>✅ Đã học</h4><div class="value">${i.learned}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">${i.total?Math.round(i.learned/i.total*100):0}% tổng số</div></div>
        <div class="dashboard-card"><h4>🏆 Thành thạo</h4><div class="value">${i.mastered}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">${i.total?Math.round(i.mastered/i.total*100):0}% • ≥21 ngày</div></div>
        <div class="dashboard-card"><h4>⏰ Đến hạn</h4><div class="value" style="color:${i.due>0?"var(--warning)":"var(--success)"}">${i.due}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Cần ôn hôm nay</div></div>
        <div class="dashboard-card"><h4>⚠️ Từ yếu</h4><div class="value" style="color:var(--danger)">${i.weak}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Sai nhiều, cần chú ý</div></div>
        <div class="dashboard-card"><h4>🎯 Chính xác</h4><div class="value">${i.accuracy}%</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">${i.correct} đúng / ${i.wrong} sai</div></div>
        <div class="dashboard-card"><h4>🔥 Streak</h4><div class="value">🔥 ${v.current}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Ngày liên tiếp</div></div>
        <div class="dashboard-card"><h4>🏅 Dài nhất</h4><div class="value">${v.longest}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Kỷ lục cá nhân</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div class="card">
          <div class="card-header"><h3>📈 Phân bố trạng thái</h3></div>
          <div class="card-padding">
            <div style="display:flex;gap:4px;height:28px;border-radius:99px;overflow:hidden;background:var(--bg-muted);border:1px solid var(--border);padding:3px">
              <div style="flex:${i.new||.5};background:#94a3b8;border-radius:99px;transition:all 0.5s" title="New: ${i.new}"></div>
              <div style="flex:${i.learning||.5};background:#fbbf24;border-radius:99px;transition:all 0.5s" title="Learning: ${i.learning}"></div>
              <div style="flex:${i.weak||.5};background:#f87171;border-radius:99px;transition:all 0.5s" title="Weak: ${i.weak}"></div>
              <div style="flex:${i.review||.5};background:#60a5fa;border-radius:99px;transition:all 0.5s" title="Review: ${i.review}"></div>
              <div style="flex:${i.mastered||.5};background:#4ade80;border-radius:99px;transition:all 0.5s" title="Mastered: ${i.mastered}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;font-size:11px">
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#94a3b8;border-radius:50%"></span>New ${i.new}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#fbbf24;border-radius:50%"></span>Learning ${i.learning}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#f87171;border-radius:50%"></span>Weak ${i.weak}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#60a5fa;border-radius:50%"></span>Review ${i.review}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#4ade80;border-radius:50%"></span>Mastered ${i.mastered}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📅 Lịch sử học</h3><span style="font-size:11px;color:var(--text-muted)">${h.length} phiên</span></div>
          <div class="card-padding" style="max-height:240px;overflow:auto">
            ${d.length===0?'<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📭</div><h3>Chưa có phiên học</h3><p>Bắt đầu học để xem lịch sử ở đây</p></div>':`
              <div style="display:grid;gap:10px">
                ${d.map(c=>`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-muted);border-radius:10px;border:1px solid var(--border)">
                    <div><div style="font-weight:600;font-size:13px">${new Date(c.date).toLocaleDateString("vi-VN")} • ${c.mode} • ${c.total} từ</div><div style="font-size:11px;color:var(--text-muted)">${new Date(c.date).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} • ${c.durationSec}s</div></div>
                    <span style="font-weight:800;font-size:13px;padding:4px 10px;border-radius:99px;background:${c.accuracy>=80?"var(--success-light)":c.accuracy>=50?"var(--warning-light)":"var(--danger-light)"};color:${c.accuracy>=80?"var(--success)":c.accuracy>=50?"var(--warning)":"var(--danger)"};border:1px solid ${c.accuracy>=80?"rgba(5,150,105,0.2)":c.accuracy>=50?"rgba(217,119,6,0.2)":"rgba(220,38,38,0.2)"}">${c.accuracy}%</span>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>
      </div>
    `}function Lt(e){e.innerHTML=`
      <div class="content-header">
        <h1 class="content-title">Tra cứu từ vựng</h1>
        <p class="content-subtitle">Tìm kiếm nhanh theo tiếng Anh, tiếng Việt, POS, tag, trạng thái học • ${r.length} từ</p>
      </div>
      <div class="search-bar">
        <input type="text" id="search-input" class="search-input" placeholder="Tìm từ, nghĩa, ví dụ... (VD: meticulous, tỉ mỉ)" aria-label="Tìm kiếm từ vựng" />
        <button class="btn btn-ghost" id="clear-search">✕ Xóa</button>
      </div>
      <div class="filters">
        <select id="filter-state" class="filter-select" aria-label="Lọc theo trạng thái">
          <option value="all">📚 Tất cả trạng thái</option>
          <option value="new">🆕 New</option>
          <option value="learning">📖 Learning</option>
          <option value="weak">⚠️ Weak</option>
          <option value="review">🔄 Review</option>
          <option value="mastered">🏆 Mastered</option>
          <option value="due">⏰ Đến hạn</option>
          <option value="favorites">⭐ Yêu thích</option>
        </select>
        <select id="filter-sort" class="filter-select" aria-label="Sắp xếp">
          <option value="az">🔤 A → Z</option>
          <option value="za">🔤 Z → A</option>
          <option value="difficulty">🔥 Độ khó</option>
          <option value="newest">🆕 Mới nhất</option>
          <option value="mostWrong">❌ Sai nhiều nhất</option>
          <option value="dueSoon">⏰ Đến hạn sớm</option>
        </select>
        <select id="filter-pos" class="filter-select" aria-label="Lọc theo từ loại">
          <option value="all">🏷️ Tất cả POS</option>
          <option value="n">n - danh từ</option>
          <option value="v">v - động từ</option>
          <option value="adj">adj - tính từ</option>
          <option value="adv">adv - trạng từ</option>
          <option value="phrase">phrase</option>
          <option value="collocation">collocation</option>
        </select>
      </div>
      <div id="search-results" class="vocab-list"></div>
      <div id="search-pagination" style="margin-top:20px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap"></div>
      <div id="word-modal" class="hidden"></div>
    `;const i=e.querySelector("#search-input"),d=e.querySelector("#filter-state"),c=e.querySelector("#filter-sort"),m=e.querySelector("#filter-pos"),E=e.querySelector("#search-results"),T=e.querySelector("#search-pagination"),f=e.querySelector("#word-modal");let C=1;const N=50;let y=[];function D(){const z=i.value,w={state:d.value,pos:m.value};let b=Ot(l,z,w);b=Ht(b,c.value),y=b,C=1,K()}function K(){const z=y.length,w=Math.ceil(z/N),b=(C-1)*N,X=y.slice(b,b+N);if(z===0){E.innerHTML='<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Không tìm thấy kết quả</h3><p>Thử từ khóa khác hoặc đổi bộ lọc</p></div>',T.innerHTML="";return}if(E.innerHTML=`
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
          <span>📊 ${z} kết quả • Trang ${C}/${w}</span>
          <span>Hiển thị ${X.length} từ</span>
        </div>
        ${X.map(g=>`
          <div class="vocab-item" data-id="${g.id}" role="button" tabindex="0" aria-label="Xem chi tiết ${S(g.word)}">
            <span class="vocab-word">${S(g.word)}</span>
            <span class="vocab-pos">${S(g.entry.pos)}</span>
            <span class="vocab-meaning" title="${S(g.entry.meaning)}">${S(g.entry.meaning)}</span>
            <span class="vocab-state state-${g.state}">${g.state}</span>
            <button class="fav-btn ${g.fav?"active":""}" data-fav="${g.id}" aria-label="${g.fav?"Bỏ yêu thích":"Yêu thích"}">${g.fav?"★":"☆"}</button>
          </div>
        `).join("")}
      `,w>1){let g="",M=Math.max(1,C-Math.floor(3.5)),G=Math.min(w,M+7-1);G-M+1<7&&(M=Math.max(1,G-7+1)),M>1&&(g+='<button class="btn btn-ghost btn-sm" data-page="1">1</button><span style="padding:6px">...</span>');for(let O=M;O<=G;O++)g+=`<button class="btn ${O===C?"btn-primary":"btn-ghost"} btn-sm" data-page="${O}">${O}</button>`;G<w&&(g+=`<span style="padding:6px">...</span><button class="btn btn-ghost btn-sm" data-page="${w}">${w}</button>`),T.innerHTML=g,T.querySelectorAll("[data-page]").forEach(O=>{O.addEventListener("click",()=>{C=parseInt(O.dataset.page),K(),window.scrollTo({top:0,behavior:"smooth"})})})}else T.innerHTML="";E.querySelectorAll("[data-fav]").forEach(g=>{g.addEventListener("click",W=>{W.stopPropagation();const M=g.dataset.fav;s.has(M)?(s.delete(M),I("Đã bỏ yêu thích","info")):(s.add(M),I("Đã thêm yêu thích ⭐","success")),A(),D()})}),E.querySelectorAll(".vocab-item").forEach(g=>{const W=()=>j(g.dataset.id);g.addEventListener("click",M=>{M.target.closest("[data-fav]")||W()}),g.addEventListener("keydown",M=>{(M.key==="Enter"||M.key===" ")&&(M.preventDefault(),W())})})}function j(z){var W,M,G,O;const w=r.find(V=>V.id===z),b=o[z];if(!w)return;const X=s.has(z);f.innerHTML=`
        <div class="modal-overlay" id="modal-overlay">
          <div class="modal" role="dialog" aria-modal="true" aria-label="Chi tiết từ ${S(w.word)}">
            <div class="modal-header">
              <h3 style="font-weight:800;font-size:16px">${S(w.word)} <span style="font-weight:500;color:var(--text-muted);font-size:12px">${S(w.pos)}</span></h3>
              <button class="btn btn-ghost btn-sm" id="close-modal" aria-label="Đóng">✕</button>
            </div>
            <div class="modal-body">
              <div style="font-size:14px;margin-bottom:16px"><strong>Nghĩa:</strong> ${S(w.meaning)}</div>
              ${w.examples&&w.examples.length?`<div style="margin-bottom:16px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:700;margin-bottom:6px">Ví dụ</div><div style="font-style:italic;background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)">${S(w.examples[0])}</div></div>`:'<div style="font-size:12px;color:var(--text-light);margin-bottom:16px">Chưa có ví dụ</div>'}
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Trạng thái</div><div style="font-weight:700;margin-top:2px"><span class="vocab-state state-${(b==null?void 0:b.state)||"new"}">${(b==null?void 0:b.state)||"new"}</span></div></div>
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Độ khó</div><div style="font-weight:700;margin-top:2px">${Math.round(((b==null?void 0:b.difficulty)||0)*100)}%</div></div>
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Đúng / Sai</div><div style="font-weight:700;margin-top:2px">${(b==null?void 0:b.correctCount)||0} / ${(b==null?void 0:b.wrongCount)||0}</div></div>
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Streak</div><div style="font-weight:700;margin-top:2px">${(b==null?void 0:b.streak)||0}</div></div>
              </div>
              <div style="display:flex;gap:10px">
                <button class="btn ${X?"btn-ghost":"btn-primary"} flex-1" id="modal-fav" style="flex:1">${X?"☆ Bỏ yêu thích":"★ Yêu thích"}</button>
                <button class="btn btn-ghost" id="modal-study" style="flex:1">📖 Học từ này</button>
              </div>
            </div>
          </div>
        </div>
      `,f.classList.remove("hidden");const g=()=>{f.classList.add("hidden"),f.innerHTML=""};(W=f.querySelector("#close-modal"))==null||W.addEventListener("click",g),(M=f.querySelector("#modal-overlay"))==null||M.addEventListener("click",V=>{V.target.id==="modal-overlay"&&g()}),(G=f.querySelector("#modal-fav"))==null||G.addEventListener("click",()=>{s.has(z)?s.delete(z):s.add(z),A(),D(),g(),I(s.has(z)?"Đã thêm yêu thích ⭐":"Đã bỏ yêu thích","success")}),(O=f.querySelector("#modal-study"))==null||O.addEventListener("click",()=>{g(),u=[{vocab:w,progress:o[z]}],q={correct:0,wrong:0,startTime:Date.now(),total:1,mode:"single"},J(),F("learn")}),document.addEventListener("keydown",function V(Nt){Nt.key==="Escape"&&(g(),document.removeEventListener("keydown",V))})}i.addEventListener("input",Ct(D,180)),d.addEventListener("change",D),c.addEventListener("change",D),m.addEventListener("change",D),e.querySelector("#clear-search").addEventListener("click",()=>{i.value="",D(),i.focus()}),D(),setTimeout(()=>i.focus(),100)}function Tt(e){var i,d,c,m,E,T;e.innerHTML=`
      <div class="content-header">
        <h1 class="content-title">Cài đặt & Dữ liệu</h1>
        <p class="content-subtitle">Quản lý tiến trình học, backup và tùy chọn cá nhân</p>
      </div>
      <div style="display:grid;gap:18px;max-width:720px">
        <div class="card">
          <div class="card-header"><h3>💾 Dữ liệu học tập</h3><span style="font-size:11px;background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">${Object.keys(o).length} từ đã khởi tạo</span></div>
          <div class="card-padding">
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
              <button class="btn btn-ghost" id="export-btn">⤓ Export progress</button>
              <label class="btn btn-ghost" style="cursor:pointer">
                ⤒ Import progress
                <input type="file" id="import-file" accept=".json" style="display:none" />
              </label>
              <button class="btn btn-ghost" id="reset-btn" style="color:var(--danger);border-color:rgba(220,38,38,0.2);background:var(--danger-light)">🗑️ Reset tất cả</button>
            </div>
            <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px dashed var(--border);font-size:12px;color:var(--text-muted);line-height:1.5">
              <div>• <strong>Export:</strong> Tải file JSON chứa toàn bộ tiến trình, yêu thích, streak, lịch sử</div>
              <div>• <strong>Import:</strong> Khôi phục từ file backup, sẽ ghi đè dữ liệu hiện tại sau khi validate</div>
              <div>• <strong>Reset:</strong> Xóa toàn bộ localStorage, không thể hoàn tác</div>
              <div style="margin-top:6px">Dữ liệu lưu trong <code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;border:1px solid var(--border)">localStorage</code> trình duyệt, không gửi lên server</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>🎨 Tùy chọn giao diện</h3></div>
          <div class="card-padding">
            <div style="display:grid;gap:16px">
              <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500;cursor:pointer">
                <span style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;background:var(--bg-muted);border-radius:8px;display:grid;place-items:center">🌓</span> Dark mode</span>
                <input type="checkbox" id="opt-dark" ${t.darkMode?"checked":""} style="width:20px;height:20px;accent-color:var(--primary)" />
              </label>
              <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500;cursor:pointer">
                <span style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;background:var(--bg-muted);border-radius:8px;display:grid;place-items:center">⌨️</span> Phím tắt bàn phím</span>
                <input type="checkbox" id="opt-kb" ${t.keyboardShortcuts?"checked":""} style="width:20px;height:20px;accent-color:var(--primary)" />
              </label>
              <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500">
                <span style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;background:var(--bg-muted);border-radius:8px;display:grid;place-items:center">📊</span> Số từ mỗi phiên</span>
                <select id="opt-size" class="filter-select" style="min-width:100px">
                  <option value="10" ${t.sessionSize==10?"selected":""}>10 từ</option>
                  <option value="20" ${t.sessionSize==20?"selected":""}>20 từ</option>
                  <option value="30" ${t.sessionSize==30?"selected":""}>30 từ</option>
                  <option value="50" ${t.sessionSize==50?"selected":""}>50 từ</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>ℹ️ Thông tin hệ thống</h3></div>
          <div class="card-padding">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Tổng từ</div><div style="font-weight:800;font-size:16px;margin-top:2px">${r.length}</div></div>
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Data updated</div><div style="font-weight:700;margin-top:2px">${(p==null?void 0:p.updated)||"local"}</div></div>
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Commit</div><div style="font-weight:700;font-family:var(--font-mono);font-size:12px;margin-top:2px">${(p==null?void 0:p.commit)||"dev"}</div></div>
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Build time</div><div style="font-weight:500;font-size:11px;margin-top:2px">${p!=null&&p.buildTime?new Date(p.buildTime).toLocaleString("vi-VN"):"local"}</div></div>
            </div>
            <div style="margin-top:14px;padding:12px;background:var(--primary-light);border-radius:10px;border:1px solid rgba(79,70,229,0.15);font-size:12px;color:var(--text-muted)">
              <div style="font-weight:700;color:var(--text);margin-bottom:4px">📂 Source of truth: <code>data/vocabulary.json</code></div>
              Thêm từ mới vào file này, merge PR vào main → GitHub Actions tự validate → build → deploy. Không cần sửa code frontend.
            </div>
          </div>
        </div>
      </div>
    `,(i=e.querySelector("#export-btn"))==null||i.addEventListener("click",()=>{const f=ht(),C=new Blob([JSON.stringify(f,null,2)],{type:"application/json"}),N=URL.createObjectURL(C),y=document.createElement("a");y.href=N,y.download=`flashcard-backup-${new Date().toISOString().split("T")[0]}.json`,y.click(),URL.revokeObjectURL(N),I("Đã xuất backup","success")}),(d=e.querySelector("#import-file"))==null||d.addEventListener("change",async f=>{const C=f.target.files[0];if(C)try{const N=await C.text(),y=JSON.parse(N);At(y),o=Q(st(),r),s=rt(),h=ot(),v=lt(),t=it(),A(),I("Import thành công! Đã khôi phục tiến trình","success"),B()}catch(N){I("Import lỗi: "+N.message,"error")}}),(c=e.querySelector("#reset-btn"))==null||c.addEventListener("click",()=>{confirm(`⚠️ Xóa toàn bộ tiến trình học? Hành động này không thể hoàn tác!

Bạn nên Export backup trước khi reset.`)&&confirm("Xác nhận lần 2: Bạn chắc chắn muốn reset?")&&(localStorage.clear(),o=Q({},r),s=new Set,h=[],v={current:0,longest:0,lastDate:null},t={...t,sessionSize:20},A(),I("Đã reset toàn bộ dữ liệu","success"),B())}),(m=e.querySelector("#opt-dark"))==null||m.addEventListener("change",f=>{t.darkMode=f.target.checked,_(t),$(),I(t.darkMode?"Dark mode ON 🌙":"Light mode ON ☀️","success")}),(E=e.querySelector("#opt-kb"))==null||E.addEventListener("change",f=>{t.keyboardShortcuts=f.target.checked,_(t),I(t.keyboardShortcuts?"Đã bật phím tắt ⌨️":"Đã tắt phím tắt","info")}),(T=e.querySelector("#opt-size"))==null||T.addEventListener("change",f=>{t.sessionSize=parseInt(f.target.value,10),_(t),I(`Đặt ${t.sessionSize} từ/phiên`,"success")})}function S(e){return e?String(e).replace(/[&<>"']/g,i=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[i]):""}function zt(e){if(!e)return"ngay bây giờ";const i=e-Date.now();if(i<=0)return"đến hạn";const d=Math.round(i/36e5);return d<1?"vài phút nữa":d<24?`${d} giờ nữa`:`${Math.round(d/24)} ngày nữa`}function Ct(e,i){let d;return(...c)=>{clearTimeout(d),d=setTimeout(()=>e(...c),i)}}document.addEventListener("keydown",e=>{if(!t.keyboardShortcuts)return;if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT"){e.key==="Escape"&&e.target.blur();return}const i=document.querySelector("#content");if(i&&a==="learn"&&u&&x){if(e.key>="1"&&e.key<="4"){const d=parseInt(e.key,10)-1,c=i.querySelectorAll(".option-btn");c[d]&&!c[d].disabled&&c[d].click()}else if(e.key==="Enter"){const d=i.querySelector("#next-btn");if(d)d.click();else{const c=i.querySelector("#submit-spell");c&&!c.disabled&&c.click()}}else if(e.key.toLowerCase()==="n"){const d=i.querySelector("#skip-btn");d&&d.click()}else if(e.key.toLowerCase()==="f"){const d=i.querySelector("#fav-btn");d&&d.click()}else if(e.key===" "){e.preventDefault();const d=i.querySelector("#next-btn");d&&d.click()}}}),B()}const ft=document.getElementById("app");Wt(ft).catch(n=>{console.error(n),ft.innerHTML=`<div style="padding:40px;text-align:center"><h2>Lỗi khởi tạo app</h2><p>${n.message}</p><pre style="text-align:left;background:#f1f5f9;padding:12px;border-radius:8px;overflow:auto">${n.stack}</pre></div>`});
