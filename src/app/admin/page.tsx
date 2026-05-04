<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>eSIM 全球通 — 後台管理</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #F4F6FB;
  --sidebar: #1A1F35;
  --sidebar-hover: #252C47;
  --accent: #4F6EF7;
  --accent2: #FF5B7E;
  --green: #18C96A;
  --yellow: #F5B100;
  --red: #FF4E6A;
  --white: #FFFFFF;
  --card: #FFFFFF;
  --text: #1A1F35;
  --muted: #7B85A3;
  --border: #E4E9F2;
  --mono: 'DM Mono', monospace;
  --sans: 'Noto Sans TC', sans-serif;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: var(--sans); background: var(--bg); color: var(--text); display:flex; min-height:100vh; }

/* SIDEBAR */
.sidebar {
  width: 240px; min-height: 100vh;
  background: var(--sidebar);
  display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh;
  flex-shrink: 0;
}
.sidebar-logo {
  padding: 1.5rem 1.5rem 1rem;
  font-size: 1.1rem; font-weight: 900; color: white;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; gap: 0.5rem;
}
.sidebar-logo span { color: #4F6EF7; }
.sidebar-nav { padding: 1rem 0; flex: 1; }
.nav-section { padding: 0.4rem 1.5rem; font-size: 0.7rem; color: rgba(255,255,255,0.3); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 0.5rem; }
.nav-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 1.5rem; color: rgba(255,255,255,0.55);
  cursor: pointer; font-size: 0.88rem; font-weight: 500;
  transition: all .2s; border-left: 3px solid transparent;
}
.nav-item:hover { background: var(--sidebar-hover); color: white; }
.nav-item.active { background: var(--sidebar-hover); color: white; border-left-color: var(--accent); }
.nav-icon { font-size: 1rem; width: 20px; text-align: center; }
.sidebar-user {
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; gap: 0.75rem;
}
.user-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--accent); display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 700; color: white; flex-shrink: 0;
}
.user-name { font-size: 0.85rem; color: white; font-weight: 700; }
.user-role { font-size: 0.75rem; color: rgba(255,255,255,0.4); }

/* MAIN */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.topbar {
  background: white; border-bottom: 1px solid var(--border);
  padding: 0.85rem 2rem; display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 50;
}
.topbar-title { font-size: 1.1rem; font-weight: 900; }
.topbar-actions { display: flex; align-items: center; gap: 1rem; }
.topbar-date { font-size: 0.8rem; color: var(--muted); font-family: var(--mono); }
.notif-btn {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--bg); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 1rem; position: relative;
}
.notif-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--red); }

.content { padding: 2rem; overflow-y: auto; flex: 1; }

/* PAGES */
.page { display: none; animation: fadeIn .3s ease; }
.page.active { display: block; }
@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

/* STAT CARDS */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 2rem; }
.stat-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 16px; padding: 1.25rem 1.5rem;
  display: flex; flex-direction: column; gap: 0.5rem;
  transition: box-shadow .2s;
}
.stat-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.stat-label { font-size: 0.8rem; color: var(--muted); font-weight: 500; display: flex; align-items: center; gap: 0.4rem; }
.stat-value { font-size: 1.8rem; font-weight: 900; font-family: var(--mono); }
.stat-change { font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; gap: 0.25rem; }
.stat-change.up { color: var(--green); }
.stat-change.down { color: var(--red); }
.stat-icon { font-size: 1.5rem; }

/* CHARTS ROW */
.charts-row { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-bottom: 2rem; }
.chart-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 16px; padding: 1.5rem;
}
.chart-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; }
.chart-subtitle { font-size: 0.78rem; color: var(--muted); }

/* Bar chart */
.bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; }
.bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.bar {
  width: 100%; border-radius: 6px 6px 0 0;
  background: var(--accent); opacity: 0.85;
  transition: opacity .2s; cursor: pointer; min-height: 4px;
}
.bar:hover { opacity: 1; }
.bar.accent2 { background: var(--accent2); }
.bar-label { font-size: 0.65rem; color: var(--muted); font-family: var(--mono); }

/* Donut */
.donut-wrap { display: flex; flex-direction: column; gap: 0.75rem; }
.donut-svg { display: block; margin: 0 auto; }
.donut-legend { display: flex; flex-direction: column; gap: 0.5rem; }
.legend-item { display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 0.5rem; flex-shrink:0; }
.legend-left { display: flex; align-items: center; color: var(--muted); }
.legend-val { font-weight: 700; font-family: var(--mono); }

