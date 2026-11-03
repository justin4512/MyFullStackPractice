#!/usr/bin/env python3
"""Build the static portfolio with Python's standard library. No runtime dependencies.

Local: python3 scripts/build-profile.py
Export: python3 scripts/build-profile.py --output dist-profile --site-url https://YOUR-DOMAIN
All CSS lives in css/myAll.css; browser behavior lives in js/profile.js.
"""
import argparse
import html
import json
import os
from pathlib import Path
import shutil
from urllib.parse import quote, urlsplit
from xml.sax.saxutils import escape as xml_escape
from profile_content import PAGES

ROOT = Path(__file__).resolve().parents[1]
UPDATED = "2026-11-03"
EMAIL = "justin4512@gmail.com"
LINKEDIN = "https://www.linkedin.com/in/justin-c-4608a177/"
RESUME = "downloads/Justin-Chiu-Resume-ZH.docx"
ASSETS = ["css/bootstrap.min.css", "css/myAll.css", "js/profile.js",
          "images/profile/workspace.jpg", "images/profile/avatar.svg",
          "images/profile/clinic-cover.svg", "images/profile/iceland-cover.svg"]
esc = html.escape

ICONS = {
    "home": '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    "grid": '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    "layers": '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    "book": '<path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    "download": '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    "arrow": '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    "external": '<path d="M14 3h7v7m-1-6L10 14M10 5H4v15h15v-6"/>',
    "chevron": '<path d="m9 5 7 7-7 7"/>',
    "left": '<path d="m15 5-7 7 7 7"/>',
    "users": '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 9v-3a6 6 0 0 0-2-4"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
    "workflow": '<rect x="8" y="2" width="8" height="6" rx="2"/><rect x="2" y="16" width="7" height="6" rx="2"/><rect x="15" y="16" width="7" height="6" rx="2"/><path d="M12 8v4M5 16v-4h14v4"/>',
    "spark": '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z"/>',
    "briefcase": '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M10 13h4"/>',
    "menu": '<path d="M4 6h16M4 12h16M4 18h16"/>',
    "pin": '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
}

PROJECTS = [
    {"name": "宏甫診所排班系統", "category": "營運工具 · 規則與流程", "filter": "operations",
     "cover": "clinic-cover.svg", "alt": "排班規則、人工調整與發布流程的概念插圖",
     "url": "https://tifarduty.twtesla.com/", "path": "projects/clinic-scheduling/index.html",
     "why": "讓排班的安排與調整，都有能說明的依據。",
     "how": "以規則模型串接自動排班、人工調整與發布。",
     "what": "完成排班作品，讓人力與公平性的設計具體可見。",
     "foot": "系統入口需登入"},
    {"name": "冰島極光互動地圖", "category": "地理應用 · 旅程與資訊", "filter": "geospatial",
     "cover": "iceland-cover.svg", "alt": "冰島行程路線的概念插圖，非實際網站截圖",
     "url": "https://iceland.twtesla.com/", "path": "projects/iceland-map/index.html",
     "why": "讓位置、時間與觀測條件，一起進入旅程規劃。",
     "how": "透過互動地圖，整合每日行程、日照與住宿。",
     "what": "將 15 天、66 個站點，串成可探索的行程。",
     "foot": "可公開體驗"},
]

def icon(name):
    return f'<svg class="pf-icon" aria-hidden="true"><use href="#pf-icon-{name}"></use></svg>'

def relative(target, page):
    if target.startswith(("https://", "http://", "mailto:")):
        return target
    path, separator, fragment = target.partition("#")
    result = os.path.relpath(path or page, os.path.dirname(page) or ".").replace(os.sep, "/")
    return result + (separator + fragment if separator else "")

def a(target, label, page, cls="pf-text-link", track="", external=False):
    attrs = f' class="{cls}"'
    if external:
        attrs += ' target="_blank" rel="noopener noreferrer"'
    if track:
        attrs += f' data-track="{track}" data-track-label="{esc(label)}"'
    note = '<span class="pf-sr-only">（另開分頁）</span>' if external else ''
    return f'<a href="{esc(relative(target, page))}"{attrs}>{label}{note}{icon("external" if external else "arrow")}</a>'

