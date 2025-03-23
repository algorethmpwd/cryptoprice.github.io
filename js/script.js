// Theme Management
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const watchlistText = document.getElementById('watchlist-text');

// Check initial theme
if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    themeToggleLightIcon.classList.add('hidden');
    themeToggleDarkIcon.classList.remove('hidden');
} else {
    document.documentElement.classList.remove('dark');
    themeToggleLightIcon.classList.remove('hidden');
    themeToggleDarkIcon.classList.add('hidden');
}

// Theme toggle handler
themeToggleBtn.addEventListener('click', function() {
    themeToggleDarkIcon.classList.toggle('hidden');
    themeToggleLightIcon.classList.toggle('hidden');
    
    if (localStorage.getItem('color-theme')) {
        if (localStorage.getItem('color-theme') === 'light') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        }
    } else {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        }
    }
});

// Constants
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const UPDATE_INTERVAL = 60000; // Update every 60 seconds
let cryptoData = [];
let filteredData = [];
let watchlist = new Set(JSON.parse(localStorage.getItem('watchlist') || '[]'));
let previousPrices = new Map();
let isWatchlistActive = false;
let isInitialLoad = true;

// DOM Elements
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort-by');
const filterSelect = document.getElementById('filter-by');
const priceRangeSelect = document.getElementById('price-range');
const tableBody = document.getElementById('crypto-table-body');
const loadingSpinner = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const lastUpdatedSpan = document.getElementById('last-updated');
const toggleWatchlistBtn = document.getElementById('toggle-watchlist');

// Toggle watchlist view
toggleWatchlistBtn.addEventListener('click', () => {
    isWatchlistActive = !isWatchlistActive;
    watchlistText.textContent = isWatchlistActive ? 'Show All' : 'Show Watchlist';
    
    // Update the filter dropdown to match the watchlist state
    filterSelect.value = isWatchlistActive ? 'watchlist' : 'all';
    
    // Force a re-render of the table with the new filter
    if (isWatchlistActive) {
        filteredData = cryptoData.filter(coin => watchlist.has(coin.id));
    } else {
        filteredData = [...cryptoData];
    }
    updateTable(filteredData);
});

// Utility Functions
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    }).format(price);
};

const formatMarketCap = (marketCap) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(marketCap);
};

const formatPercentage = (percentage) => {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'always'
    }).format(percentage / 100);
};

const updateLastUpdated = () => {
    const now = new Date();
    lastUpdatedSpan.textContent = `Last updated: ${now.toLocaleTimeString()}`;
};