/* TABLE */
.table-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 16px; overflow: hidden; margin-bottom: 1.5rem;
}
.table-header {
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
}
.table-header h3 { font-size: 0.95rem; font-weight: 700; }
.table-actions { display: flex; gap: 0.75rem; align-items: center; }
.search-input {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 0.4rem 0.85rem;
  font-size: 0.85rem; font-family: var(--sans);
  color: var(--text); outline: none; width: 200px;
}
.search-input:focus { border-color: var(--accent); }
.btn {
  padding: 0.45rem 1rem; border-radius: 8px; border: none;
  font-size: 0.82rem; font-weight: 700; cursor: pointer;
  font-family: var(--sans); transition: all .2s;
  display: flex; align-items: center; gap: 0.4rem;
}
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: #3a57e8; }
.btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }
.btn-danger { background: transparent; color: var(--red); border: 1px solid var(--border); }
.btn-danger:hover { background: rgba(255,78,106,0.08); border-color: var(--red); }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.78rem; }

table { width: 100%; border-collapse: collapse; }
th {
  background: var(--bg); padding: 0.7rem 1.25rem;
  text-align: left; font-size: 0.75rem; font-weight: 700;
  color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
}
td {
  padding: 0.85rem 1.25rem; font-size: 0.85rem;
  border-bottom: 1px solid var(--border); vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(79,110,247,0.03); }

.badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.65rem; border-radius: 50px; font-size: 0.75rem; font-weight: 700;
}
.badge-green { background: rgba(24,201,106,0.12); color: var(--green); }
.badge-yellow { background: rgba(245,177,0,0.12); color: var(--yellow); }
.badge-red { background: rgba(255,78,106,0.12); color: var(--red); }
.badge-blue { background: rgba(79,110,247,0.12); color: var(--accent); }
.badge-gray { background: rgba(123,133,163,0.12); color: var(--muted); }

.order-id { font-family: var(--mono); font-size: 0.8rem; color: var(--accent); font-weight: 500; }
.flag-name { display: flex; align-items: center; gap: 0.5rem; }

/* PRODUCT MANAGEMENT */
.products-grid-admin { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }
.product-admin-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 16px; overflow: hidden;
  transition: box-shadow .2s;
}
.product-admin-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.pac-header {
  padding: 1.25rem; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid var(--border);
}
.pac-country { display: flex; align-items: center; gap: 0.75rem; }
.pac-flag { font-size: 2rem; }
.pac-name { font-weight: 700; }
.pac-region { font-size: 0.78rem; color: var(--muted); }
.pac-body { padding: 1rem 1.25rem; }
.plan-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0; border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}
.plan-row:last-child { border-bottom: none; }
.plan-row-info { color: var(--muted); }
.plan-row-price { font-family: var(--mono); font-weight: 700; color: var(--accent); }
.plan-row-actions { display: flex; gap: 0.4rem; }
.edit-price-input {
  width: 80px; border: 1px solid var(--accent); border-radius: 6px;
  padding: 0.2rem 0.4rem; font-family: var(--mono); font-size: 0.85rem;
  font-weight: 700; color: var(--accent); outline: none; display: none;
}