def contact(page):
    mail = f'mailto:{EMAIL}?subject={quote("討論 AI 導入與團隊需求")}'
    return f'''<section class="pf-section pf-panel pf-contact" id="contact" aria-labelledby="contact-title">
    <div class="pf-contact-layout"><div><h2 id="contact-title">你的團隊，正準備改變什麼？</h2>
    <p>我希望讓技術成為日常工作的助力。從需求、整合到維運，我願意承擔落地的責任，一起把眼前的問題轉成可執行的下一步。</p></div>
    {a(mail, '聊聊團隊需求', page, 'pf-button', 'contact_click')}</div>
    <div class="pf-contact-links"><a href="mailto:{EMAIL}" data-track="contact_click">{icon('mail')}{EMAIL}</a>
    <a href="{LINKEDIN}" target="_blank" rel="noopener noreferrer" data-track="contact_click">LinkedIn {icon('external')}<span class="pf-sr-only">（另開分頁）</span></a>
    <span class="pf-text-link">台中／台北 · 預計 2027 年 2 月可到職</span></div></section>'''

def shell(page, title, description, body, section="overview", heading="個人檔案", site_url=""):
    nav = [("overview", "index.html", "home", "總覽"), ("about", "index.html#about", "layers", "我的方法"),
           ("projects", "projects/index.html", "grid", "精選作品"), ("experience", "index.html#experience", "briefcase", "職涯與能力"),
           ("notes", "notes/index.html", "book", "實務筆記"), ("contact", "index.html#contact", "mail", "聯絡我")]
    links = ''.join(f'<a class="pf-nav-link" href="{relative(path,page)}"{chr(32)+"aria-current="+chr(34)+"page"+chr(34) if key==section else ""}>{icon(symbol)}<span>{label}</span></a>' for key,path,symbol,label in nav)
    symbols = ''.join(f'<symbol id="pf-icon-{name}" viewBox="0 0 24 24">{shape}</symbol>' for name,shape in ICONS.items())
    person = {"@type": "Person", "name": "Justin Chiu", "jobTitle": "研發組長", "description": "AI／GeoAI 系統整合與研發管理，從需求、部署到持續維運。", "sameAs": [LINKEDIN]}
    entity = {"@context": "https://schema.org", "@type": "ProfilePage" if page == "index.html" else ("CollectionPage" if page in ["projects/index.html", "notes/index.html"] else "Article"), "name": title, "description": description, "inLanguage": "zh-Hant"}
    if page == "index.html": entity["mainEntity"] = person
    elif entity["@type"] == "Article": entity.update({"headline": title, "author": person, "datePublished": UPDATED, "dateModified": UPDATED})
    canonical = ""
    if site_url:
        url = site_url.rstrip('/') + '/' + page.removesuffix('index.html')
        image = site_url.rstrip('/') + '/images/profile/workspace.jpg'
        entity['url'] = url
        person['url'] = site_url.rstrip('/') + '/'
        canonical = f'<link rel="canonical" href="{esc(url)}"><meta property="og:url" content="{esc(url)}"><meta property="og:image" content="{esc(image)}">'
    profile_name = '<h1 class="pf-topbar-title">Justin Chiu</h1>' if page == 'index.html' else f'<div class="pf-topbar-title">{heading}</div>'
    structured_data = json.dumps(entity, ensure_ascii=False).replace('</', '<\\/')
    return f'''<!doctype html>
<!-- Generated by scripts/build-profile.py. Edit the builder/content module and rebuild. -->
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(description)}"><meta name="theme-color" content="#183b4e">
<meta property="og:type" content="{'website' if entity['@type'] != 'Article' else 'article'}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:locale" content="zh_TW"><meta property="og:site_name" content="Justin Chiu">{canonical}
<link rel="icon" type="image/svg+xml" href="{relative('images/profile/avatar.svg',page)}">
<link rel="stylesheet" href="{relative('css/bootstrap.min.css',page)}"><link rel="stylesheet" href="{relative('css/myAll.css',page)}">
<script type="application/ld+json">{structured_data}</script>
<script src="{relative('js/profile.js',page)}" defer></script></head>
<body class="profile-site"><a class="pf-skip" href="#main-content">跳到主要內容</a>
<svg class="pf-svg-library" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{symbols}</svg>
<div class="pf-shell"><aside class="pf-sidebar" aria-label="個人資訊與導覽">
<a class="pf-identity" href="{relative('index.html',page)}" aria-label="Justin Chiu 個人首頁">
<!-- PHOTO SLOT: replace images/profile/avatar.svg with your portrait; keep the dimensions. -->
<img class="pf-avatar" src="{relative('images/profile/avatar.svg',page)}" width="100" height="100" alt="Justin Chiu 姓名縮寫 JC">
<div><span class="pf-brand">Justin Chiu</span><p>AI / GeoAI<br>Systems &amp; Leadership</p></div></a>
<button type="button" class="pf-button pf-icon-button pf-menu-toggle" data-menu-toggle aria-label="開啟導覽選單" aria-controls="profile-navigation" aria-expanded="false" hidden>{icon('menu')}</button>
<nav class="pf-navigation" id="profile-navigation" aria-label="主要導覽">{links}</nav>
<div class="pf-sidebar-bottom"><div class="pf-sidebar-note">{icon('spark')}<strong>讓技術走進日常</strong><p>從理解問題開始，<br>到系統持續運作。</p>{a('index.html#contact','一起討論',page)}</div>
<div class="pf-sidebar-meta"><span>Taiwan</span><span>2026 / 2027</span></div></div></aside>
<main class="pf-main" id="main-content"><header class="pf-topbar"><div>{profile_name}<p>AI／GeoAI · 系統整合與研發管理</p></div>
<div class="pf-top-actions"><span class="pf-availability"><span class="pf-status-dot"></span>預計 2027.02 可到職</span>
<a class="pf-button" href="{relative(RESUME,page)}" download data-track="resume_download_click">{icon('download')}下載履歷<span class="pf-sr-only">（DOCX）</span></a></div></header>
{body}
<footer class="pf-footer"><span>© 2026 Justin Chiu</span><span>從資料，到系統，再到團隊的日常。</span></footer>
</main></div></body></html>'''