// Debounce function for search
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Create sparkline chart
const createSparkline = (containerId, data) => {
    const ctx = document.getElementById(containerId).getContext('2d');
    const isDarkMode = document.documentElement.classList.contains('dark');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(data.length).fill(''),
            datasets: [{
                data: data,
                borderColor: data[0] <= data[data.length - 1] ? '#22c55e' : '#ef4444',
                borderWidth: 1.5,
                fill: false,
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { 
                    display: false,
                    grid: {
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: { 
                    display: false,
                    grid: {
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
};

// Toggle watchlist
const toggleWatchlist = (coinId) => {
    if (watchlist.has(coinId)) {
        watchlist.delete(coinId);
    } else {
        watchlist.add(coinId);
    }
    localStorage.setItem('watchlist', JSON.stringify(Array.from(watchlist)));
    
    // If we're in watchlist view, update the display immediately
    if (isWatchlistActive || filterSelect.value === 'watchlist') {
        filteredData = cryptoData.filter(coin => watchlist.has(coin.id));
        updateTable(filteredData);
    } else {
        // Just update the current view
        updateTable(filteredData);
    }
};

// Make toggleWatchlist function globally accessible
window.toggleWatchlist = toggleWatchlist;

// Show loading skeleton
const showLoadingSkeleton = () => {
    if (!isInitialLoad) return; // Only show loading skeleton on initial load
    
    tableBody.innerHTML = Array(5).fill(`
        <tr class="animate-pulse">
            <td colspan="7" class="px-6 py-4">
                <div class="flex items-center space-x-4">
                    <div class="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
};

// Fetch cryptocurrency data
const fetchCryptoData = async () => {
    try {
        if (isInitialLoad) {
            loadingSpinner.classList.remove('hidden');
        }
        errorDiv.classList.add('hidden');
        showLoadingSkeleton();

        const [marketData, sparklineData] = await Promise.all([
            fetch(`${COINGECKO_API_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=true`),
            fetch(`${COINGECKO_API_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=true&price_change_percentage=24h`)
        ]);

        if (!marketData.ok || !sparklineData.ok) {
            throw new Error(`Failed to fetch data: ${marketData.statusText} ${sparklineData.statusText}`);
        }

        const [markets, sparklines] = await Promise.all([
            marketData.json(),
            sparklineData.json()
        ]);

        // Store previous prices for animation
        cryptoData.forEach(coin => {
            previousPrices.set(coin.id, coin.current_price);
        });

        cryptoData = markets.map((coin, index) => ({
            ...coin,
            sparkline_data: sparklines[index]?.sparkline_in_7d?.price || []
        }));

        // Update filtered data based on current view
        if (isWatchlistActive) {
            filteredData = cryptoData.filter(coin => watchlist.has(coin.id));
        } else {
            filteredData = [...cryptoData];
        }
        
        updateLastUpdated();
        applyFiltersAndSort();
        isInitialLoad = false;
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        errorDiv.classList.remove('hidden');
        document.getElementById('error-message').textContent = error.message;
    } finally {
        loadingSpinner.classList.add('hidden');
    }
};

// Update table with filtered and sorted data
const updateTable = (data) => {
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No cryptocurrencies found matching your criteria
                </td>
            </tr>
        `;
        return;
    }
    
    data.forEach(coin => {
        const row = document.createElement('tr');
        const priceChangeClass = coin.price_change_percentage_24h >= 0 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400';

        // Add price change animation
        const previousPrice = previousPrices.get(coin.id);
        if (previousPrice) {
            if (coin.current_price > previousPrice) {
                row.classList.add('price-up');
            } else if (coin.current_price < previousPrice) {
                row.classList.add('price-down');
            }
        }

        const sparklineId = `sparkline-${coin.id}`;
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <img src="${coin.image}" alt="${coin.name}" class="w-8 h-8 rounded-full">
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${coin.name}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${coin.symbol.toUpperCase()}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-gray-100">${formatPrice(coin.current_price)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <canvas id="${sparklineId}" class="h-16 w-32"></canvas>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm ${priceChangeClass}">
                    ${formatPercentage(coin.price_change_percentage_24h)}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-gray-100">${formatMarketCap(coin.market_cap)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-gray-100">${formatMarketCap(coin.total_volume)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="toggleWatchlist('${coin.id}')" class="text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors">
                    <i class="fas fa-star ${watchlist.has(coin.id) ? 'text-yellow-500 dark:text-yellow-400' : ''}"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);

        // Create sparkline chart
        if (coin.sparkline_data?.length > 0) {
            createSparkline(sparklineId, coin.sparkline_data);
        }
    });
};

// Filter and sort data
const applyFiltersAndSort = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const sortBy = sortSelect.value;
    const filterBy = filterSelect.value;
    const priceRange = priceRangeSelect.value;

    // Start with the appropriate dataset based on watchlist state
    let filtered = isWatchlistActive ? 
        cryptoData.filter(coin => watchlist.has(coin.id)) : 
        [...cryptoData];

    // Apply search filter
    filtered = filtered.filter(coin => 
        coin.name.toLowerCase().includes(searchTerm) || 
        coin.symbol.toLowerCase().includes(searchTerm)
    );

    // Apply price range filter
    if (priceRange !== 'all') {
        const [min, max] = priceRange.split('-').map(Number);
        filtered = filtered.filter(coin => {
            if (priceRange === '1000+') {
                return coin.current_price >= 1000;
            }
            return coin.current_price >= min && coin.current_price <= max;
        });
    }

    // Apply gainers/losers filter if not in watchlist mode
    if (!isWatchlistActive) {
        switch (filterBy) {
            case 'gainers':
                filtered = filtered.filter(coin => coin.price_change_percentage_24h > 0);
                break;
            case 'losers':
                filtered = filtered.filter(coin => coin.price_change_percentage_24h < 0);
                break;
            case 'watchlist':
                filtered = filtered.filter(coin => watchlist.has(coin.id));
                break;
        }
    }

    // Apply sorting
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'price':
                return b.current_price - a.current_price;
            case 'change':
                return b.price_change_percentage_24h - a.price_change_percentage_24h;
            case 'volume':
                return b.total_volume - a.total_volume;
            case 'market_cap':
            default:
                return b.market_cap - a.market_cap;
        }
    });

    filteredData = filtered;
    updateTable(filteredData);
};

// Event Listeners
searchInput.addEventListener('input', debounce(() => applyFiltersAndSort(), 300));
sortSelect.addEventListener('change', applyFiltersAndSort);
filterSelect.addEventListener('change', () => {
    isWatchlistActive = filterSelect.value === 'watchlist';
    watchlistText.textContent = isWatchlistActive ? 'Show All' : 'Show Watchlist';
    applyFiltersAndSort();
});
priceRangeSelect.addEventListener('change', applyFiltersAndSort);

// Initialize
const initialize = () => {
    fetchCryptoData();
    // Set up periodic updates
    setInterval(fetchCryptoData, UPDATE_INTERVAL);
};

// Start the application
initialize();