/* MODAL */
.modal-backdrop {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
  z-index: 200; align-items: center; justify-content: center;
}
.modal-backdrop.open { display: flex; }
.modal {
  background: white; border-radius: 20px; padding: 2rem;
  width: 100%; max-width: 460px;
  animation: popIn .25s ease; position: relative;
  max-height: 90vh; overflow-y: auto;
}
@keyframes popIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
.modal h3 { font-size: 1.1rem; font-weight: 900; margin-bottom: 1.5rem; }
.modal-close { position: absolute; top: 1.25rem; right: 1.25rem; background: var(--bg); border: none; border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 0.9rem; color: var(--muted); }
.form-group { margin-bottom: 1.1rem; }
.form-group label { display: block; font-size: 0.8rem; color: var(--muted); font-weight: 700; margin-bottom: 0.4rem; }
.form-control {
  width: 100%; background: var(--bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.65rem 1rem;
  font-size: 0.9rem; font-family: var(--sans); color: var(--text); outline: none;
  transition: border-color .2s;
}
.form-control:focus { border-color: var(--accent); }
select.form-control { cursor: pointer; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }

/* TOAST */
.toast {
  position: fixed; bottom: 2rem; right: 2rem;
  background: var(--sidebar); color: white;
  padding: 0.75rem 1.25rem; border-radius: 12px;
  font-size: 0.88rem; font-weight: 500;
  z-index: 999; transform: translateY(80px); opacity: 0;
  transition: all .3s; display: flex; align-items: center; gap: 0.5rem;
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
}
.toast.show { transform: translateY(0); opacity: 1; }

/* STATUS SELECT */
.status-select {
  background: transparent; border: none; font-family: var(--sans);
  font-size: 0.78rem; font-weight: 700; cursor: pointer; outline: none;
  padding: 0.15rem 0.3rem; border-radius: 50px;
}

/* PAGINATION */
.pagination { display: flex; align-items: center; gap: 0.4rem; padding: 1rem 1.25rem; border-top: 1px solid var(--border); }
.page-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; font-size: 0.82rem; cursor: pointer; font-family: var(--sans);
  transition: all .2s; display: flex; align-items: center; justify-content: center;
}
.page-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
.page-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }
.page-info { font-size: 0.8rem; color: var(--muted); margin-left: auto; }

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .charts-row { grid-template-columns: 1fr; }
  .sidebar { width: 60px; }
  .sidebar-logo span:last-child, .nav-item span:last-child, .sidebar-user .user-name, .sidebar-user .user-role, .nav-section { display: none; }
  .nav-item { justify-content: center; padding: 0.7rem; }
}
</style>
</head>
<body>

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="sidebar-logo">🌐 <span>eSIM 全球通</span></div>
  <nav class="sidebar-nav">
    <div class="nav-section">主選單</div>
    <div class="nav-item active" onclick="switchPage('dashboard', this)">
      <span class="nav-icon">📊</span><span>總覽儀表板</span>
    </div>
    <div class="nav-item" onclick="switchPage('orders', this)">
      <span class="nav-icon">📋</span><span>訂單管理</span>
    </div>
    <div class="nav-item" onclick="switchPage('products', this)">
      <span class="nav-icon">📦</span><span>商品管理</span>
    </div>
    <div class="nav-item" onclick="switchPage('customers', this)">
      <span class="nav-icon">👥</span><span>客戶管理</span>
    </div>
    <div class="nav-section">系統</div>
    <div class="nav-item" onclick="switchPage('settings', this)">
      <span class="nav-icon">⚙️</span><span>設定</span>
    </div>
  </nav>
  <div class="sidebar-user">
    <div class="user-avatar">管</div>
    <div><div class="user-name">管理員</div><div class="user-role">Admin</div></div>
  </div>
</aside>