def project_cards(page):
    result = []
    for project in PROJECTS:
        story = ''.join(f'<div><dt>{label}</dt><dd>{esc(project[key])}</dd></div>' for label,key in [('Why','why'),('How','how'),('What','what')])
        result.append(f'''<article class="pf-project-card" data-project="{project['filter']}">
        <!-- PHOTO SLOT: swap this cover for an actual project screenshot. -->
        <a class="pf-project-media" href="{project['url']}" target="_blank" rel="noopener noreferrer" data-track="project_open" data-track-label="{project['name']}" aria-label="開啟{project['name']}（另開分頁）">
        <img src="{relative('images/profile/'+project['cover'],page)}" width="960" height="600" alt="{project['alt']}" loading="lazy">
        <span class="pf-project-overlay">{icon('external')}<span>開啟作品 · 另開分頁</span></span></a>
        <div class="pf-project-body"><p class="pf-project-category">{project['category']}</p><h3 class="pf-project-title"><a href="{project['url']}" target="_blank" rel="noopener noreferrer" data-track="project_open">{project['name']}<span class="pf-sr-only">（另開分頁）</span></a></h3>
        <dl class="pf-card-story">{story}</dl><div class="pf-project-foot"><span>{project['foot']}</span>{a(project['path'],'閱讀案例',page,track='case_open')}</div></div></article>''')
    return '<div class="pf-projects">'+''.join(result)+'</div>'

def golden(items):
    return '<div class="pf-golden">'+''.join(f'<div class="pf-golden-item"><span class="pf-golden-label">{esc(label.split("｜")[0])}</span><div><h3>{esc(label.split("｜")[-1])}</h3><p>{esc(text)}</p></div></div>' for label,text in items)+'</div>'

