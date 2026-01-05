// Main Application Class
class ADAHApp {
    constructor() {
        this.db = new Database();
        this.currentEditId = null;
        this.currentTab = 'stock';
        this.charts = {};
        this.touchGestures = {
            initialTouch: null,
            currentTouch: null,
            lastTouch: null,
            isScrolling: false,
            swipeThreshold: 50,
            pinchStartDistance: 0,
            zoomLevel: 1
        };
        
        // Initialize virtual scrolling state
        this.virtualScrollState = {
            stock: {
                allData: [],
                startIndex: 0,
                endIndex: 0,
                containerHeight: 0,
                visibleItems: 0,
                itemHeight: 60
            },
            sales: {
                allData: [],
                stockMap: {},
                startIndex: 0,
                endIndex: 0,
                containerHeight: 0,
                visibleItems: 0,
                itemHeight: 65
            },
            customers: {
                allData: [],
                startIndex: 0,
                endIndex: 0,
                containerHeight: 0,
                visibleItems: 0,
                itemHeight: 55
            }
        };
        
        this.init();
    }

    async init() {
        try {
            // Initialize database with enhanced offline support
            await this.db.initEnhanced();
            console.log('Database initialized successfully with offline support');

            // PWA functionality temporarily disabled for stability
            // Core application features remain fully functional
            
            // Set up event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadAllData();

            // Set up navigation
            this.setupNavigation();

            // Initialize year dropdown
            this.initializeYearDropdown();

            // Show connection status
            this.updateConnectionStatus();

            // Set up touch gestures for mobile
            this.setupTouchGestures();

            // Enhance accessibility
            this.enhanceAccessibility();
            
            // Set up real-time net revenue updates
            this.setupRealTimeUpdates();

            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            // Silent failure handling - notifications removed for cleaner UX
        }
    }