<!-- MAIN -->
<main class="main">
  <div class="topbar">
    <div class="topbar-title" id="pageTitle">總覽儀表板</div>
    <div class="topbar-actions">
      <div class="topbar-date" id="topbarDate"></div>
      <div class="notif-btn">🔔<div class="notif-dot"></div></div>
    </div>
  </div>

  <div class="content">

    <!-- DASHBOARD -->
    <div class="page active" id="page-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label"><span class="stat-icon">💰</span> 本月營收</div>
          <div class="stat-value" style="color:var(--accent)">NT$87,450</div>
          <div class="stat-change up">▲ 12.4% 較上月</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><span class="stat-icon">📋</span> 本月訂單</div>
          <div class="stat-value">248</div>
          <div class="stat-change up">▲ 8.1% 較上月</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><span class="stat-icon">👥</span> 新增客戶</div>
          <div class="stat-value">134</div>
          <div class="stat-change up">▲ 5.3% 較上月</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><span class="stat-icon">⚡</span> 待處理訂單</div>
          <div class="stat-value" style="color:var(--yellow)">12</div>
          <div class="stat-change down">▼ 需盡快處理</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-title">
            過去 7 天銷售趨勢
            <span class="chart-subtitle">藍=營收 粉=訂單數</span>
          </div>
          <div class="bar-chart" id="barChart"></div>
          <div style="display:flex;gap:1rem;margin-top:0.75rem">
            <div style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;color:var(--muted)"><div style="width:10px;height:10px;border-radius:2px;background:var(--accent)"></div>營收（千元）</div>
            <div style="display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;color:var(--muted)"><div style="width:10px;height:10px;border-radius:2px;background:var(--accent2)"></div>訂單數</div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-title">熱門地區</div>
          <div class="donut-wrap">
            <svg class="donut-svg" width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#E4E9F2" stroke-width="18"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#4F6EF7" stroke-width="18" stroke-dasharray="113 170" stroke-dashoffset="0" stroke-linecap="round"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#FF5B7E" stroke-width="18" stroke-dasharray="57 226" stroke-dashoffset="-113" stroke-linecap="round"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#18C96A" stroke-width="18" stroke-dasharray="40 243" stroke-dashoffset="-170" stroke-linecap="round"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#F5B100" stroke-width="18" stroke-dasharray="20 263" stroke-dashoffset="-210" stroke-linecap="round"/>
              <text x="60" y="64" text-anchor="middle" font-size="11" font-weight="700" fill="#1A1F35" font-family="DM Mono">248</text>
            </svg>
            <div class="donut-legend">
              <div class="legend-item"><div class="legend-left"><div class="legend-dot" style="background:#4F6EF7"></div>🌏 亞洲</div><div class="legend-val">45%</div></div>
              <div class="legend-item"><div class="legend-left"><div class="legend-dot" style="background:#FF5B7E"></div>🌍 歐洲</div><div class="legend-val">23%</div></div>
              <div class="legend-item"><div class="legend-left"><div class="legend-dot" style="background:#18C96A"></div>🌎 美洲</div><div class="legend-val">16%</div></div>
              <div class="legend-item"><div class="legend-left"><div class="legend-dot" style="background:#F5B100"></div>🏝️ 大洋洲</div><div class="legend-val">8%</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Orders -->
      <div class="table-card">
        <div class="table-header">
          <h3>最新訂單</h3>
          <button class="btn btn-outline" onclick="switchPage('orders', document.querySelector('[onclick*=orders]'))">查看全部 →</button>
        </div>
        <table>
          <thead><tr>
            <th>訂單編號</th><th>客戶</th><th>商品</th><th>金額</th><th>狀態</th><th>時間</th>
          </tr></thead>
          <tbody id="recentOrdersBody"></tbody>
        </table>
      </div>
    </div>

    <!-- ORDERS PAGE -->
    <div class="page" id="page-orders">
      <div class="table-card">
        <div class="table-header">
          <h3>所有訂單 <span style="color:var(--muted);font-weight:400;font-size:0.82rem">共 <span id="orderTotal">0</span> 筆</span></h3>
          <div class="table-actions">
            <input class="search-input" type="text" placeholder="🔍 搜尋訂單或客戶..." oninput="filterOrders(this.value)" />
            <select class="search-input" style="width:auto" onchange="filterOrderStatus(this.value)">
              <option value="">全部狀態</option>
              <option value="已完成">已完成</option>
              <option value="處理中">處理中</option>
              <option value="待付款">待付款</option>
              <option value="已取消">已取消</option>
            </select>
            <button class="btn btn-primary" onclick="openAddOrder()">＋ 新增訂單</button>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>訂單編號</th><th>客戶姓名</th><th>電子郵件</th><th>商品</th><th>金額</th><th>狀態</th><th>日期</th><th>操作</th>
          </tr></thead>
          <tbody id="ordersBody"></tbody>
        </table>
        <div class="pagination" id="pagination"></div>
      </div>
    </div>

    <!-- PRODUCTS PAGE -->
    <div class="page" id="page-products">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
        <div>
          <h2 style="font-size:1rem;font-weight:700">商品方案管理</h2>
          <p style="font-size:0.82rem;color:var(--muted)">點擊價格可直接編輯</p>
        </div>
        <button class="btn btn-primary" onclick="openAddProduct()">＋ 新增國家方案</button>
      </div>
      <div class="products-grid-admin" id="productsGrid"></div>
    </div>

    <!-- CUSTOMERS PAGE -->
    <div class="page" id="page-customers">
      <div class="table-card">
        <div class="table-header">
          <h3>客戶管理</h3>
          <div class="table-actions">
            <input class="search-input" type="text" placeholder="🔍 搜尋客戶..." oninput="filterCustomers(this.value)" />
          </div>
        </div>
        <table>
          <thead><tr>
            <th>客戶姓名</th><th>電子郵件</th><th>電話</th><th>訂單數</th><th>總消費</th><th>最後購買</th><th>操作</th>
          </tr></thead>
          <tbody id="customersBody"></tbody>
        </table>
      </div>
    </div>

    <!-- SETTINGS PAGE -->
    <div class="page" id="page-settings">
      <div class="table-card" style="max-width:600px">
        <div class="table-header"><h3>⚙️ 系統設定</h3></div>
        <div style="padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem">
          <div class="form-group">
            <label>商店名稱</label>
            <input class="form-control" value="eSIM 全球通" />
          </div>
          <div class="form-group">
            <label>客服信箱</label>
            <input class="form-control" value="support@esimglobal.tw" />
          </div>
          <div class="form-group">
            <label>客服電話</label>
            <input class="form-control" value="+886-2-1234-5678" />
          </div>
          <div class="form-group">
            <label>訂單通知信箱</label>
            <input class="form-control" value="orders@esimglobal.tw" />
          </div>
          <div class="form-group">
            <label>幣別</label>
            <select class="form-control"><option>新台幣 (NTD)</option><option>美金 (USD)</option></select>
          </div>
          <button class="btn btn-primary" style="width:fit-content" onclick="showToast('✅ 設定已儲存')">儲存設定</button>
        </div>
      </div>
    </div>

  </div>