def home():
    page = 'index.html'
    stories = [
        ('ai','內網 AI','讓知識，成為可用的答案','spark','我希望累積的專業知識，能成為團隊的日常支援。','主導地端 AI 建置與維運，整合私有模型與 RAG。','401GPT 服務 436 位使用者，每日 150–500 次查詢。','cases/private-ai/index.html'),
        ('geo','地理資訊','讓資料，支撐共同決策','globe','我希望不同角色，能在同一份地理資訊上協作。','主導平台重構與整合，與團隊持續承接維運。','MiCOP 服務約 15,000 位使用者，管理 40 TB 圖資。','cases/geospatial-platform/index.html'),
        ('automation','流程自動化','把重複工作，交給流程','workflow','我希望把團隊的注意力，留給真正需要判斷的事。','建置與維運 n8n 工作流，串接影像與圖資處理。','每月處理量估計折合 6,160 人工工時。','cases/workflow-automation/index.html'),
    ]
    slides = ''
    for identifier,name,title,symbol,why,how,what,link in stories:
        slides += f'''<article class="pf-slide" id="story-{identifier}" data-slide data-title="{name}" aria-label="{name}成果故事">
        <img class="pf-hero-art" src="images/profile/workspace.jpg" width="1672" height="941" alt="" {'fetchpriority="high"' if identifier=='ai' else 'loading="lazy"'}>
        <div class="pf-slide-copy"><div class="pf-story-tag">{icon(symbol)}{name} · 從需求到持續運作</div><h2>{title}</h2>
        <dl class="pf-mini-story"><div><dt>Why</dt><dd>{why}</dd></div><div><dt>How</dt><dd>{how}</dd></div><div><dt>What</dt><dd>{what}</dd></div></dl>
        {a(link,'閱讀完整故事',page,'pf-button pf-button-primary','case_open')}</div></article>'''
    choices = ''.join(f'<button type="button" class="pf-slide-choice" data-slide-to="{i}" aria-label="{name} 故事" aria-pressed="{str(i==0).lower()}" aria-controls="story-{identifier}">{name}</button>' for i,(identifier,name,*_) in enumerate(stories))
    body = f'''<section class="pf-hero pf-slider" data-slider tabindex="0" aria-label="精選成果故事" aria-roledescription="輪播">
    {slides}<div class="pf-slider-controls" data-slider-controls hidden><div class="pf-slide-choices" aria-label="選擇故事">{choices}</div>
    <div class="pf-slide-arrows"><button class="pf-button pf-icon-button" type="button" data-prev aria-label="上一個故事">{icon('left')}</button><button class="pf-button pf-icon-button" type="button" data-next aria-label="下一個故事">{icon('chevron')}</button></div></div>
    <span class="pf-sr-only" data-slide-status aria-live="polite" aria-atomic="true"></span></section>
    <section class="pf-metrics" aria-label="成果與責任範圍">'''
    for symbol,label,value,unit,note in [('spark','內網 AI 使用者','436','位','401GPT · 履歷自述'),('globe','地理平台使用者','15,000','位','MiCOP · 約計人數'),('workflow','等效人工處理量','6,160','工時','自動化 · 每月估算'),('users','研發團隊','20','人','同步推進 5 個專案')]:
        body += f'<div class="pf-metric"><div class="pf-metric-top"><span class="pf-raised-icon">{icon(symbol)}</span><span class="pf-metric-label">{label}</span></div><div class="pf-metric-value">{value}<small>{unit}</small></div><p>{note}</p></div>'
    body += f'''</section><div class="pf-dashboard-row"><section class="pf-panel" aria-labelledby="usage-title"><div class="pf-panel-head"><div><h3 id="usage-title">從部署，走進日常使用</h3><p>希望知識被使用，以地端 AI 承接查詢需求。</p></div>{icon('spark')}</div>
    <figure class="pf-chart" aria-label="401GPT 每日查詢量範圍：150 至 500 次">
    <div class="pf-bar-row"><div class="pf-bar-label"><span>每日查詢量下界</span><strong>150 次</strong></div><div class="pf-bar-track" aria-hidden="true"><span class="pf-bar-fill pf-bar-lower"></span></div></div>
    <div class="pf-bar-row"><div class="pf-bar-label"><span>每日查詢量上界</span><strong>500 次</strong></div><div class="pf-bar-track" aria-hidden="true"><span class="pf-bar-fill pf-bar-upper"></span></div></div>
    <figcaption>401GPT · 履歷記載的每日查詢範圍，非逐日趨勢。<br>應用於技術查詢、文件比對與研發問題分析。</figcaption></figure></section>
    <section class="pf-panel" aria-labelledby="workload-title"><div class="pf-panel-head"><div><h3 id="workload-title">讓工作量，有清楚的刻度</h3><p>把重複步驟交給流程，並用明確基準說明規模。</p></div>{icon('workflow')}</div>
    <div class="pf-formula" aria-label="35 人乘以 22 天乘以 8 小時"><strong>35<span> 人</span></strong><i>×</i><strong>22<span> 天</span></strong><i>×</i><strong>8<span> 小時</span></strong></div>
    <div class="pf-formula-result"><strong>6,160</strong><span>等效人工工時／月</span></div>
    <details><summary>這個數字如何解讀？</summary><p>這是系統處理量換算的等效人工工作量，並非實測節省時數。每月以 35 人、22 個工作日、每日 8 小時計算。</p>{a('notes/equivalent-work-hours/index.html','閱讀計算筆記',page)}</details></section></div>
    <section id="about" class="pf-section pf-panel pf-philosophy" aria-labelledby="about-title"><div class="pf-philosophy-intro"><div><h2 id="about-title">技術的價值，<br>在被持續使用之後。</h2><p>從影像判讀、地理資訊平台，到內網 AI 與自動化。我關心的是：系統上線以後，是否真的能承接團隊的工作。</p></div><span class="pf-signature">Justin Chiu</span></div>
    {golden([('Why｜讓能力留在團隊','我希望資訊不只被儲存，也能被理解、運用，成為團隊持續工作的能力。'),('How｜從需求到維運，承擔整合責任','以使用情境為起點，串接資料、模型與既有系統，帶領團隊一起完成部署與後續維運。'),('What｜把複雜問題，變成可用的系統','從 436 人使用的內網 AI，到約 15,000 人使用的地理平台，讓整合成果進入日常作業。')])}</section>
    <section class="pf-section" id="projects" aria-labelledby="projects-title"><div class="pf-section-head"><div><h2 id="projects-title">把想法，做成可以使用的作品</h2><p>從真實情境出發，探索介面、資料與人的關係。</p></div>{a('projects/index.html','所有作品',page)}</div>{project_cards(page)}</section>
    <section class="pf-section" id="experience" aria-labelledby="experience-title"><div class="pf-section-head"><div><h2 id="experience-title">從看懂資料，到帶領系統落地</h2><p>每一段經歷，都讓技術更靠近使用現場。</p></div></div><div class="pf-career-grid"><div class="pf-panel"><ol class="pf-timeline">
    <li><time>2024 — 至今</time><h3>研發組長 · AI 與系統整合</h3><p>為了讓新技術進入作業流程，帶領 20 人團隊，推進 5 個專案，承擔需求、部署與維運責任。</p></li>
    <li><time>2022 — 2024</time><h3>國際技術合作</h3><p>將技術交流放回工作需求，累積跨域溝通與系統協作的經驗。</p></li>
    <li><time>2010 — 2022</time><h3>GIS 平台 · 建置、重構與維運</h3><p>以共同地理資訊支援協作，主導 MiCOP 架構重構與整合，承接大規模圖資及服務。</p></li>
    <li><time>2006 — 2010</time><h3>GEOINT · 影像判讀</h3><p>從理解地理情境與影像資料開始，建立把資料轉成判斷依據的工作基礎。</p></li></ol></div>
    <div class="pf-panel"><div class="pf-skill-groups"><div class="pf-skill-group"><h3>把知識帶進工作流程</h3><ul class="pf-tags"><li>地端 LLM</li><li>RAG</li><li>n8n</li><li>工作流整合</li></ul></div>
    <div class="pf-skill-group"><h3>讓資料與系統互相連接</h3><ul class="pf-tags"><li>GeoAI / GIS</li><li>ArcGIS Enterprise</li><li>地理資料處理</li><li>Linux</li></ul></div>
    <div class="pf-skill-group"><h3>從交付延伸到持續運作</h3><ul class="pf-tags"><li>研發管理</li><li>需求整合</li><li>系統維運</li><li>跨域協作</li></ul></div></div>
    <div class="pf-education"><h3>學歷與專業學習</h3><p>資訊工程碩士 · 測繪學士</p><p>RHCE / RHCSA</p><p>Google、IBM 專業證書</p></div></div></div></section>
    <section class="pf-section" aria-labelledby="notes-title"><div class="pf-section-head"><h2 id="notes-title">把實作，整理成可以分享的經驗</h2>{a('notes/index.html','實務筆記',page)}</div>
    <article class="pf-panel pf-note-card"><div><h3>如何讀懂等效人工工時</h3><p>為了讓成果可以被理解，從換算基準出發，說明 6,160 工時代表的規模與適用範圍。</p>{a('notes/equivalent-work-hours/index.html','閱讀筆記',page)}</div><div class="pf-note-symbol" aria-hidden="true">×</div></article></section>
    {contact(page)}'''
    return body

