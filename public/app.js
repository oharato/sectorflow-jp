// State management
let sectorsData = [];
let filteredSectors = [];
let searchQuery = '';
let currentFilter = 'all'; // 'all', 'gain', 'loss'
let currentSort = { key: 'pct', order: 'desc' }; // key can be 'id', 'name', 'price', 'change', 'pct'
let currentView = 'grid'; // 'grid' or 'list'

// DOM Elements
const heatmapGrid = document.getElementById('heatmap-grid');
const sectorsTableBody = document.getElementById('sectors-table-body');
const searchInput = document.getElementById('search-input');
const tabButtons = document.querySelectorAll('.tab-btn');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');
const gridViewPane = document.getElementById('grid-view');
const listViewPane = document.getElementById('list-view');
const refreshBtn = document.getElementById('refresh-btn');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const updateTime = document.getElementById('update-time');

// Stat Widgets
const topGainerName = document.getElementById('top-gainer-name');
const topGainerPct = document.getElementById('top-gainer-pct');
const topLoserName = document.getElementById('top-loser-name');
const topLoserPct = document.getElementById('top-loser-pct');
const gainCountEl = document.getElementById('gain-count');
const lossCountEl = document.getElementById('loss-count');
const breadthGainBar = document.getElementById('breadth-gain-bar');

// Drawer Elements
const detailDrawer = document.getElementById('detail-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const closeDrawerBtn = document.getElementById('close-drawer-btn');
const drawerSectorCode = document.getElementById('drawer-sector-code');
const drawerSectorName = document.getElementById('drawer-sector-name');
const drawerSectorNameEn = document.getElementById('drawer-sector-name-en');
const drawerSectorPrice = document.getElementById('drawer-sector-price');
const drawerSectorChange = document.getElementById('drawer-sector-change');
const drawerSectorPct = document.getElementById('drawer-sector-pct');
const drawerStocksList = document.getElementById('drawer-stocks-list');

// Initialize the App
document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    filterAndRender();
  });

  // Filter Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      filterAndRender();
    });
  });

  // View Toggles
  viewGridBtn.addEventListener('click', () => toggleView('grid'));
  viewListBtn.addEventListener('click', () => toggleView('list'));

  // Refresh Button
  refreshBtn.addEventListener('click', fetchData);

  // Table Headers Sorting
  document.querySelectorAll('.sectors-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const isAsc = currentSort.key === key && currentSort.order === 'asc';
      
      currentSort.key = key;
      currentSort.order = isAsc ? 'desc' : 'asc';
      
      // Update visual header sorting classes
      document.querySelectorAll('.sectors-table th.sortable').forEach(header => {
        header.classList.remove('active-sort', 'desc');
      });
      th.classList.add('active-sort');
      if (currentSort.order === 'desc') {
        th.classList.add('desc');
      }
      
      sortAndRenderTable();
    });
  });

  // Close Drawer
  closeDrawerBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
}