</main>

<!-- ADD ORDER MODAL -->
<div class="modal-backdrop" id="addOrderModal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('addOrderModal')">✕</button>
    <h3>＋ 新增訂單</h3>
    <div class="form-group"><label>客戶姓名</label><input class="form-control" id="o_name" placeholder="王小明" /></div>
    <div class="form-group"><label>電子郵件</label><input class="form-control" id="o_email" placeholder="example@email.com" /></div>
    <div class="form-group"><label>電話</label><input class="form-control" id="o_phone" placeholder="+886 912 345 678" /></div>
    <div class="form-row">
      <div class="form-group"><label>國家</label>
        <select class="form-control" id="o_country">
          <option>🇯🇵 日本</option><option>🇰🇷 韓國</option><option>🇺🇸 美國</option>
          <option>🇬🇧 英國</option><option>🇹🇭 泰國</option><option>🇦🇺 澳洲</option>
          <option>🇫🇷 法國</option><option>🇸🇬 新加坡</option>
        </select>
      </div>
      <div class="form-group"><label>方案</label>
        <select class="form-control" id="o_plan">
          <option>3GB / 7天</option><option>10GB / 15天</option><option>20GB / 30天</option><option>無限 / 30天</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>金額 (NT$)</label><input class="form-control" id="o_price" type="number" placeholder="349" /></div>
      <div class="form-group"><label>狀態</label>
        <select class="form-control" id="o_status">
          <option>已完成</option><option>處理中</option><option>待付款</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('addOrderModal')">取消</button>
      <button class="btn btn-primary" onclick="saveNewOrder()">新增訂單</button>
    </div>
  </div>
</div>

<!-- ADD PRODUCT MODAL -->
<div class="modal-backdrop" id="addProductModal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('addProductModal')">✕</button>
    <h3>＋ 新增國家方案</h3>
    <div class="form-row">
      <div class="form-group"><label>國旗 Emoji</label><input class="form-control" id="p_flag" placeholder="🇯🇵" maxlength="4" /></div>
      <div class="form-group"><label>國家名稱</label><input class="form-control" id="p_country" placeholder="日本" /></div>
    </div>
    <div class="form-group"><label>地區</label>
      <select class="form-control" id="p_region">
        <option>亞洲</option><option>歐洲</option><option>美洲</option><option>大洋洲</option><option>中東非洲</option>
      </select>
    </div>
    <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-bottom:0.75rem">方案設定</div>
    <div class="form-row">
      <div class="form-group"><label>方案1 流量</label><input class="form-control" id="p_d1" placeholder="3GB" /></div>
      <div class="form-group"><label>天數 / 價格</label>
        <div style="display:flex;gap:0.5rem">
          <input class="form-control" id="p_day1" placeholder="7天" style="width:50%" />
          <input class="form-control" id="p_price1" placeholder="199" type="number" style="width:50%" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>方案2 流量</label><input class="form-control" id="p_d2" placeholder="10GB" /></div>
      <div class="form-group"><label>天數 / 價格</label>
        <div style="display:flex;gap:0.5rem">
          <input class="form-control" id="p_day2" placeholder="15天" style="width:50%" />
          <input class="form-control" id="p_price2" placeholder="349" type="number" style="width:50%" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('addProductModal')">取消</button>
      <button class="btn btn-primary" onclick="saveNewProduct()">新增商品</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div class="toast" id="toast"></div>