def detail(data):
    page = data['path']
    group = 'notes' if page.startswith('notes/') else 'projects'
    group_name = '實務筆記' if group == 'notes' else '作品與案例'
    external = a(data['external'],data['external_label'],page,'pf-button pf-button-primary','project_open',True) if data['external'] else a('index.html#contact','討論相關需求',page,'pf-button pf-button-primary','contact_click')
    summary = golden(data['summary'])
    metrics = ''.join(f'<div class="pf-detail-metric"><strong>{esc(value)}</strong><span>{esc(label)}</span></div>' for value,label in data['metrics'])
    prose = ''.join(f'<section id="{item["label"].lower()}" class="pf-panel pf-prose-section"><h2><span>{item["label"]}</span>{esc(item["title"])}</h2>{item["body"]}</section>' for item in data['sections'])
    related = ''.join(a(path,title,page,'pf-button','case_open') for path,title in data['related'])
    return f'''<nav aria-label="麵包屑"><ol class="pf-breadcrumb"><li><a href="{relative('index.html',page)}">首頁</a></li><li><a href="{relative(group+'/index.html',page)}">{group_name}</a></li><li aria-current="page">{esc(data['category'])}</li></ol></nav>
    <article><header class="pf-article-hero"><div><h1>{esc(data['heading'])}</h1><p>{esc(data['lead'])}</p>{external}<div class="pf-article-meta">Justin Chiu · 更新於 {UPDATED}</div></div>
    <img class="pf-article-cover" src="{relative('images/profile/'+data['cover'],page)}" width="960" height="660" alt="{esc(data['cover_alt'])}"></header>
    <div class="pf-panel pf-article-summary" aria-label="案例摘要">{summary}</div><div class="pf-detail-metrics" aria-label="案例數據">{metrics}</div>
    <div class="pf-article-body"><nav class="pf-toc" aria-label="本篇章節"><a href="#why">Why · 動機</a><a href="#how">How · 方法</a><a href="#what">What · 結果</a></nav><div class="pf-prose">{prose}</div></div></article>
    <section class="pf-section" aria-labelledby="related-title"><h2 id="related-title">接著探索</h2><div class="pf-related">{related}</div></section>{contact(page)}'''