// Fetch Data from local files (data.js or data.json)
async function fetchData() {
  setLoadingState(true);
  try {
    // 1. Check if data is already loaded in window (for zero-dependency file:// direct opening)
    if (window.sectorData && window.sectorData.success) {
      console.log('Loading sector data from window.sectorData...');
      sectorsData = window.sectorData.sectors;
      updateStatusBadge(false, true);
      
      const timeStr = new Date(window.sectorData.timestamp).toLocaleTimeString('ja-JP', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      updateTime.textContent = `最終更新: ${timeStr}`;
      calculateMarketStats();
      filterAndRender();
      setLoadingState(false);
      return;
    }

    // 2. Fallback to fetching data.json (for web servers)
    console.log('Fetching local data.json...');
    const response = await fetch('data.json');
    const result = await response.json();
    
    if (result.success) {
      sectorsData = result.sectors;
      updateStatusBadge(false, true);
      const timeStr = new Date(result.timestamp).toLocaleTimeString('ja-JP', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      updateTime.textContent = `最終更新: ${timeStr}`;
      calculateMarketStats();
      filterAndRender();
    } else {
      console.error('API Error:', result);
      showErrorMessage();
    }
  } catch (error) {
    console.error('Fetch Error:', error);
    showErrorMessage();
  } finally {
    setLoadingState(false);
  }
}

// Set UI Loading State
function setLoadingState(isLoading) {
  if (isLoading) {
    statusBadge.className = 'status-badge loading';
    statusText.textContent = 'データを同期中...';
    refreshBtn.classList.add('shimmer');
  } else {
    refreshBtn.classList.remove('shimmer');
  }
}

// Update Status Badge UI based on source type
function updateStatusBadge(isMock, isCached) {
  if (isMock) {
    statusBadge.className = 'status-badge simulated';
    statusText.textContent = 'シミュレーション稼働中';
  } else {
    statusBadge.className = 'status-badge live';
    statusText.textContent = isCached ? '東証データ (キャッシュ)' : '東証データ (リアルタイム)';
  }
}

// Display error fallback
function showErrorMessage() {
  statusBadge.className = 'status-badge';
  statusBadge.style.color = '#ef4444';
  statusText.textContent = '同期エラー (オフライン)';
}

// Toggle Grid / List views
function toggleView(view) {
  currentView = view;
  if (view === 'grid') {
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    gridViewPane.classList.add('active');
    listViewPane.classList.remove('active');
  } else {
    viewGridBtn.classList.remove('active');
    viewListBtn.classList.add('active');
    gridViewPane.classList.remove('active');
    listViewPane.classList.add('active');
  }
}

// Calculate Market Breadth and Top Gainers/Losers
function calculateMarketStats() {
  if (sectorsData.length === 0) return;
  
  // Sort sectors by percentage change
  const sorted = [...sectorsData].sort((a, b) => b.changePercent - a.changePercent);
  
  const topGainer = sorted[0];
  const topLoser = sorted[sorted.length - 1];
  
  // Update Top Stats widgets
  topGainerName.textContent = topGainer.nameJa;
  topGainerPct.textContent = `+${topGainer.changePercent.toFixed(2)}%`;
  
  topLoserName.textContent = topLoser.nameJa;
  topLoserPct.textContent = `${topLoser.changePercent.toFixed(2)}%`;
  
  // Calculate Breadth
  const gainers = sectorsData.filter(s => s.changePercent > 0).length;
  const losers = sectorsData.filter(s => s.changePercent < 0).length;
  const total = sectorsData.length;
  
  gainCountEl.textContent = gainers;
  lossCountEl.textContent = losers;
  
  const gainPercent = total > 0 ? (gainers / total) * 100 : 50;
  breadthGainBar.style.width = `${gainPercent}%`;
}

// Filter sectors list based on search query & tabs
function filterAndRender() {
  filteredSectors = sectorsData.filter(sector => {
    // Search filter
    const matchesSearch = sector.nameJa.toLowerCase().includes(searchQuery) || 
                          sector.nameEn.toLowerCase().includes(searchQuery) ||
                          sector.id.includes(searchQuery);
    
    // Tab filter
    let matchesTab = true;
    if (currentFilter === 'gain') {
      matchesTab = sector.changePercent > 0;
    } else if (currentFilter === 'loss') {
      matchesTab = sector.changePercent < 0;
    }
    
    return matchesSearch && matchesTab;
  });
  
  renderHeatmap();
  sortAndRenderTable();
}

// Render Heatmap view (Grid of cards)
function renderHeatmap() {
  heatmapGrid.innerHTML = '';
  
  if (filteredSectors.length === 0) {
    heatmapGrid.innerHTML = '<div class="no-results">一致する業種が見つかりません</div>';
    return;
  }
  
  filteredSectors.forEach(sector => {
    const card = document.createElement('div');
    const isPositive = sector.changePercent > 0;
    const isNegative = sector.changePercent < 0;
    
    let typeClass = 'flat';
    if (isPositive) typeClass = 'gain';
    if (isNegative) typeClass = 'loss';
    
    card.className = `sector-card glass-card ${typeClass}`;
    
    // Customize HSL background opacity based on the change percentage magnitude
    const magnitude = Math.min(Math.abs(sector.changePercent) / 2.5, 1.0); // capped at 2.5% max saturation
    if (isPositive) {
      card.style.backgroundColor = `rgba(16, 185, 129, ${0.05 + magnitude * 0.15})`;
      card.style.borderColor = `rgba(16, 185, 129, ${0.15 + magnitude * 0.35})`;
    } else if (isNegative) {
      card.style.backgroundColor = `rgba(244, 63, 94,  ${0.05 + magnitude * 0.15})`;
      card.style.borderColor = `rgba(244, 63, 94,  ${0.15 + magnitude * 0.35})`;
    }
    
    const displayPct = isPositive ? `+${sector.changePercent.toFixed(2)}%` : `${sector.changePercent.toFixed(2)}%`;
    const changeClass = isPositive ? 'text-gain' : (isNegative ? 'text-loss' : '');
    
    card.innerHTML = `
      <div class="sector-card-top">
        <span class="sector-name-ja">${sector.nameJa}</span>
        <span class="sector-code">${sector.id}</span>
      </div>
      <div class="sector-card-bottom">
        <span class="sector-card-price">${sector.price.toLocaleString('ja-JP')}</span>
        <span class="sector-card-pct ${changeClass}">${displayPct}</span>
      </div>
    `;
    
    card.addEventListener('click', () => openDrawer(sector));
    heatmapGrid.appendChild(card);
  });
}

// Sort and Render Table view (List of rows)
function sortAndRenderTable() {
  sectorsTableBody.innerHTML = '';
  
  // Sort the filtered array
  const key = currentSort.key;
  const order = currentSort.order === 'asc' ? 1 : -1;
  
  const sorted = [...filteredSectors].sort((a, b) => {
    if (key === 'id') return a.id.localeCompare(b.id) * order;
    if (key === 'name') return a.nameJa.localeCompare(b.nameJa) * order;
    if (key === 'price') return (a.price - b.price) * order;
    if (key === 'change') {
      const aVal = parseFloat(a.change) || 0;
      const bVal = parseFloat(b.change) || 0;
      return (aVal - bVal) * order;
    }
    // Default or 'pct'
    return (a.changePercent - b.changePercent) * order;
  });
  
  if (sorted.length === 0) {
    sectorsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">一致する業種が見つかりません</td></tr>';
    return;
  }
  
  sorted.forEach(sector => {
    const tr = document.createElement('tr');
    const isPositive = sector.changePercent > 0;
    const isNegative = sector.changePercent < 0;
    
    let badgeClass = 'flat';
    let displayPct = `${sector.changePercent.toFixed(2)}%`;
    if (isPositive) {
      badgeClass = 'gain';
      displayPct = `+${displayPct}`;
    } else if (isNegative) {
      badgeClass = 'loss';
    }
    
    // Render progress bar alignment inside table
    let vizFillHtml = '';
    const absPct = Math.min(Math.abs(sector.changePercent), 3); // cap visualization bar at 3%
    const barWidth = (absPct / 3) * 50; // max width 50% from center
    
    if (isPositive) {
      vizFillHtml = `<div class="mini-breadth-fill gain" style="width: ${barWidth}px; margin-left: 50%;"></div>`;
    } else if (isNegative) {
      vizFillHtml = `<div class="mini-breadth-fill loss" style="width: ${barWidth}px; margin-right: 50%; margin-left: auto;"></div>`;
    } else {
      vizFillHtml = `<div style="width: 4px; height: 100%; background: #6b7280; margin: 0 auto;"></div>`;
    }

    tr.innerHTML = `
      <td class="table-sector-code">${sector.id}</td>
      <td>
        <span class="table-sector-name">${sector.nameJa}</span>
        <span class="table-sector-en">${sector.nameEn}</span>
      </td>
      <td class="text-right font-digit">${sector.price.toLocaleString('ja-JP', { minimumFractionDigits: 1 })}</td>
      <td class="text-right font-digit ${isPositive ? 'text-gain' : (isNegative ? 'text-loss' : '')}">${sector.change}</td>
      <td class="text-right">
        <span class="pct-pill ${badgeClass}">${displayPct}</span>
      </td>
      <td class="viz-cell">
        <div class="mini-breadth-bar">
          ${vizFillHtml}
        </div>
      </td>
    `;
    
    tr.addEventListener('click', () => openDrawer(sector));
    sectorsTableBody.appendChild(tr);
  });
}

// Drawer Slider actions
function openDrawer(sector) {
  drawerSectorCode.textContent = `CODE ${sector.id}`;
  drawerSectorName.textContent = sector.nameJa;
  drawerSectorNameEn.textContent = sector.nameEn;
  drawerSectorPrice.textContent = sector.price.toLocaleString('ja-JP', { minimumFractionDigits: 1 });
  
  const isPositive = sector.changePercent > 0;
  const isNegative = sector.changePercent < 0;
  
  drawerSectorChange.textContent = sector.change;
  drawerSectorPct.textContent = isPositive ? `+${sector.changePercent.toFixed(2)}%` : `${sector.changePercent.toFixed(2)}%`;
  
  // Reset typography styling classes
  drawerSectorChange.className = 'change-value ' + (isPositive ? 'text-gain' : (isNegative ? 'text-loss' : ''));
  drawerSectorPct.className = 'change-pct ' + (isPositive ? 'text-gain' : (isNegative ? 'text-loss' : ''));
  
  // Render component stocks list directly from in-memory sector object
  drawerStocksList.innerHTML = '';
  if (sector.stocks && sector.stocks.length > 0) {
    sector.stocks.forEach(stock => {
      const item = document.createElement('div');
      item.className = 'stock-item';
      
      const changePctVal = typeof stock.changePercent === 'string' 
        ? parseFloat(stock.changePercent.replace(/%/g, '')) 
        : stock.changePercent;
      
      const sPos = changePctVal > 0;
      const sNeg = changePctVal < 0;
      const sClass = sPos ? 'gain' : (sNeg ? 'loss' : 'flat');
      
      // Stock change percent display text
      const pctDisplay = typeof stock.changePercent === 'string' 
        ? stock.changePercent 
        : (sPos ? `+${stock.changePercent.toFixed(2)}%` : `${stock.changePercent.toFixed(2)}%`);

      // Stock price display text
      const priceDisplay = typeof stock.price === 'string' 
        ? stock.price 
        : stock.price.toLocaleString('ja-JP') + '円';
      
      const priceSuffix = typeof stock.price === 'string' ? '円' : '';
      const marketDisplay = stock.market ? ` | ${stock.market}` : '';

      item.innerHTML = `
        <div class="stock-name-info">
          <span class="stock-code">東証 ${stock.code}${marketDisplay}</span>
          <span class="stock-name">${stock.name}</span>
        </div>
        <div class="stock-price-info">
          <span class="stock-price font-digit">${priceDisplay}${priceSuffix}</span>
          <span class="stock-pct ${sClass}">${pctDisplay}</span>
        </div>
      `;
      drawerStocksList.appendChild(item);
    });
  } else {
    drawerStocksList.innerHTML = '<div class="no-stocks" style="font-size: 0.95rem; color: var(--text-secondary); text-align: center; padding: 24px 0;">銘柄データがありません。</div>';
  }



  // Show drawer
  detailDrawer.classList.add('open');
}

function closeDrawer() {
  detailDrawer.classList.remove('open');
}