<script>
// Data
let orders = [
  { id:'ORD-2025-001', name:'林美華', email:'lin@gmail.com', phone:'0912-111-222', product:'🇯🇵 日本 10GB/15天', amount:349, status:'已完成', date:'2025-04-25' },
  { id:'ORD-2025-002', name:'張志豪', email:'chang@gmail.com', phone:'0923-333-444', product:'🇰🇷 韓國 5GB/10天', amount:229, status:'已完成', date:'2025-04-24' },
  { id:'ORD-2025-003', name:'陳雅婷', email:'chen@yahoo.tw', phone:'0934-555-666', product:'🇺🇸 美國 無限/30天', amount:799, status:'處理中', date:'2025-04-24' },
  { id:'ORD-2025-004', name:'王建國', email:'wang@outlook.com', phone:'0945-777-888', product:'🇬🇧 英國 20GB/30天', amount:529, status:'待付款', date:'2025-04-23' },
  { id:'ORD-2025-005', name:'黃淑芬', email:'huang@gmail.com', phone:'0956-999-000', product:'🇹🇭 泰國 3GB/7天', amount:169, status:'已完成', date:'2025-04-23' },
  { id:'ORD-2025-006', name:'李怡君', email:'lee@gmail.com', phone:'0967-111-333', product:'🇦🇺 澳洲 5GB/14天', amount:349, status:'已完成', date:'2025-04-22' },
  { id:'ORD-2025-007', name:'吳俊傑', email:'wu@gmail.com', phone:'0978-222-444', product:'🇫🇷 法國 5GB/15天', amount:329, status:'已取消', date:'2025-04-22' },
  { id:'ORD-2025-008', name:'鄭雅文', email:'zheng@gmail.com', phone:'0989-333-555', product:'🇸🇬 新加坡 10GB/20天', amount:369, status:'處理中', date:'2025-04-21' },
  { id:'ORD-2025-009', name:'楊大衛', email:'yang@outlook.com', phone:'0900-444-666', product:'🇩🇪 德國 無限/30天', amount:849, status:'已完成', date:'2025-04-21' },
  { id:'ORD-2025-010', name:'蔡佩珊', email:'tsai@gmail.com', phone:'0911-555-777', product:'🇯🇵 日本 3GB/7天', amount:199, status:'已完成', date:'2025-04-20' },
  { id:'ORD-2025-011', name:'許文豪', email:'hsu@gmail.com', phone:'0922-666-888', product:'🇺🇸 美國 5GB/15天', amount:299, status:'待付款', date:'2025-04-20' },
  { id:'ORD-2025-012', name:'劉依珍', email:'liu@yahoo.tw', phone:'0933-777-999', product:'🇳🇿 紐西蘭 5GB/14天', amount:369, status:'已完成', date:'2025-04-19' },
];

let products = [
  { id:1, flag:'🇯🇵', country:'日本', region:'亞洲', plans:[{data:'3GB',days:'7天',price:199},{data:'10GB',days:'15天',price:349},{data:'20GB',days:'30天',price:549}] },
  { id:2, flag:'🇰🇷', country:'韓國', region:'亞洲', plans:[{data:'5GB',days:'10天',price:229},{data:'15GB',days:'30天',price:429}] },
  { id:3, flag:'🇺🇸', country:'美國', region:'美洲', plans:[{data:'5GB',days:'15天',price:299},{data:'15GB',days:'30天',price:499},{data:'無限',days:'30天',price:799}] },
  { id:4, flag:'🇬🇧', country:'英國', region:'歐洲', plans:[{data:'5GB',days:'15天',price:319},{data:'20GB',days:'30天',price:529}] },
  { id:5, flag:'🇹🇭', country:'泰國', region:'亞洲', plans:[{data:'3GB',days:'7天',price:169},{data:'10GB',days:'15天',price:299}] },
  { id:6, flag:'🇦🇺', country:'澳洲', region:'大洋洲', plans:[{data:'5GB',days:'14天',price:349},{data:'20GB',days:'30天',price:599}] },
];

let customers = [
  { name:'林美華', email:'lin@gmail.com', phone:'0912-111-222', orders:3, total:1047, last:'2025-04-25' },
  { name:'張志豪', email:'chang@gmail.com', phone:'0923-333-444', orders:1, total:229, last:'2025-04-24' },
  { name:'陳雅婷', email:'chen@yahoo.tw', phone:'0934-555-666', orders:2, total:1328, last:'2025-04-24' },
  { name:'王建國', email:'wang@outlook.com', phone:'0945-777-888', orders:1, total:529, last:'2025-04-23' },
  { name:'黃淑芬', email:'huang@gmail.com', phone:'0956-999-000', orders:4, total:876, last:'2025-04-23' },
  { name:'李怡君', email:'lee@gmail.com', phone:'0967-111-333', orders:2, total:698, last:'2025-04-22' },
];

let filteredOrders = [...orders];
let currentPage = 1;
const pageSize = 8;

// Date
const now = new Date();
document.getElementById('topbarDate').textContent = now.toLocaleDateString('zh-TW', {year:'numeric',month:'long',day:'numeric',weekday:'short'});

// Page switch
const pageTitles = { dashboard:'總覽儀表板', orders:'訂單管理', products:'商品管理', customers:'客戶管理', settings:'設定' };
function switchPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[id] || '';
  if (id === 'orders') renderOrders();
  if (id === 'products') renderProducts();
  if (id === 'customers') renderCustomers();
}