def projects():
    page='projects/index.html'
    professional = ''.join(a(data['path'],data['heading'],page,'pf-button','case_open') for data in PAGES if data['path'].startswith('cases/'))
    return f'''<header class="pf-page-heading"><h1>把真實需求，做成作品</h1><p>我希望技術貼近使用現場。透過需求整理、資料整合與互動設計，讓旅程規劃與日常營運的問題，有具體可用的回應。</p></header>
    <div class="pf-filters" data-project-filters aria-label="作品類型" hidden><button class="pf-filter" data-filter="all" aria-pressed="true">全部作品</button><button class="pf-filter" data-filter="operations" aria-pressed="false">營運工具</button><button class="pf-filter" data-filter="geospatial" aria-pressed="false">地理應用</button></div>
    <span class="pf-sr-only" data-filter-status aria-live="polite"></span>{project_cards(page)}
    <section class="pf-section pf-panel" aria-labelledby="professional-title"><h2 id="professional-title">專業經驗，如何進入日常</h2><p>從內網知識服務、地理資訊平台到自動化流程，繼續探索方法與成果。</p><div class="pf-related">{professional}</div></section>{contact(page)}'''

def notes():
    page='notes/index.html'
    return f'''<header class="pf-page-heading"><h1>讓經驗，成為可交流的方法</h1><p>為了讓實作經驗能被理解，我把方法、責任與觀察整理成筆記，留下可討論、可核對的思考過程。</p></header>
    <article class="pf-panel pf-note-card"><div><p class="pf-project-category">成效衡量 · {UPDATED}</p><h2>如何讀懂等效人工工時</h2><p>從為何量化，到如何計算，再到結果能回答的問題。一起拆解 35 × 22 × 8 這個公式。</p>{a('notes/equivalent-work-hours/index.html','閱讀完整筆記',page)}</div><div class="pf-note-symbol" aria-hidden="true">×</div></article>{contact(page)}'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='.', help='Output folder, relative to the project root')
    parser.add_argument('--site-url', default='', help='Confirmed public HTTPS base URL; omit for local preview')
    args = parser.parse_args()
    if args.site_url:
        parsed = urlsplit(args.site_url)
        if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            parser.error('--site-url must be a public HTTPS URL without credentials, query or fragment')
    output = (ROOT / args.output).resolve()
    original = ROOT/'個人檔案頁規劃/RESUME_Justin_Chiu_2027_AI-GeoAI_v5_ZH.docx'
    pages = [('index.html', 'Justin Chiu｜AI 導入、GeoAI 與系統整合技術主管', '希望讓技術成為團隊日常能力；從需求、AI 與 GeoAI 整合到持續維運，分享 Justin Chiu 的系統成果、前端作品與實務經驗。',home(),'overview','個人檔案'),
             ('projects/index.html','精選作品與案例｜Justin Chiu','從真實情境出發，透過資料整合與互動設計，探索宏甫診所排班系統、冰島極光互動地圖，以及 AI／GeoAI 專業案例。',projects(),'projects','作品與案例'),
             ('notes/index.html','實務筆記｜Justin Chiu','為了讓實作經驗能被理解，整理方法、責任與可觀察結果，分享 AI、GeoAI 與自動化工作的思考過程。',notes(),'notes','實務筆記')]
    for data in PAGES:
        pages.append((data['path'],data['title'],data['description'],detail(data),'notes' if data['path'].startswith('notes/') else 'projects','實務筆記' if data['path'].startswith('notes/') else '作品與案例'))
    # Preflight the entire export before creating or replacing any file.
    generated = {page: shell(page,title,description,body,section,heading,args.site_url)
                 for page,title,description,body,section,heading in pages}
    if args.site_url:
        urls = ''.join(f'<url><loc>{xml_escape(args.site_url.rstrip("/")+"/"+page.removesuffix("index.html"))}</loc><lastmod>{UPDATED}</lastmod></url>' for page,*_ in pages)
        generated['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>'
        generated['robots.txt'] = 'User-agent: *\nAllow: /\n\nSitemap: '+args.site_url.rstrip('/')+'/sitemap.xml\n'
    sources = {name: ROOT/name for name in ASSETS}
    sources[RESUME] = original
    manifest_path = output/'.profile-build.json'
    owned = set()
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            if manifest.get('format') != 'justin-profile-v1':
                raise ValueError('unrecognized manifest')
            owned = set(manifest['files'])
        except (ValueError, KeyError, TypeError):
            raise SystemExit(f'Refusing to overwrite an unrelated build manifest: {manifest_path}')
    destinations = set(generated) | set(sources)
    for name in sorted(destinations):
        target = output/name
        try:
            target.resolve().relative_to(output)
        except ValueError:
            raise SystemExit(f'Refusing to write through a link outside the output folder: {target}')
        if target.is_symlink() or (target.exists() and not target.is_file()):
            raise SystemExit(f'Refusing to replace a non-regular file: {target}')
        if name in sources and not sources[name].is_file():
            raise SystemExit(f'Missing source asset: {sources[name]}')
        if not target.exists():
            continue
        if name.endswith('.html'):
            if b'Generated by scripts/build-profile.py' not in target.read_bytes():
                raise SystemExit(f'Refusing to overwrite an unrelated file: {target}')
        elif name not in owned:
            if name not in sources or target.read_bytes() != sources[name].read_bytes():
                raise SystemExit(f'Refusing to overwrite an unrelated file: {target}')
    output.mkdir(parents=True, exist_ok=True)
    for name, source in sources.items():
        target = output/name
        if source.resolve() != target.resolve():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    for name, content in generated.items():
        path = output/name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
    # Only remove stale SEO files that a previous run explicitly owned.
    for name in ('robots.txt', 'sitemap.xml'):
        if name in owned and name not in generated and (output/name).is_file():
            (output/name).unlink()
    manifest_path.write_text(json.dumps({'format': 'justin-profile-v1', 'files': sorted(destinations)}, indent=2)+'\n', encoding='utf-8')
    print(f'Built {len(pages)} static pages in {output}')
    print('Canonical URLs and sitemap enabled.' if args.site_url else 'Local mode: canonical URLs and sitemap await the confirmed public domain.')

if __name__ == '__main__':
    main()