    updateConnectionStatus() {
        // Add connection status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'connectionStatus';
        statusIndicator.className = 'connection-status';
        document.body.appendChild(statusIndicator);
        
        const updateStatus = () => {
            const isOnline = navigator.onLine;
            statusIndicator.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
            statusIndicator.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
            statusIndicator.title = isOnline ? 'Connected to internet' : 'Working offline';
        };
        
        updateStatus();
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.nav-btn').dataset.tab;
                this.switchTab(tab);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        
        // Debounced search
        const debouncedSearch = debounce(async (query) => {
            if (query.trim().length === 0) {
                searchResults.style.display = 'none';
                return;
            }
            
            const results = [];
            const allRecords = await this.db.getAllRecords('sales');
            
            allRecords.forEach((record, index) => {
                const searchableText = `${record.customer_name || ''} ${record.customer_phone || ''} ${record.total_amount || ''}`.toLowerCase();
                if (searchableText.includes(query.toLowerCase())) {
                    results.push({ record, index });
                }
            });
            
            displaySearchResults(results.slice(0, 10)); // Limit to 10 results
        }, 300);
        
        const self = this;
        function displaySearchResults(results) {
            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
            } else {
                searchResults.innerHTML = results.map(({ record, index }) => `
                    <div class="search-result-item" data-index="${index}">
                        <div class="search-result-name">${record.debtor || 'Unknown'}</div>
                        <div class="search-result-details">${record.address || ''}</div>
                        <div class="search-result-mobile">${record.mobile || ''}</div>
                    </div>
                `).join('');
            }
            
            searchResults.style.display = 'block';
            
            // Add click handlers
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    const record = results.find(r => r.index === index)?.record;
                    if (record) {
                        self.showRecordDetails(record);
                        searchResults.style.display = 'none';
                        searchInput.value = '';
                    }
                });
            });
        }
        
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        // Hide search results when clicking outside
        document.addEventListener('click', (e) => {
            if (searchInput && searchResults && 
                !searchInput.contains(e.target) && 
                !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
        
        // Search on Enter
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstResult = searchResults?.querySelector('.search-result-item');
                if (firstResult && !firstResult.textContent.includes('No results')) {
                    firstResult.click();
                }
            }
            if (e.key === 'Escape') {
                searchResults?.style && (searchResults.style.display = 'none');
                searchInput?.blur();
            }
        });
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', this.debounce(async (e) => {
            await this.performSearch(e.target.value);
        }, 300));

        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                searchInput.value = '';
                this.clearSearch();
            });
        }

        // Stock management
        document.getElementById('addStockBtn').addEventListener('click', () => {
            this.showStockModal();
        });

        document.getElementById('stockForm').addEventListener('submit', (e) => {
            this.handleStockSubmit(e);
        });

        document.querySelectorAll('#stockModal .close, #cancelStockBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideStockModal();
            });
        });

        // Sales management
        document.getElementById('addSaleBtn').addEventListener('click', () => {
            this.showSaleModal();
        });

        document.getElementById('saleForm').addEventListener('submit', (e) => {
            this.handleSaleSubmit(e);
        });

        document.querySelectorAll('#saleModal .close, #cancelSaleBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideSaleModal();
            });
        });

        // Reports
        document.getElementById('generateDailyReport').addEventListener('click', () => {
            this.generateDailyReport();
        });

        document.getElementById('generateWeeklyReport').addEventListener('click', () => {
            this.generateWeeklyReport();
        });

        document.getElementById('generateMonthlyReport').addEventListener('click', () => {
            this.generateMonthlyReport();
        });

        // Customer export
        document.getElementById('exportCustomersBtn').addEventListener('click', () => {
            this.exportCustomerPDF();
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });
    }

    setupNavigation() {
        // Set initial active tab
        this.switchTab('stock');
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.loadStock(),
                this.loadSales(),
                this.loadCustomers(),
                this.updateHeaderStats(),
                this.loadAnalytics()
            ]);
        } catch (error) {
            console.error('Failed to load data:', error);
            // Silent failure handling - notifications removed for cleaner UX
        }
    }

    // Navigation Methods
    switchTab(tabName) {
        // Clean up existing virtual scrolling resources
        this.cleanupVirtualScrolling();
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load data for the specific tab
        switch (tabName) {
            case 'stock':
                this.loadStock();
                break;
            case 'sales':
                this.loadSales();
                break;
            case 'customers':
                this.loadCustomers();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    // Stock Management Methods
    async loadStock() {
        try {
            const stock = await this.db.getAllStock();
            const tbody = document.getElementById('stockTableBody');
            
            // Always use regular rendering
            tbody.innerHTML = '';
            stock.forEach(item => {
                const row = document.createElement('tr');
                const createdDate = item.created_date ? new Date(item.created_date).toLocaleDateString() : '-';
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${item.description || '-'}</td>
                    <td>${createdDate}</td>
                    <td class="actions">
                        <button class="action-btn edit-btn" onclick="app.editStock(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="app.deleteStock(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load stock:', error);
            this.showToast('Failed to load stock data', 'error');
        }
    }

    showStockModal(id = null) {
        const modal = document.getElementById('stockModal');
        const title = document.getElementById('stockModalTitle');
        const form = document.getElementById('stockForm');
        
        this.currentEditId = id;
        
        if (id) {
            title.textContent = 'Edit Stock Item';
            this.populateStockForm(id);
        } else {
            title.textContent = 'Add Stock Item';
            form.reset();
            this.currentEditId = null;
        }
        
        // Show modal using CSS class
        modal.classList.add('modal-open');
        document.body.classList.add('modal-open');
        
        // Scroll to top of modal content
        const modalForm = modal.querySelector('.modal-form');
        if (modalForm) {
            modalForm.scrollTop = 0;
            // Ensure smooth scrolling is enabled
            modalForm.style.scrollBehavior = 'smooth';
        }
        
        // Focus first input with a small delay
        setTimeout(() => {
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    async populateStockForm(id) {
        try {
            const item = await this.db.getStockById(id);
            if (item) {
                document.getElementById('stockId').value = item.id;
                document.getElementById('stockName').value = item.name;
                document.getElementById('stockQuantity').value = item.quantity;
                document.getElementById('stockPrice').value = item.price;
                document.getElementById('stockDescription').value = item.description || '';
            }
        } catch (error) {
            console.error('Failed to populate stock form:', error);
            this.showToast('Failed to load stock item', 'error');
        }
    }

    hideStockModal() {
        const modal = document.getElementById('stockModal');
        modal.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        document.getElementById('stockForm').reset();
        this.currentEditId = null;
        
        // Clear any scroll locks
        this.clearScrollLocks();
    }

    async handleStockSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            name: document.getElementById('stockName').value,
            quantity: parseInt(document.getElementById('stockQuantity').value),
            price: parseFloat(document.getElementById('stockPrice').value),
            description: document.getElementById('stockDescription').value
        };

        try {
            if (this.currentEditId) {
                await this.db.updateStock(this.currentEditId, data.name, data.quantity, data.price, data.description);
                this.showToast('Stock item updated successfully', 'success');
            } else {
                await this.db.addStock(data.name, data.quantity, data.price, data.description);
                this.showToast('Stock item added successfully', 'success');
            }
            
            this.hideStockModal();
            await this.loadStock();
            await this.updateHeaderStats();
        } catch (error) {
            console.error('Failed to save stock item:', error);
            this.showToast(error.message, 'error');
        }
    }

    async editStock(id) {
        this.showStockModal(id);
    }

    async deleteStock(id) {
        if (confirm('Are you sure you want to delete this stock item?')) {
            try {
                await this.db.deleteStock(id);
                this.showToast('Stock item deleted successfully', 'success');
                await this.loadStock();
                await this.updateHeaderStats();
            } catch (error) {
                console.error('Failed to delete stock item:', error);
                this.showToast(error.message, 'error');
            }
        }
    }

    // Sales Management Methods
    async loadSales() {
        try {
            const sales = await this.db.getAllSales();
            const stock = await this.db.getAllStock();
            const stockMap = {};
            stock.forEach(item => {
                stockMap[item.id] = item.name;
            });

            const tbody = document.getElementById('salesTableBody');
            
            // Always use regular rendering
            tbody.innerHTML = '';
            
            sales.forEach(sale => {
                const row = document.createElement('tr');
                const statusClass = sale.paid ? 'status-paid' : 'status-debt';
                const statusText = sale.paid ? 'Paid' : 'Debt';
                const createdDate = sale.created_date ? new Date(sale.created_date).toLocaleDateString() : '-';
                
                let actionsHtml = `
                    <button class="action-btn edit-btn" onclick="app.editSale(${sale.id})" title="Edit Sale">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteSale(${sale.id})" title="Delete Sale">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                
                // Add debtor action button for debt sales
                if (!sale.paid && sale.customer_phone) {
                    actionsHtml += `
                        <button class="action-btn debtor-action-btn" onclick="app.showDebtorActions(${sale.id})" title="Contact Debtor">
                            <i class="fas fa-phone"></i>
                        </button>
                    `;
                }
                
                row.innerHTML = `
                    <td>${sale.id}</td>
                    <td>${sale.date}</td>
                    <td>${stockMap[sale.item_id] || 'Unknown'}</td>
                    <td>${sale.quantity_sold}</td>
                    <td>${sale.total_amount.toFixed(2)}</td>
                    <td>${sale.customer_name || '-'}</td>
                    <td>${sale.customer_phone || '-'}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${createdDate}</td>
                    <td class="actions">${actionsHtml}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load sales:', error);
            this.showToast('Failed to load sales data', 'error');
        }
    }

    async populateSaleForm(id = null) {
        try {
            const stock = await this.db.getAllStock();
            const select = document.getElementById('saleItem');
            
            select.innerHTML = '<option value="">Select an item</option>';
            stock.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} (Stock: ${item.quantity})`;
                select.appendChild(option);
            });

            if (id) {
                const sale = await this.db.getSaleById(id);
                if (sale) {
                    document.getElementById('saleId').value = sale.id;
                    document.getElementById('saleItem').value = sale.item_id;
                    document.getElementById('saleQuantity').value = sale.quantity_sold;
                    document.getElementById('saleCustomer').value = sale.customer_name || '';
                    document.getElementById('salePhone').value = sale.customer_phone || '';
                    document.getElementById('salePaid').value = sale.paid;
                }
            }
        } catch (error) {
            console.error('Failed to populate sale form:', error);
            this.showToast('Failed to load sale form', 'error');
        }
    }

    showSaleModal(id = null) {
        const modal = document.getElementById('saleModal');
        const title = document.getElementById('saleModalTitle');
        
        this.currentEditId = id;
        
        if (id) {
            title.textContent = 'Edit Sale';
        } else {
            title.textContent = 'Add Sale';
        }
        
        this.populateSaleForm(id);
        
        // Show modal using CSS class
        modal.classList.add('modal-open');
        
        // Scroll to top of modal content
        const modalForm = modal.querySelector('.modal-form');
        if (modalForm) {
            modalForm.scrollTop = 0;
        }
        
        // Focus first input with a small delay
        setTimeout(() => {
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    hideSaleModal() {
        const modal = document.getElementById('saleModal');
        modal.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        document.getElementById('saleForm').reset();
        this.currentEditId = null;
        
        // Clear any scroll locks
        this.clearScrollLocks();
    }

    async handleSaleSubmit(e) {
        e.preventDefault();
        
        const data = {
            itemId: document.getElementById('saleItem').value,
            quantitySold: parseInt(document.getElementById('saleQuantity').value),
            customerName: document.getElementById('saleCustomer').value,
            customerPhone: document.getElementById('salePhone').value,
            paid: parseInt(document.getElementById('salePaid').value)
        };

        // Calculate total amount
        const stockItem = await this.db.getStockById(data.itemId);
        const totalAmount = data.quantitySold * stockItem.price;

        try {
            if (this.currentEditId) {
                await this.db.updateSale(
                    this.currentEditId,
                    data.itemId,
                    data.quantitySold,
                    totalAmount,
                    data.customerName,
                    data.customerPhone,
                    data.paid
                );
                this.showToast('Sale updated successfully', 'success');
            } else {
                await this.db.addSale(
                    data.itemId,
                    data.quantitySold,
                    totalAmount,
                    data.customerName,
                    data.customerPhone,
                    data.paid
                );
                this.showToast('Sale recorded successfully', 'success');
            }
            
            this.hideSaleModal();
            await this.loadSales();
            await this.loadStock(); // Refresh stock quantities
            await this.updateHeaderStats();
        } catch (error) {
            console.error('Failed to save sale:', error);
            this.showToast(error.message, 'error');
        }
    }

    async editSale(id) {
        this.showSaleModal(id);
    }

    async deleteSale(id) {
        if (confirm('Are you sure you want to delete this sale?')) {
            try {
                await this.db.deleteSale(id);
                this.showToast('Sale deleted successfully', 'success');
                await this.loadSales();
                await this.loadStock(); // Refresh stock quantities
                await this.updateHeaderStats();
            } catch (error) {
                console.error('Failed to delete sale:', error);
                this.showToast(error.message, 'error');
            }
        }
    }

    // Debtor Actions Methods
    async showDebtorActions(saleId) {
        try {
            const sale = await this.db.getSaleById(saleId);
            if (!sale || !sale.customer_phone) {
                this.showToast('Customer phone number not available', 'warning');
                return;
            }

            const stock = await this.db.getStockById(sale.item_id);
            const itemName = stock ? stock.name : 'Unknown Item';

            // Create modal if it doesn't exist
            this.createDebtorActionsModal();
            
            // Populate modal with debtor information
            const modal = document.getElementById('debtorActionsModal');
            document.getElementById('debtorName').textContent = sale.customer_name || 'Unknown Customer';
            document.getElementById('debtorPhone').textContent = sale.customer_phone;
            document.getElementById('debtorAmount').textContent = `${sale.total_amount.toFixed(2)}`;
            document.getElementById('debtorItem').textContent = itemName;
            document.getElementById('debtorDate').textContent = sale.date;
            document.getElementById('debtorSaleId').value = saleId;
            
            modal.classList.add('modal-open');
            document.body.classList.add('modal-open');
        } catch (error) {
            console.error('Failed to load debtor information:', error);
            this.showToast('Failed to load debtor information', 'error');
        }
    }

    createDebtorActionsModal() {
        if (document.getElementById('debtorActionsModal')) return;

        const modal = document.createElement('div');
        modal.id = 'debtorActionsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Contact Debtor</h3>
                    <span class="close" onclick="app.hideDebtorActionsModal()">&times;</span>
                </div>
                <div class="modal-form">
                    <div class="debtor-info">
                        <div class="info-row">
                            <label>Customer:</label>
                            <span id="debtorName">-</span>
                        </div>
                        <div class="info-row">
                            <label>Phone:</label>
                            <span id="debtorPhone">-</span>
                        </div>
                        <div class="info-row">
                            <label>Amount:</label>
                            <span id="debtorAmount">$0.00</span>
                        </div>
                        <div class="info-row">
                            <label>Item:</label>
                            <span id="debtorItem">-</span>
                        </div>
                        <div class="info-row">
                            <label>Date:</label>
                            <span id="debtorDate">-</span>
                        </div>
                    </div>
                    
                    <input type="hidden" id="debtorSaleId">
                    
                    <div class="debtor-actions">
                        <h4>Contact Options</h4>
                        <div class="action-buttons">
                            <button type="button" class="btn btn-primary" onclick="app.sendSMS()">
                                <i class="fas fa-sms"></i> Send SMS
                            </button>
                            <button type="button" class="btn btn-success" onclick="app.sendWhatsApp()">
                                <i class="fab fa-whatsapp"></i> WhatsApp
                            </button>
                            <button type="button" class="btn btn-info" onclick="app.makeCall()">
                                <i class="fas fa-phone"></i> Call Now
                            </button>
                        </div>
                    </div>
                    
                    <div class="debtor-reminders">
                        <h4>Send Reminder</h4>
                        <div class="form-group">
                            <label for="reminderMessage">Custom Message:</label>
                            <textarea id="reminderMessage" class="form-input" rows="3" placeholder="Enter custom reminder message..."></textarea>
                        </div>
                        <div class="quick-messages">
                            <button type="button" class="btn btn-secondary quick-msg" data-msg="payment_reminder">Payment Reminder</button>
                            <button type="button" class="btn btn-secondary quick-msg" data-msg="final_notice">Final Notice</button>
                            <button type="button" class="btn btn-secondary quick-msg" data-msg="friendly_reminder">Friendly Reminder</button>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.hideDebtorActionsModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="app.markAsPaid()">Mark as Paid</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners for quick messages
        modal.querySelectorAll('.quick-msg').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const msgType = e.target.dataset.msg;
                app.setQuickMessage(msgType);
            });
        });
    }

    hideDebtorActionsModal() {
        const modal = document.getElementById('debtorActionsModal');
        if (modal) {
            modal.classList.remove('modal-open');
            document.body.classList.remove('modal-open');
            
            // Clear any scroll locks
            this.clearScrollLocks();
        }
    }

    async sendSMS() {
        const phone = document.getElementById('debtorPhone').textContent;
        const message = document.getElementById('reminderMessage').value;
        
        if (!message.trim()) {
            this.showToast('Please enter a message', 'warning');
            return;
        }

        try {
            // Create SMS intent
            const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
            window.open(smsUrl);
            
            // Log the action
            await this.logDebtorAction('SMS', phone, message);
            this.showToast('SMS app opened with reminder message', 'success');
        } catch (error) {
            console.error('SMS failed:', error);
            this.showToast('Failed to open SMS app', 'error');
        }
    }

    async sendWhatsApp() {
        const phone = document.getElementById('debtorPhone').textContent;
        const message = document.getElementById('reminderMessage').value || this.getDefaultReminderMessage();
        
        try {
            // Clean phone number (remove + and spaces)
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            
            // Create WhatsApp URL
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
            
            // Log the action
            await this.logDebtorAction('WhatsApp', phone, message);
            this.showToast('WhatsApp opened with reminder message', 'success');
        } catch (error) {
            console.error('WhatsApp failed:', error);
            this.showToast('Failed to open WhatsApp', 'error');
        }
    }

    async makeCall() {
        const phone = document.getElementById('debtorPhone').textContent;
        
        try {
            // Create tel intent
            const telUrl = `tel:${phone}`;
            window.open(telUrl);
            
            // Log the action
            await this.logDebtorAction('Call', phone, 'Phone call initiated');
            this.showToast('Phone app opened', 'success');
        } catch (error) {
            console.error('Phone call failed:', error);
            this.showToast('Failed to open phone app', 'error');
        }
    }

    setQuickMessage(type) {
        const messageField = document.getElementById('reminderMessage');
        const messages = {
            payment_reminder: 'Dear [Customer], this is a friendly reminder that your payment of $[Amount] for [Item] purchased on [Date] is overdue. Please contact us to arrange payment at your earliest convenience. Thank you.',
            final_notice: 'Dear [Customer], this is a final notice regarding your overdue payment of $[Amount] for [Item]. Please settle this account within 48 hours to avoid further action. Thank you for your immediate attention.',
            friendly_reminder: 'Hello [Customer], we hope you are well. This is just a friendly reminder about your outstanding balance of $[Amount] for [Item]. Please let us know when we can expect payment. Thank you.'
        };
        
        const message = messages[type] || '';
        
        // Replace placeholders with actual values
        const customerName = document.getElementById('debtorName').textContent;
        const amount = document.getElementById('debtorAmount').textContent;
        const item = document.getElementById('debtorItem').textContent;
        const date = document.getElementById('debtorDate').textContent;
        
        const personalizedMessage = message
            .replace('[Customer]', customerName)
            .replace('[Amount]', amount)
            .replace('[Item]', item)
            .replace('[Date]', date);
        
        messageField.value = personalizedMessage;
    }

    getDefaultReminderMessage() {
        const customerName = document.getElementById('debtorName').textContent;
        const amount = document.getElementById('debtorAmount').textContent;
        return `Dear ${customerName}, this is a reminder about your outstanding payment of ${amount}. Please contact us to arrange payment. Thank you.`;
    }

    async markAsPaid() {
        const saleId = parseInt(document.getElementById('debtorSaleId').value);
        
        if (confirm('Mark this sale as paid?')) {
            try {
                const sale = await this.db.getSaleById(saleId);
                if (sale) {
                    sale.paid = 1;
                    await this.db.updateRecord('sales', sale);
                    
                    this.hideDebtorActionsModal();
                    await this.loadSales();
                    await this.updateHeaderStats();
                    this.showToast('Sale marked as paid', 'success');
                }
            } catch (error) {
                console.error('Failed to mark as paid:', error);
                this.showToast('Failed to update payment status', 'error');
            }
        }
    }

    async logDebtorAction(actionType, phone, message) {
        try {
            // Store action log for tracking
            const actionLog = {
                sale_id: parseInt(document.getElementById('debtorSaleId').value),
                action_type: actionType,
                phone: phone,
                message: message,
                timestamp: new Date().toISOString(),
                customer_name: document.getElementById('debtorName').textContent
            };
            
            // Store in local storage for offline tracking
            const logs = JSON.parse(localStorage.getItem('debtorActionLogs') || '[]');
            logs.push(actionLog);
            localStorage.setItem('debtorActionLogs', JSON.stringify(logs));
            
            console.log('Debtor action logged:', actionLog);
        } catch (error) {
            console.error('Failed to log debtor action:', error);
        }
    }

    // Customer Management Methods
    async loadCustomers() {
        try {
            const customers = await this.db.getAllCustomers();
            const tbody = document.getElementById('customersTableBody');
            
            // Always use regular rendering
            tbody.innerHTML = '';
            
            customers.forEach(customer => {
                const row = document.createElement('tr');
                const firstContactDate = customer.firstContactDate || customer.lastPurchase;
                row.innerHTML = `
                    <td>${customer.name}</td>
                    <td>${customer.phone || '-'}</td>
                    <td>${customer.totalPurchases}</td>
                    <td>${customer.totalSpent.toFixed(2)}</td>
                    <td>${customer.lastPurchase}</td>
                    <td>${firstContactDate}</td>
                    <td class="actions">
                        <button class="action-btn edit-btn" onclick="app.viewCustomerRecords('${customer.name}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load customers:', error);
            this.showToast('Failed to load customer data', 'error');
        }
    }

    async viewCustomerRecords(customerName) {
        try {
            const records = await this.db.getCustomerRecords(customerName);
            
            if (records.length === 0) {
                this.showToast('No records found for this customer', 'info');
                return;
            }

            // Create a simple modal or use existing modal for records display
            this.showCustomerRecordsModal(customerName, records);
        } catch (error) {
            console.error('Failed to load customer records:', error);
            this.showToast('Failed to load customer records', 'error');
        }
    }

    showCustomerRecordsModal(customerName, records) {
        // This would typically create a custom modal for displaying records
        // For now, we'll export to PDF
        this.exportSpecificCustomerPDF(customerName, records);
    }

    // Analytics Methods
    async loadAnalytics() {
        try {
            const stats = await this.db.getSalesStatistics(30);
            const lowStock = await this.db.getLowStockItems(10);

            this.renderCharts(stats);
            this.renderLowStockList(lowStock);
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.showToast('Failed to load analytics data', 'error');
        }
    }

    renderCharts(stats) {
        // Daily Sales Chart
        const dailyCtx = document.getElementById('dailySalesChart');
        if (dailyCtx && stats.daily.length > 0) {
            if (this.charts.daily) this.charts.daily.destroy();
            this.charts.daily = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: stats.daily.map(d => d.date),
                    datasets: [{
                        label: 'Daily Sales ($)',
                        data: stats.daily.map(d => d.total),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Top Items Chart
        const topItemsCtx = document.getElementById('topItemsChart');
        if (topItemsCtx && stats.topItems.length > 0) {
            if (this.charts.topItems) this.charts.topItems.destroy();
            this.charts.topItems = new Chart(topItemsCtx, {
                type: 'bar',
                data: {
                    labels: stats.topItems.map(item => item.name),
                    datasets: [{
                        label: 'Quantity Sold',
                        data: stats.topItems.map(item => item.quantity),
                        backgroundColor: '#28a745'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Monthly Revenue Chart
        const monthlyCtx = document.getElementById('monthlyRevenueChart');
        if (monthlyCtx && stats.monthly.length > 0) {
            if (this.charts.monthly) this.charts.monthly.destroy();
            this.charts.monthly = new Chart(monthlyCtx, {
                type: 'line',
                data: {
                    labels: stats.monthly.map(m => m.month),
                    datasets: [{
                        label: 'Monthly Revenue ($)',
                        data: stats.monthly.map(m => m.total),
                        borderColor: '#764ba2',
                        backgroundColor: 'rgba(118, 75, 162, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    renderLowStockList(lowStock) {
        const container = document.getElementById('lowStockList');
        container.innerHTML = '';

        if (lowStock.length === 0) {
            container.innerHTML = '<div class="low-stock-item">All items have sufficient stock!</div>';
            return;
        }

        lowStock.forEach(item => {
            const div = document.createElement('div');
            div.className = 'low-stock-item';
            div.innerHTML = `
                <span>${item.name}</span>
                <span class="low-stock-warning">${item.quantity} left</span>
            `;
            container.appendChild(div);
        });
    }

    // Header Statistics
    async updateHeaderStats() {
        try {
            const totalStockValue = await this.db.getTotalStockValue();
            const sales = await this.db.getAllSales();
            
            // Calculate gross revenue (total of all sales)
            const grossRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
            
            // Calculate total debt (sales where paid = 0)
            const totalDebt = sales.filter(sale => !sale.paid).reduce((sum, sale) => sum + sale.total_amount, 0);
            
            // Calculate net revenue (gross revenue - total debt)
            const netRevenue = grossRevenue - totalDebt;

            // Update values
            document.getElementById('totalStockValue').textContent = `${totalStockValue.toFixed(2)}`;
            document.getElementById('grossRevenue').textContent = `${grossRevenue.toFixed(2)}`;
            
            // Store previous net revenue for comparison
            const previousNetRevenue = parseFloat(document.getElementById('netRevenue').textContent) || 0;
            const netRevenueElement = document.getElementById('netRevenue');
            
            // Update net revenue with enhanced formatting
            netRevenueElement.textContent = `${netRevenue.toFixed(2)}`;
            
            // Update total debt
            document.getElementById('totalDebt').textContent = `${totalDebt.toFixed(2)}`;
            
            // Enhanced net revenue visualization
            this.updateNetRevenueDisplay(netRevenue, previousNetRevenue);
            
        } catch (error) {
            console.error('Failed to update header stats:', error);
        }
    }
    
    // Enhanced Net Revenue Display with Real-time Updates
    updateNetRevenueDisplay(currentRevenue, previousRevenue) {
        const netRevenueContainer = document.querySelector('.net-revenue-highlight');
        const netRevenueElement = document.getElementById('netRevenue');
        const revenueIndicator = document.querySelector('.revenue-indicator i');
        
        // Remove previous status classes
        netRevenueContainer.classList.remove('net-revenue-positive', 'net-revenue-negative', 'net-revenue-zero');
        
        // Add visual feedback for revenue changes
        if (currentRevenue !== previousRevenue) {
            // Add update animation
            netRevenueContainer.classList.add('revenue-updated');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                netRevenueContainer.classList.remove('revenue-updated');
            }, 600);
            
            // Update the indicator icon based on change direction
            if (currentRevenue > previousRevenue) {
                revenueIndicator.className = 'fas fa-arrow-up';
                revenueIndicator.style.color = '#28a745';
            } else if (currentRevenue < previousRevenue) {
                revenueIndicator.className = 'fas fa-arrow-down';
                revenueIndicator.style.color = '#dc3545';
            } else {
                revenueIndicator.className = 'fas fa-chart-line';
                revenueIndicator.style.color = '#28a745';
            }
        }
        
        // Apply color coding based on revenue status
        if (currentRevenue > 0) {
            netRevenueContainer.classList.add('net-revenue-positive');
            this.updateRevenueStatus('Profit', '#28a745');
        } else if (currentRevenue < 0) {
            netRevenueContainer.classList.add('net-revenue-negative');
            this.updateRevenueStatus('Loss', '#dc3545');
        } else {
            netRevenueContainer.classList.add('net-revenue-zero');
            this.updateRevenueStatus('Break Even', '#ffc107');
        }
    }
    
    // Update revenue status indicator
    updateRevenueStatus(status, color) {
        const revenueStatus = document.querySelector('.revenue-status');
        if (revenueStatus) {
            revenueStatus.textContent = status;
            revenueStatus.style.color = color;
        }
    }
    
    // Setup real-time updates for net revenue
    setupRealTimeUpdates() {
        // Update every 5 seconds to ensure real-time sync
        setInterval(async () => {
            try {
                await this.updateHeaderStats();
            } catch (error) {
                console.error('Real-time update failed:', error);
            }
        }, 5000);
        
        // Listen for storage events (changes from other tabs)
        window.addEventListener('storage', async (e) => {
            if (e.key === 'adah_backup') {
                // Data changed in another tab, update immediately
                await this.updateHeaderStats();
            }
        });
        
        // Listen for focus events to update when user returns to tab
        window.addEventListener('focus', async () => {
            await this.updateHeaderStats();
        });
        
        console.log('Real-time net revenue updates enabled');
    }

    // Enhanced Search Functionality
    async performSearch(query) {
        if (!query.trim()) {
            this.clearSearch();
            return;
        }

        try {
            const [stockResults, salesResults, customerResults] = await Promise.all([
                this.db.searchStock(query),
                this.db.searchSales(query),
                this.searchCustomers(query)
            ]);

            await this.displaySearchResults(query, stockResults, salesResults, customerResults);
        } catch (error) {
            console.error('Search failed:', error);
            this.showToast('Search failed', 'error');
        }
    }

    async displaySearchResults(query, stockResults, salesResults, customerResults) {
        await this.createSearchOverlay(query, stockResults, salesResults, customerResults);
    }

    async createSearchOverlay(query, stockResults, salesResults, customerResults) {
        // Remove existing overlay
        const existingOverlay = document.getElementById('searchOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'searchOverlay';
        overlay.className = 'search-overlay';
        
        const totalResults = stockResults.length + salesResults.length + customerResults.length;
        
        let resultsHtml = `
            <div class="search-overlay-header">
                <h3>Search Results for "${query}"</h3>
                <span class="search-close" onclick="app.clearSearch()">&times;</span>
            </div>
            <div class="search-results-container">
        `;

        // Stock Results
        if (stockResults.length > 0) {
            resultsHtml += `
                <div class="search-section">
                    <h4><i class="fas fa-boxes"></i> Stock Items (${stockResults.length})</h4>
                    <div class="search-items">
            `;
            
            stockResults.forEach(item => {
                resultsHtml += `
                    <div class="search-item" onclick="app.selectSearchResult('stock', ${item.id})">
                        <div class="item-info">
                            <strong>${item.name}</strong>
                            <span class="item-details">Qty: ${item.quantity} | Price: ${item.price.toFixed(2)}</span>
                            ${item.description ? `<span class="item-description">${item.description}</span>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="action-btn edit-btn" onclick="event.stopPropagation(); app.editStock(${item.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="action-btn delete-btn" onclick="event.stopPropagation(); app.deleteStock(${item.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            
            resultsHtml += '</div></div>';
        }

        // Sales Results
        if (salesResults.length > 0) {
            resultsHtml += `
                <div class="search-section">
                    <h4><i class="fas fa-shopping-cart"></i> Sales Records (${salesResults.length})</h4>
                    <div class="search-items">
            `;
            
            // Get stock names for display
            const stock = await this.db.getAllStock();
            const stockMap = {};
            stock.forEach(item => {
                stockMap[item.id] = item.name;
            });
            
            salesResults.forEach(sale => {
                const statusClass = sale.paid ? 'status-paid' : 'status-debt';
                const statusText = sale.paid ? 'Paid' : 'Debt';
                
                resultsHtml += `
                    <div class="search-item" onclick="app.selectSearchResult('sale', ${sale.id})">
                        <div class="item-info">
                            <strong>${sale.customer_name || 'Unknown Customer'}</strong>
                            <span class="item-details">${stockMap[sale.item_id] || 'Unknown'} | ${sale.total_amount.toFixed(2)} | ${sale.date}</span>
                            <span class="item-status ${statusClass}">${statusText}</span>
                            ${sale.customer_phone ? `<span class="item-phone">${sale.customer_phone}</span>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="action-btn edit-btn" onclick="event.stopPropagation(); app.editSale(${sale.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            ${!sale.paid && sale.customer_phone ? `
                                <button class="action-btn debtor-action-btn" onclick="event.stopPropagation(); app.showDebtorActions(${sale.id})" title="Contact Debtor">
                                    <i class="fas fa-phone"></i> Contact
                                </button>
                            ` : ''}
                            <button class="action-btn delete-btn" onclick="event.stopPropagation(); app.deleteSale(${sale.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            
            resultsHtml += '</div></div>';
        }

        // Customer Results
        if (customerResults.length > 0) {
            resultsHtml += `
                <div class="search-section">
                    <h4><i class="fas fa-users"></i> Customers (${customerResults.length})</h4>
                    <div class="search-items">
            `;
            
            customerResults.forEach(customer => {
                resultsHtml += `
                    <div class="search-item" onclick="app.selectSearchResult('customer', '${customer.name}')">
                        <div class="item-info">
                            <strong>${customer.name}</strong>
                            <span class="item-details">Purchases: ${customer.totalPurchases} | Total: ${customer.totalSpent.toFixed(2)}</span>
                            ${customer.phone ? `<span class="item-phone">${customer.phone}</span>` : ''}
                            <span class="item-last">Last: ${customer.lastPurchase}</span>
                        </div>
                        <div class="item-actions">
                            <button class="action-btn edit-btn" onclick="event.stopPropagation(); app.viewCustomerRecords('${customer.name}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </div>
                    </div>
                `;
            });
            
            resultsHtml += '</div></div>';
        }

        if (totalResults === 0) {
            resultsHtml += `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>No results found for "${query}"</p>
                    <small>Try different keywords or check spelling</small>
                </div>
            `;
        }

        resultsHtml += '</div></div>';
        
        overlay.innerHTML = resultsHtml;
        document.body.appendChild(overlay);
        
        // Close overlay when clicking outside
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.clearSearch();
            }
        });
    }

    async searchCustomers(query) {
        const customers = await this.db.getAllCustomers();
        const term = query.toLowerCase();
        return customers.filter(customer => 
            customer.name.toLowerCase().includes(term) ||
            (customer.phone && customer.phone.includes(term))
        );
    }

    selectSearchResult(type, id) {
        this.clearSearch();
        
        // Switch to appropriate tab and highlight the item
        switch (type) {
            case 'stock':
                this.switchTab('stock');
                setTimeout(() => this.highlightTableRow('stockTableBody', id), 100);
                break;
            case 'sale':
                this.switchTab('sales');
                setTimeout(() => this.highlightTableRow('salesTableBody', id), 100);
                break;
            case 'customer':
                this.switchTab('customers');
                // For customers, we don't have row IDs, so we'll just switch tab
                break;
        }
    }

    highlightTableRow(tableBodyId, id) {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const firstCell = row.cells[0];
            if (firstCell && parseInt(firstCell.textContent) === id) {
                row.classList.add('highlighted-row');
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    row.classList.remove('highlighted-row');
                }, 3000);
            }
        });
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        
        // Remove search overlay
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Reload current tab data
        this.loadAllData();
    }

    // Show record details for search results
    showRecordDetails(record) {
        // Switch to the appropriate tab based on record type
        if (record.item_id) {
            // This is a sales record
            this.switchTab('sales');
            setTimeout(() => this.highlightTableRow('salesTableBody', record.id), 100);
        } else if (record.quantity !== undefined) {
            // This is a stock record
            this.switchTab('stock');
            setTimeout(() => this.highlightTableRow('stockTableBody', record.id), 100);
        } else if (record.totalPurchases !== undefined) {
            // This is a customer record
            this.switchTab('customers');
        }
    }
    
    // Clean up virtual scrolling resources
    cleanupVirtualScrolling() {
        // Clean up scroll buttons
        if (this.scrollButtons) {
            this.scrollButtons.forEach(({ button }) => {
                if (button && button.parentNode) {
                    button.parentNode.removeChild(button);
                }
            });
            this.scrollButtons = [];
        }
        
        // Clean up scroll indicators
        if (this.scrollIndicators) {
            this.scrollIndicators.forEach(({ indicator }) => {
                if (indicator && indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            });
            this.scrollIndicators = [];
        }
    }

    // Report Generation Methods
    async generateDailyReport() {
        const date = document.getElementById('dailyReportDate').value;
        if (!date) {
            this.showToast('Please select a date', 'warning');
            return;
        }

        try {
            const sales = await this.db.getSalesByDateRange(date, date);
            await this.createPDFReport('Daily Sales Report', date, sales);
        } catch (error) {
            console.error('Failed to generate daily report:', error);
            this.showToast('Failed to generate daily report', 'error');
        }
    }

    async generateWeeklyReport() {
        const startDate = document.getElementById('weeklyStartDate').value;
        const endDate = document.getElementById('weeklyEndDate').value;

        if (!startDate || !endDate) {
            this.showToast('Please select start and end dates', 'warning');
            return;
        }

        try {
            const sales = await this.db.getSalesByDateRange(startDate, endDate);
            await this.createPDFReport('Weekly Sales Report', `${startDate} to ${endDate}`, sales);
        } catch (error) {
            console.error('Failed to generate weekly report:', error);
            this.showToast('Failed to generate weekly report', 'error');
        }
    }

    async generateMonthlyReport() {
        const year = document.getElementById('monthlyYear').value;
        const month = document.getElementById('monthlyMonth').value;

        if (!year || !month) {
            this.showToast('Please select year and month', 'warning');
            return;
        }

        try {
            const startDate = `${year}-${month.padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            const sales = await this.db.getSalesByDateRange(startDate, endDate);
            await this.createPDFReport('Monthly Sales Report', `${year}-${month}`, sales);
        } catch (error) {
            console.error('Failed to generate monthly report:', error);
            this.showToast('Failed to generate monthly report', 'error');
        }
    }

    async createPDFReport(title, period, sales) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Add title
            doc.setFontSize(16);
            doc.text(title, 20, 20);
            doc.setFontSize(12);
            doc.text(`Period: ${period}`, 20, 30);

            // Add sales data
            let y = 50;
            doc.setFontSize(10);
            doc.text('Date', 20, y);
            doc.text('Item', 60, y);
            doc.text('Qty', 120, y);
            doc.text('Total', 150, y);
            doc.text('Customer', 180, y);

            y += 10;
            let total = 0;

            const stock = await this.db.getAllStock();
            const stockMap = {};
            stock.forEach(item => {
                stockMap[item.id] = item.name;
            });

            sales.forEach(sale => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }

                doc.text(sale.date, 20, y);
                doc.text(stockMap[sale.item_id] || 'Unknown', 60, y);
                doc.text(sale.quantity_sold.toString(), 120, y);
                doc.text(`$${sale.total_amount.toFixed(2)}`, 150, y);
                doc.text(sale.customer_name || '-', 180, y);

                total += sale.total_amount;
                y += 10;
            });

            // Add total
            y += 10;
            doc.setFontSize(12);
            doc.text(`Total: $${total.toFixed(2)}`, 150, y);

            // Save the PDF
            const filename = `${title.replace(/\s+/g, '_').toLowerCase()}_${period.replace(/[^\d-]/g, '')}.pdf`;
            doc.save(filename);

            this.showToast('PDF report generated successfully', 'success');
        } catch (error) {
            console.error('Failed to create PDF:', error);
            this.showToast('Failed to create PDF report', 'error');
        }
    }

    async exportCustomerPDF() {
        try {
            const customers = await this.db.getAllCustomers();
            
            if (customers.length === 0) {
                this.showToast('No customer data to export', 'info');
                return;
            }

            // For simplicity, export all customers in one PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text('Customer Records Report', 20, 20);
            doc.setFontSize(12);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

            let y = 50;
            doc.setFontSize(10);
            doc.text('Name', 20, y);
            doc.text('Phone', 80, y);
            doc.text('Purchases', 130, y);
            doc.text('Total Spent', 170, y);

            y += 10;

            customers.forEach(customer => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }

                doc.text(customer.name, 20, y);
                doc.text(customer.phone || '-', 80, y);
                doc.text(customer.totalPurchases.toString(), 130, y);
                doc.text(`$${customer.totalSpent.toFixed(2)}`, 170, y);

                y += 10;
            });

            doc.save('customer_records_report.pdf');
            this.showToast('Customer PDF exported successfully', 'success');
        } catch (error) {
            console.error('Failed to export customer PDF:', error);
            this.showToast('Failed to export customer PDF', 'error');
        }
    }

    async exportSpecificCustomerPDF(customerName, records) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text(`Customer Records - ${customerName}`, 20, 20);
            doc.setFontSize(12);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

            let y = 50;
            doc.setFontSize(10);
            doc.text('Date', 20, y);
            doc.text('Item', 60, y);
            doc.text('Qty', 120, y);
            doc.text('Total', 150, y);
            doc.text('Status', 180, y);

            y += 10;
            let total = 0;
            let paid = 0;
            let debt = 0;

            records.forEach(record => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }

                doc.text(record.date, 20, y);
                doc.text(record.item_name, 60, y);
                doc.text(record.quantity_sold.toString(), 120, y);
                doc.text(`$${record.total_amount.toFixed(2)}`, 150, y);
                doc.text(record.paid ? 'Paid' : 'Debt', 180, y);

                total += record.total_amount;
                if (record.paid) {
                    paid += record.total_amount;
                } else {
                    debt += record.total_amount;
                }

                y += 10;
            });

            // Add summary
            y += 10;
            doc.setFontSize(12);
            doc.text('Summary:', 20, y);
            y += 10;
            doc.setFontSize(10);
            doc.text(`Total Amount: $${total.toFixed(2)}`, 20, y);
            y += 10;
            doc.text(`Paid Amount: $${paid.toFixed(2)}`, 20, y);
            y += 10;
            doc.text(`Outstanding Debt: $${debt.toFixed(2)}`, 20, y);

            const filename = `customer_records_${customerName.replace(/\s+/g, '_')}.pdf`;
            doc.save(filename);

            this.showToast('Customer records PDF generated successfully', 'success');
        } catch (error) {
            console.error('Failed to create customer PDF:', error);
            this.showToast('Failed to create customer PDF', 'error');
        }
    }

    // Utility Methods
    initializeYearDropdown() {
        const yearSelect = document.getElementById('monthlyYear');
        const currentYear = new Date().getFullYear();
        
        for (let year = currentYear; year >= currentYear - 5; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('modal-open');
        });
        document.body.classList.remove('modal-open');
        
        // Clear any scroll locks
        this.clearScrollLocks();
    }
    
    clearScrollLocks() {
        // Remove any scroll locks and restore normal scrolling
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        
        // Remove modal-open class if present
        document.body.classList.remove('modal-open');
        
        // Clear any scroll position memory
        if (window.scrollTo) {
            // Force a small scroll to reset any stuck scroll position
            window.scrollTo(0, window.scrollY || 0);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Virtual Scrolling Implementation
    setupVirtualScrolling(type, data, stockMap = null) {
        const container = document.getElementById(`${type}TableBody`).parentElement;
        const tbody = document.getElementById(`${type}TableBody`);
        
        // Store original data and stock map for sales
        this.virtualScrollState[type].allData = data;
        if (stockMap && type === 'sales') {
            this.virtualScrollState[type].stockMap = stockMap;
        }
        
        // Clear existing content and preserve container structure
        container.innerHTML = '';
        
        // Create proper virtual scrolling structure with table styling
        const virtualWrapper = document.createElement('div');
        virtualWrapper.className = 'table-container virtual-scroll-wrapper';
        virtualWrapper.style.height = '70vh';
        virtualWrapper.style.maxHeight = '70vh';
        
        virtualWrapper.innerHTML = `
            <div class="virtual-table-viewport" id="${type}VirtualContainer" style="height: 100%; overflow: auto; position: relative;">
                <div class="virtual-table-spacer" style="height: ${data.length * this.virtualScrollState[type].itemHeight}px; position: relative;"></div>
                <div class="virtual-table-content" style="position: absolute; top: 0; left: 0; right: 0; z-index: 1;"></div>
            </div>
        `;
        
        container.appendChild(virtualWrapper);
        
        const virtualContainer = virtualWrapper.querySelector('.virtual-table-viewport');
        const spacer = virtualWrapper.querySelector('.virtual-table-spacer');
        const content = virtualWrapper.querySelector('.virtual-table-content');
        
        // Update container height
        this.virtualScrollState[type].containerHeight = virtualContainer.clientHeight;
        this.virtualScrollState[type].visibleItems = Math.ceil(this.virtualScrollState[type].containerHeight / this.virtualScrollState[type].itemHeight);
        
        // Use requestAnimationFrame for better scroll performance
        let scrollFrameId = null;
        let isScrolling = false;
        
        const handleScroll = () => {
            if (isScrolling) return;
            isScrolling = true;
            
            if (scrollFrameId) {
                cancelAnimationFrame(scrollFrameId);
            }
            
            scrollFrameId = requestAnimationFrame(() => {
                this.handleVirtualScroll(type, virtualContainer, content, spacer);
                isScrolling = false;
            });
        };
        
        // Add scroll event with proper passive handling
        virtualContainer.addEventListener('scroll', handleScroll, { passive: true });
        
        // Initial render
        this.handleVirtualScroll(type, virtualContainer, content, spacer);
        
        // Add scroll-to-top button
        this.addScrollToTopButton(virtualContainer, virtualWrapper);
        
        // Add scroll indicator
        this.addScrollIndicator(virtualContainer, type);
        
        // Add scroll state management
        virtualWrapper.addEventListener('scroll', () => {
            virtualWrapper.classList.add('scrolling');
            clearTimeout(virtualWrapper.scrollTimeout);
            virtualWrapper.scrollTimeout = setTimeout(() => {
                virtualWrapper.classList.remove('scrolling');
            }, 150);
        });
    }
    
    handleVirtualScroll(type, container, content, spacer) {
        const state = this.virtualScrollState[type];
        const scrollTop = container.scrollTop;
        
        // Calculate visible range
        const startIndex = Math.max(0, Math.floor(scrollTop / state.itemHeight) - 5);
        const endIndex = Math.min(state.allData.length, startIndex + state.visibleItems + 10);
        
        // Update state
        state.startIndex = startIndex;
        state.endIndex = endIndex;
        
        // Update spacer
        spacer.style.height = `${state.allData.length * state.itemHeight}px`;
        
        // Render visible items
        const visibleData = state.allData.slice(startIndex, endIndex);
        content.innerHTML = visibleData.map((item, index) => {
            const actualIndex = startIndex + index;
            return this.renderVirtualItem(type, item, actualIndex);
        }).join('');
        
        // Update content position
        content.style.top = `${startIndex * state.itemHeight}px`;
    }
    
    renderVirtualItem(type, item, index) {
        switch (type) {
            case 'stock':
                const stockCreatedDate = item.created_date ? new Date(item.created_date).toLocaleDateString() : '-';
                return `
                    <div class="virtual-item" style="height: ${this.virtualScrollState.stock.itemHeight}px; display: table-row; border-bottom: 1px solid #e9ecef;">
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 60px;">${item.id}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 150px;">${item.name}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 80px;">${item.quantity}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 100px;">${item.price.toFixed(2)}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 200px;">${item.description || '-'}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 100px;">${stockCreatedDate}</td>
                        <td class="actions" style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 100px;">
                            <button class="action-btn edit-btn" onclick="app.editStock(${item.id})" style="margin-right: 0.25rem;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="app.deleteStock(${item.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </div>
                `;
            
            case 'sales':
                const statusClass = item.paid ? 'status-paid' : 'status-debt';
                const statusText = item.paid ? 'Paid' : 'Debt';
                const stockMap = this.virtualScrollState.sales.stockMap || {};
                
                let actionsHtml = `
                    <button class="action-btn edit-btn" onclick="app.editSale(${item.id})" title="Edit Sale" style="margin-right: 0.25rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteSale(${item.id})" title="Delete Sale" style="margin-right: 0.25rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                
                if (!item.paid && item.customer_phone) {
                    actionsHtml += `
                        <button class="action-btn debtor-action-btn" onclick="app.showDebtorActions(${item.id})" title="Contact Debtor">
                            <i class="fas fa-phone"></i>
                        </button>
                    `;
                }
                
                return `
                    <div class="virtual-item" style="height: ${this.virtualScrollState.sales.itemHeight}px; display: table-row; border-bottom: 1px solid #e9ecef;">
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 60px;">${item.id}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 120px;">${item.date}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 150px;">${stockMap[item.item_id] || 'Unknown'}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 80px;">${item.quantity_sold}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 100px;">${item.total_amount.toFixed(2)}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 150px;">${item.customer_name || '-'}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 120px;">${item.customer_phone || '-'}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 80px;"><span class="${statusClass}">${statusText}</span></td>
                        <td class="actions" style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 120px;">${actionsHtml}</td>
                    </div>
                `;
            
            case 'customers':
                return `
                    <div class="virtual-item" style="height: ${this.virtualScrollState.customers.itemHeight}px; display: table-row; border-bottom: 1px solid #e9ecef;">
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 150px;">${item.name}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 120px;">${item.phone || '-'}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 100px;">${item.totalPurchases}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 120px;">${item.totalSpent.toFixed(2)}</td>
                        <td style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 120px;">${item.lastPurchase}</td>
                        <td class="actions" style="padding: 1rem; text-align: left; border-bottom: 1px solid #e1e5e9; min-width: 80px;">
                            <button class="action-btn edit-btn" onclick="app.viewCustomerRecords('${item.name}')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </div>
                `;
            
            default:
                return '';
        }
    }
    
    addScrollToTopButton(container, wrapper) {
        const scrollBtn = document.createElement('button');
        scrollBtn.className = 'scroll-to-top';
        scrollBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        scrollBtn.title = 'Scroll to top';
        scrollBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            cursor: pointer;
            display: none;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            font-size: 16px;
        `;
        
        // Add hover effects
        scrollBtn.addEventListener('mouseenter', () => {
            scrollBtn.style.transform = 'translateY(-2px) scale(1.1)';
            scrollBtn.style.boxShadow = '0 6px 25px rgba(0,0,0,0.2)';
        });
        
        scrollBtn.addEventListener('mouseleave', () => {
            scrollBtn.style.transform = 'translateY(0) scale(1)';
            scrollBtn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
        });
        
        scrollBtn.addEventListener('click', () => {
            container.scrollTo({ 
                top: 0, 
                behavior: 'smooth' 
            });
        });
        
        document.body.appendChild(scrollBtn);
        
        // Show/hide button based on scroll position
        const toggleButton = () => {
            const shouldShow = container.scrollTop > 200;
            scrollBtn.style.display = shouldShow ? 'block' : 'none';
            scrollBtn.classList.toggle('visible', shouldShow);
        };
        
        container.addEventListener('scroll', toggleButton, { passive: true });
        toggleButton(); // Initial check
        
        // Store reference for cleanup
        if (!this.scrollButtons) this.scrollButtons = [];
        this.scrollButtons.push({ button: scrollBtn, container });
    }
    
    addScrollIndicator(container, type) {
        const indicator = document.createElement('div');
        indicator.className = 'scroll-indicator';
        indicator.id = `${type}-scroll-indicator`;
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transform-origin: 0 0;
            transform: scaleX(0);
            transition: transform 0.3s ease;
            z-index: 10;
            pointer-events: none;
        `;
        
        document.body.appendChild(indicator);
        
        // Update indicator on scroll
        const updateIndicator = () => {
            const scrollPercent = container.scrollTop / (container.scrollHeight - container.clientHeight);
            const clampedPercent = Math.max(0, Math.min(1, scrollPercent));
            indicator.style.transform = `scaleX(${clampedPercent})`;
        };
        
        container.addEventListener('scroll', updateIndicator, { passive: true });
        updateIndicator(); // Initial update
        
        // Store reference for cleanup
        if (!this.scrollIndicators) this.scrollIndicators = [];
        this.scrollIndicators.push({ indicator, container });
    }
    
    // Enhanced Touch and Gesture Support
    setupTouchGestures() {
        const mainContainer = document.querySelector('.main-content');
        
        if (!mainContainer) return;
        
        // Prevent scroll interference with touch gestures
        let isGestureActive = false;
        let gestureStartTime = 0;
        let lastTouchMove = 0;
        
        // Touch start
        mainContainer.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.touchGestures.initialTouch = { x: touch.clientX, y: touch.clientY };
            this.touchGestures.currentTouch = { x: touch.clientX, y: touch.clientY };
            
            // Reset gesture state
            isGestureActive = false;
            gestureStartTime = Date.now();
        }, { passive: true });
        
        // Touch move with enhanced performance
        mainContainer.addEventListener('touchmove', (e) => {
            if (!this.touchGestures.initialTouch || isGestureActive) return;
            
            const touch = e.touches[0];
            this.touchGestures.currentTouch = { x: touch.clientX, y: touch.clientY };
            
            const deltaX = this.touchGestures.currentTouch.x - this.touchGestures.initialTouch.x;
            const deltaY = this.touchGestures.currentTouch.y - this.touchGestures.initialTouch.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Throttle gesture detection to prevent interference with scrolling
            const now = Date.now();
            if (now - lastTouchMove < 50) return; // Throttle to 20fps
            lastTouchMove = now;
            
            // Only activate gesture if movement is significant and quick
            const gestureDuration = now - gestureStartTime;
            if (distance > 30 && gestureDuration < 500) {
                // Detect horizontal swipe for navigation
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.touchGestures.swipeThreshold) {
                    e.preventDefault();
                    isGestureActive = true;
                    
                    if (deltaX > 0) {
                        // Swipe right - navigate to previous tab
                        this.navigateWithSwipe('prev');
                    } else {
                        // Swipe left - navigate to next tab
                        this.navigateWithSwipe('next');
                    }
                    
                    this.touchGestures.initialTouch = null;
                }
            }
        }, { passive: false });
        
        // Touch end
        mainContainer.addEventListener('touchend', () => {
            this.touchGestures.initialTouch = null;
            this.touchGestures.currentTouch = null;
            isGestureActive = false;
        }, { passive: true });
        
        // Touch cancel
        mainContainer.addEventListener('touchcancel', () => {
            this.touchGestures.initialTouch = null;
            this.touchGestures.currentTouch = null;
            isGestureActive = false;
        }, { passive: true });
        
        // Pinch to zoom for tables with better performance
        mainContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && !isGestureActive) {
                e.preventDefault();
                
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                const distance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) + 
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                if (this.touchGestures.pinchStartDistance === 0) {
                    this.touchGestures.pinchStartDistance = distance;
                }
                
                const scale = distance / this.touchGestures.pinchStartDistance;
                this.touchGestures.zoomLevel = Math.max(0.5, Math.min(2, scale));
                
                // Apply zoom to tables with transform origin
                const tables = mainContainer.querySelectorAll('.data-table, .virtual-item');
                tables.forEach(table => {
                    table.style.transform = `scale(${this.touchGestures.zoomLevel})`;
                    table.style.transformOrigin = 'top left';
                    table.style.willChange = 'transform';
                });
            }
        }, { passive: false });
        
        mainContainer.addEventListener('touchend', () => {
            this.touchGestures.pinchStartDistance = 0;
        }, { passive: true });
        
        // Add scroll performance improvements
        const scrollContainers = mainContainer.querySelectorAll('.table-container, .virtual-table-viewport');
        scrollContainers.forEach(container => {
            // Improve scroll performance on mobile
            container.style.webkitOverflowScrolling = 'touch';
            container.style.overscrollBehavior = 'contain';
            
            // Add momentum scrolling for iOS
            container.style.WebkitOverflowScrolling = 'touch';
        });
    }
    
    navigateWithSwipe(direction) {
        const tabs = ['stock', 'sales', 'customers', 'analytics'];
        const currentIndex = tabs.indexOf(this.currentTab);
        
        let newIndex;
        if (direction === 'next') {
            newIndex = (currentIndex + 1) % tabs.length;
        } else {
            newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        }
        
        this.switchTab(tabs[newIndex]);
        
        // Show navigation hint
        this.showToast(`Switched to ${tabs[newIndex]} tab`, 'info');
    }
    
    // Enhanced Accessibility
    enhanceAccessibility() {
        // Add ARIA labels and roles
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', btn.classList.contains('active'));
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.setAttribute('role', 'tabpanel');
        });
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.switchTab('stock');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchTab('sales');
                        break;
                    case '3':
                        e.preventDefault();
                        this.switchTab('customers');
                        break;
                    case '4':
                        e.preventDefault();
                        this.switchTab('analytics');
                        break;
                }
            }
        });
        
        // Add focus management for modals
        document.querySelectorAll('.modal').forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
        });
        
        // Add high contrast mode support
        this.setupHighContrastMode();
    }
    
    setupHighContrastMode() {
        // Check for high contrast preference
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
        
        if (prefersHighContrast) {
            document.body.classList.add('high-contrast');
        }
        
        // Listen for changes
        window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('high-contrast');
            } else {
                document.body.classList.remove('high-contrast');
            }
        });
    }
}

// Initialize the application when the page loads
let app;

// Global error handler for browser extension conflicts
window.addEventListener('unhandledrejection', (event) => {
    // Suppress common extension-related errors
    if (event.reason && (
        event.reason.message?.includes('message channel closed') ||
        event.reason.message?.includes('Receiving end does not exist') ||
        event.reason.message?.includes('Extension context invalidated')
    )) {
        event.preventDefault();
        return;
    }
});

// Handle extension message errors
window.addEventListener('error', (event) => {
    // Suppress extension-related errors
    if (event.message && (
        event.message.includes('message channel closed') ||
        event.message.includes('Receiving end does not exist')
    )) {
        event.preventDefault();
        return;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new ADAHApp();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        // Show user-friendly error message
        document.body.innerHTML = `
            <div style="padding: 2rem; text-align: center; font-family: Arial, sans-serif;">
                <h2>Application Failed to Load</h2>
                <p>Please refresh the page or check your browser console for details.</p>
                <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem;">
                    Refresh Page
                </button>
            </div>
        `;
    }
});