// STATUS BADGE
function statusBadge(s) {
  const map = { '已完成':'badge-green', '處理中':'badge-blue', '待付款':'badge-yellow', '已取消':'badge-red' };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

// RECENT ORDERS
function renderRecentOrders() {
  document.getElementById('recentOrdersBody').innerHTML = orders.slice(0,5).map(o => `
    <tr>
      <td><span class="order-id">${o.id}</span></td>
      <td>${o.name}</td>
      <td>${o.product}</td>
      <td><strong>NT$${o.amount}</strong></td>
      <td>${statusBadge(o.status)}</td>
      <td style="color:var(--muted);font-size:0.8rem">${o.date}</td>
    </tr>
  `).join('');
}

// ORDERS
function renderOrders() {
  const start = (currentPage-1)*pageSize;
  const slice = filteredOrders.slice(start, start+pageSize);
  document.getElementById('orderTotal').textContent = filteredOrders.length;
  document.getElementById('ordersBody').innerHTML = slice.map(o => `
    <tr>
      <td><span class="order-id">${o.id}</span></td>
      <td><strong>${o.name}</strong></td>
      <td style="color:var(--muted);font-size:0.8rem">${o.email}</td>
      <td>${o.product}</td>
      <td><strong>NT$${o.amount}</strong></td>
      <td>
        <select class="status-select badge ${getStatusClass(o.status)}" onchange="changeOrderStatus('${o.id}', this.value)" style="padding:0.2rem 0.6rem">
          ${['已完成','處理中','待付款','已取消'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="color:var(--muted);font-size:0.8rem">${o.date}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.id}')">刪除</button>
      </td>
    </tr>
  `).join('');
  renderPagination();
}

function getStatusClass(s) {
  return { '已完成':'badge-green', '處理中':'badge-blue', '待付款':'badge-yellow', '已取消':'badge-red' }[s] || 'badge-gray';
}

function filterOrders(q) {
  filteredOrders = orders.filter(o =>
    o.id.toLowerCase().includes(q.toLowerCase()) ||
    o.name.includes(q) || o.email.includes(q) || o.product.includes(q)
  );
  currentPage = 1; renderOrders();
}

function filterOrderStatus(s) {
  filteredOrders = s ? orders.filter(o => o.status === s) : [...orders];
  currentPage = 1; renderOrders();
}

function changeOrderStatus(id, status) {
  const o = orders.find(x => x.id === id);
  if (o) { o.status = status; showToast('✅ 訂單狀態已更新'); renderRecentOrders(); }
}

function deleteOrder(id) {
  if (!confirm('確定要刪除此訂單？')) return;
  orders = orders.filter(o => o.id !== id);
  filteredOrders = filteredOrders.filter(o => o.id !== id);
  renderOrders(); renderRecentOrders();
  showToast('🗑️ 訂單已刪除');
}

function renderPagination() {
  const total = Math.ceil(filteredOrders.length / pageSize);
  let html = '';
  for (let i=1; i<=total; i++) html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  html += `<span class="page-info">第 ${currentPage}/${total||1} 頁，共 ${filteredOrders.length} 筆</span>`;
  document.getElementById('pagination').innerHTML = html;
}

function goPage(p) { currentPage = p; renderOrders(); }

// PRODUCTS
function renderProducts() {
  document.getElementById('productsGrid').innerHTML = products.map(p => `
    <div class="product-admin-card">
      <div class="pac-header">
        <div class="pac-country">
          <span class="pac-flag">${p.flag}</span>
          <div><div class="pac-name">${p.country}</div><div class="pac-region">${p.region}</div></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">刪除</button>
      </div>
      <div class="pac-body">
        ${p.plans.map((pl,i) => `
          <div class="plan-row">
            <div><strong>${pl.data}</strong> <span class="plan-row-info">/ ${pl.days}</span></div>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span class="plan-row-price" id="price-${p.id}-${i}">NT$${pl.price}</span>
              <input class="edit-price-input" id="input-${p.id}-${i}" value="${pl.price}" type="number"
                onblur="savePrice(${p.id},${i},this.value)" onkeydown="if(event.key==='Enter')this.blur()" />
              <button class="btn btn-outline btn-sm" onclick="editPrice(${p.id},${i})">✏️</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function editPrice(pid, idx) {
  document.getElementById(`price-${pid}-${idx}`).style.display = 'none';
  const inp = document.getElementById(`input-${pid}-${idx}`);
  inp.style.display = 'inline-block'; inp.focus();
}

function savePrice(pid, idx, val) {
  const p = products.find(x => x.id === pid);
  if (p && val) {
    p.plans[idx].price = parseInt(val);
    document.getElementById(`price-${pid}-${idx}`).textContent = `NT$${val}`;
    document.getElementById(`price-${pid}-${idx}`).style.display = 'inline';
    document.getElementById(`input-${pid}-${idx}`).style.display = 'none';
    showToast('✅ 價格已更新');
  }
}

function deleteProduct(id) {
  if (!confirm('確定刪除此商品？')) return;
  products = products.filter(p => p.id !== id);
  renderProducts(); showToast('🗑️ 商品已刪除');
}

// CUSTOMERS
function renderCustomers() {
  document.getElementById('customersBody').innerHTML = customers.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--muted);font-size:0.82rem">${c.email}</td>
      <td style="color:var(--muted);font-size:0.82rem">${c.phone}</td>
      <td><span class="badge badge-blue">${c.orders} 筆</span></td>
      <td><strong>NT$${c.total.toLocaleString()}</strong></td>
      <td style="color:var(--muted);font-size:0.82rem">${c.last}</td>
      <td><button class="btn btn-outline btn-sm">查看訂單</button></td>
    </tr>
  `).join('');
}

function filterCustomers(q) {
  const filtered = customers.filter(c => c.name.includes(q) || c.email.includes(q));
  document.getElementById('customersBody').innerHTML = filtered.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--muted);font-size:0.82rem">${c.email}</td>
      <td style="color:var(--muted);font-size:0.82rem">${c.phone}</td>
      <td><span class="badge badge-blue">${c.orders} 筆</span></td>
      <td><strong>NT$${c.total.toLocaleString()}</strong></td>
      <td style="color:var(--muted);font-size:0.82rem">${c.last}</td>
      <td><button class="btn btn-outline btn-sm">查看訂單</button></td>
    </tr>
  `).join('');
}

// BAR CHART
function renderBarChart() {
  const days = ['週一','週二','週三','週四','週五','週六','週日'];
  const revenue = [8.2, 12.5, 9.8, 14.1, 11.3, 16.8, 13.2];
  const orderCount = [21, 34, 26, 38, 29, 44, 36];
  const maxR = Math.max(...revenue);
  const maxO = Math.max(...orderCount);
  document.getElementById('barChart').innerHTML = days.map((d,i) => `
    <div class="bar-group">
      <div style="display:flex;gap:2px;align-items:flex-end;height:100px;width:100%">
        <div class="bar" style="height:${(revenue[i]/maxR)*100}%" title="NT$${revenue[i]}萬"></div>
        <div class="bar accent2" style="height:${(orderCount[i]/maxO)*100}%" title="${orderCount[i]}筆"></div>
      </div>
      <div class="bar-label">${d}</div>
    </div>
  `).join('');
}

// MODALS
function openAddOrder() { document.getElementById('addOrderModal').classList.add('open'); }
function openAddProduct() { document.getElementById('addProductModal').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function saveNewOrder() {
  const name = document.getElementById('o_name').value;
  const email = document.getElementById('o_email').value;
  const phone = document.getElementById('o_phone').value;
  const country = document.getElementById('o_country').value;
  const plan = document.getElementById('o_plan').value;
  const price = parseInt(document.getElementById('o_price').value) || 0;
  const status = document.getElementById('o_status').value;
  if (!name || !email) { showToast('⚠️ 請填寫姓名與Email'); return; }
  const newId = `ORD-2025-${String(orders.length+1).padStart(3,'0')}`;
  const today = new Date().toISOString().split('T')[0];
  orders.unshift({ id:newId, name, email, phone, product:`${country} ${plan}`, amount:price, status, date:today });
  filteredOrders = [...orders];
  closeModal('addOrderModal');
  renderOrders(); renderRecentOrders();
  showToast('✅ 訂單已新增');
}

function saveNewProduct() {
  const flag = document.getElementById('p_flag').value;
  const country = document.getElementById('p_country').value;
  const region = document.getElementById('p_region').value;
  const d1 = document.getElementById('p_d1').value;
  const day1 = document.getElementById('p_day1').value;
  const price1 = parseInt(document.getElementById('p_price1').value);
  const d2 = document.getElementById('p_d2').value;
  const day2 = document.getElementById('p_day2').value;
  const price2 = parseInt(document.getElementById('p_price2').value);
  if (!flag || !country) { showToast('⚠️ 請填寫國旗與國家'); return; }
  const plans = [];
  if (d1 && day1 && price1) plans.push({ data:d1, days:day1, price:price1 });
  if (d2 && day2 && price2) plans.push({ data:d2, days:day2, price:price2 });
  products.push({ id: Date.now(), flag, country, region, plans });
  closeModal('addProductModal');
  renderProducts();
  showToast('✅ 商品已新增');
}

// TOAST
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// INIT
renderRecentOrders();
renderBarChart();
</script>
</body>
</html>
