// Database class for handling IndexedDB operations
class Database {
    constructor(dbName = 'ADAH_StockManagement') {
        this.dbName = dbName;
        this.dbVersion = 1;
        this.db = null;
    }

    // Initialize database and create tables
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create Stock table
                if (!db.objectStoreNames.contains('stock')) {
                    const stockStore = db.createObjectStore('stock', { keyPath: 'id', autoIncrement: true });
                    stockStore.createIndex('name', 'name', { unique: false });
                    stockStore.createIndex('quantity', 'quantity', { unique: false });
                    stockStore.createIndex('created_date', 'created_date', { unique: false });
                }

                // Create Sales table
                if (!db.objectStoreNames.contains('sales')) {
                    const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                    salesStore.createIndex('date', 'date', { unique: false });
                    salesStore.createIndex('item_id', 'item_id', { unique: false });
                    salesStore.createIndex('customer_name', 'customer_name', { unique: false });
                    salesStore.createIndex('customer_phone', 'customer_phone', { unique: false });
                }

                // Create Customers table (derived from sales)
                if (!db.objectStoreNames.contains('customers')) {
                    const customersStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                    customersStore.createIndex('name', 'name', { unique: false });
                    customersStore.createIndex('phone', 'phone', { unique: false });
                }
            };
        });
    }

    // Generic method to add record to a store
    async addRecord(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Add timestamp
            data.created_date = new Date().toISOString();
            data.updated_date = new Date().toISOString();

            const request = store.add(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to add record to ${storeName}`));
            };
        });
    }

    // Generic method to get all records from a store
    async getAllRecords(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to get records from ${storeName}`));
            };
        });
    }

    // Generic method to get record by ID
    async getRecordById(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to get record from ${storeName}`));
            };
        });
    }

    // Generic method to update record
    async updateRecord(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Update timestamp
            data.updated_date = new Date().toISOString();

            const request = store.put(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to update record in ${storeName}`));
            };
        });
    }

    // Generic method to delete record
    async deleteRecord(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to delete record from ${storeName}`));
            };
        });
    }

    // Stock-specific methods
    async addStock(name, quantity, price, description = '') {
        const stockData = {
            name: name.trim(),
            quantity: parseInt(quantity),
            price: parseFloat(price),
            description: description.trim()
        };

        // Check for duplicate name
        const existingStock = await this.getStockByName(name);
        if (existingStock) {
            throw new Error('Stock item with this name already exists');
        }

        return await this.addRecord('stock', stockData);
    }

    async updateStock(id, name, quantity, price, description = '') {
        const stockData = {
            id: parseInt(id),
            name: name.trim(),
            quantity: parseInt(quantity),
            price: parseFloat(price),
            description: description.trim()
        };

        // Check for duplicate name (excluding current item)
        const existingStock = await this.getStockByName(name);
        if (existingStock && existingStock.id !== parseInt(id)) {
            throw new Error('Stock item with this name already exists');
        }

        return await this.updateRecord('stock', stockData);
    }

    async deleteStock(id) {
        // Check if item has sales records
        const sales = await this.getSalesByItemId(parseInt(id));
        if (sales.length > 0) {
            throw new Error('Cannot delete stock item with existing sales records');
        }

        return await this.deleteRecord('stock', parseInt(id));
    }

    async getAllStock() {
        const stock = await this.getAllRecords('stock');
        return stock.sort((a, b) => a.name.localeCompare(b.name));
    }

    async getStockById(id) {
        return await this.getRecordById('stock', parseInt(id));
    }

    async getStockByName(name) {
        const stock = await this.getAllRecords('stock');
        return stock.find(item => item.name.toLowerCase() === name.toLowerCase());
    }

    async searchStock(searchTerm) {
        const stock = await this.getAllRecords('stock');
        const term = searchTerm.toLowerCase();
        return stock.filter(item => 
            item.name.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term)
        );
    }

    // Sales-specific methods
    async addSale(itemId, quantitySold, totalAmount, customerName = '', customerPhone = '', paid = 1) {
        const saleData = {
            item_id: parseInt(itemId),
            quantity_sold: parseInt(quantitySold),
            total_amount: parseFloat(totalAmount),
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            paid: parseInt(paid),
            date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
        };

        // Validate phone number
        if (customerPhone && !this.validatePhone(customerPhone)) {
            throw new Error('Invalid phone number format');
        }

        // Check stock availability
        const stockItem = await this.getStockById(itemId);
        if (!stockItem) {
            throw new Error('Stock item not found');
        }

        if (stockItem.quantity < quantitySold) {
            throw new Error(`Insufficient stock. Available: ${stockItem.quantity}, Requested: ${quantitySold}`);
        }

        // Add sale and update stock in transaction
        const saleId = await this.addRecord('sales', saleData);
        
        // Update stock quantity
        stockItem.quantity -= quantitySold;
        await this.updateRecord('stock', stockItem);

        return saleId;
    }

    async updateSale(id, itemId, quantitySold, totalAmount, customerName = '', customerPhone = '', paid = 1) {
        const saleData = {
            id: parseInt(id),
            item_id: parseInt(itemId),
            quantity_sold: parseInt(quantitySold),
            total_amount: parseFloat(totalAmount),
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            paid: parseInt(paid),
            date: new Date().toISOString().split('T')[0]
        };

        // Validate phone number
        if (customerPhone && !this.validatePhone(customerPhone)) {
            throw new Error('Invalid phone number format');
        }

        // Get old sale data
        const oldSale = await this.getRecordById('sales', parseInt(id));
        if (!oldSale) {
            throw new Error('Sale record not found');
        }

        // Revert old stock
        const oldStockItem = await this.getStockById(oldSale.item_id);
        oldStockItem.quantity += oldSale.quantity_sold;
        await this.updateRecord('stock', oldStockItem);

        // Check new stock availability
        const newStockItem = await this.getStockById(itemId);
        if (!newStockItem) {
            throw new Error('New stock item not found');
        }

        if (newStockItem.quantity < quantitySold) {
            // Restore old stock and raise error
            oldStockItem.quantity -= oldSale.quantity_sold;
            await this.updateRecord('stock', oldStockItem);
            throw new Error(`Insufficient stock. Available: ${newStockItem.quantity}, Requested: ${quantitySold}`);
        }

        // Update new stock and sale
        newStockItem.quantity -= quantitySold;
        await this.updateRecord('stock', newStockItem);

        return await this.updateRecord('sales', saleData);
    }

    async deleteSale(id) {
        const sale = await this.getRecordById('sales', parseInt(id));
        if (!sale) {
            throw new Error('Sale record not found');
        }

        // Restore stock
        const stockItem = await this.getStockById(sale.item_id);
        stockItem.quantity += sale.quantity_sold;
        await this.updateRecord('stock', stockItem);

        return await this.deleteRecord('sales', parseInt(id));
    }

    async getAllSales() {
        const sales = await this.getAllRecords('sales');
        return sales.sort((a, b) => {
            // Sort by date descending, then by id descending
            if (a.date === b.date) {
                return b.id - a.id;
            }
            return b.date.localeCompare(a.date);
        });
    }

    async getSaleById(id) {
        return await this.getRecordById('sales', parseInt(id));
    }

    async getSalesByItemId(itemId) {
        const sales = await this.getAllRecords('sales');
        return sales.filter(sale => sale.item_id === parseInt(itemId));
    }

    async getSalesByDateRange(startDate, endDate) {
        const sales = await this.getAllRecords('sales');
        return sales.filter(sale => sale.date >= startDate && sale.date <= endDate);
    }

    async getSalesByCustomer(customerName) {
        const sales = await this.getAllRecords('sales');
        return sales.filter(sale => 
            sale.customer_name.toLowerCase().includes(customerName.toLowerCase())
        );
    }

    async searchSales(searchTerm) {
        const sales = await this.getAllRecords('sales');
        const term = searchTerm.toLowerCase();
        
        // Get stock names for matching
        const stock = await this.getAllRecords('stock');
        const stockNames = {};
        stock.forEach(item => {
            stockNames[item.id] = item.name;
        });

        return sales.filter(sale => 
            sale.customer_name.toLowerCase().includes(term) ||
            sale.customer_phone.includes(term) ||
            (stockNames[sale.item_id] && stockNames[sale.item_id].toLowerCase().includes(term))
        );
    }

    // Customer-specific methods
    async getAllCustomers() {
        const sales = await this.getAllRecords('sales');
        const customersMap = new Map();

        sales.forEach(sale => {
            if (sale.customer_name && sale.customer_name.trim()) {
                const key = `${sale.customer_name}_${sale.customer_phone || ''}`;
                if (!customersMap.has(key)) {
                    customersMap.set(key, {
                        name: sale.customer_name,
                        phone: sale.customer_phone,
                        totalPurchases: 0,
                        totalSpent: 0,
                        lastPurchase: sale.date
                    });
                }
                const customer = customersMap.get(key);
                customer.totalPurchases++;
                customer.totalSpent += sale.total_amount;
                if (sale.date > customer.lastPurchase) {
                    customer.lastPurchase = sale.date;
                }
            }
        });

        return Array.from(customersMap.values()).sort((a, b) => 
            b.totalSpent - a.totalSpent
        );
    }

    async getCustomerByName(name) {
        const customers = await this.getAllCustomers();
        return customers.find(customer => 
            customer.name.toLowerCase() === name.toLowerCase()
        );
    }

    async getCustomerRecords(customerIdentifier) {
        const sales = await this.getAllRecords('sales');
        const stock = await this.getAllRecords('stock');
        const stockNames = {};
        stock.forEach(item => {
            stockNames[item.id] = item.name;
        });

        return sales.filter(sale => 
            sale.customer_name.toLowerCase().includes(customerIdentifier.toLowerCase()) ||
            sale.customer_phone.includes(customerIdentifier)
        ).map(sale => ({
            ...sale,
            item_name: stockNames[sale.item_id] || 'Unknown'
        }));
    }

    // Analytics methods
    async getSalesStatistics(days = 30) {
        const sales = await this.getAllRecords('sales');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const recentSales = sales.filter(sale => sale.date >= cutoffDateStr);

        // Daily statistics
        const dailyStats = {};
        recentSales.forEach(sale => {
            if (!dailyStats[sale.date]) {
                dailyStats[sale.date] = { total: 0, count: 0 };
            }
            dailyStats[sale.date].total += sale.total_amount;
            dailyStats[sale.date].count += 1;
        });

        const dailyArray = Object.entries(dailyStats).map(([date, stats]) => ({
            date,
            total: stats.total,
            count: stats.count
        })).sort((a, b) => a.date.localeCompare(b.date));

        // Top items
        const itemStats = {};
        recentSales.forEach(sale => {
            if (!itemStats[sale.item_id]) {
                itemStats[sale.item_id] = { quantity: 0, name: '' };
            }
            itemStats[sale.item_id].quantity += sale.quantity_sold;
        });

        const stock = await this.getAllRecords('stock');
        stock.forEach(item => {
            if (itemStats[item.id]) {
                itemStats[item.id].name = item.name;
            }
        });

        const topItems = Object.entries(itemStats)
            .map(([id, stats]) => ({
                name: stats.name,
                quantity: stats.quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        // Monthly statistics
        const monthlyStats = {};
        sales.forEach(sale => {
            const month = sale.date.substring(0, 7); // YYYY-MM
            if (!monthlyStats[month]) {
                monthlyStats[month] = 0;
            }
            monthlyStats[month] += sale.total_amount;
        });

        const monthlyArray = Object.entries(monthlyStats).map(([month, total]) => ({
            month,
            total
        })).sort((a, b) => a.month.localeCompare(b.month));

        return {
            daily: dailyArray,
            topItems,
            monthly: monthlyArray
        };
    }

    async getLowStockItems(threshold = 10) {
        const stock = await this.getAllRecords('stock');
        return stock.filter(item => item.quantity <= threshold)
                   .sort((a, b) => a.quantity - b.quantity);
    }

    async getTotalStockValue() {
        const stock = await this.getAllRecords('stock');
        return stock.reduce((total, item) => total + (item.quantity * item.price), 0);
    }

    async getTotalRevenue() {
        const sales = await this.getAllRecords('sales');
        return sales.reduce((total, sale) => total + sale.total_amount, 0);
    }

    // Utility methods
    validatePhone(phone) {
        // Remove any non-digit characters
        const cleanPhone = phone.replace(/\D/g, '');
        // Check if it's 10 digits starting with 07
        return /^07\d{8}$/.test(cleanPhone);
    }

    // Export data to JSON
    async exportData() {
        const stock = await this.getAllRecords('stock');
        const sales = await this.getAllRecords('sales');
        const customers = await this.getAllCustomers();

        return {
            stock,
            sales,
            customers,
            exportDate: new Date().toISOString()
        };
    }

    // Import data from JSON
    async importData(data) {
        // Clear existing data
        const stock = await this.getAllRecords('stock');
        const sales = await this.getAllRecords('sales');
        
        for (const item of stock) {
            await this.deleteRecord('stock', item.id);
        }
        for (const sale of sales) {
            await this.deleteRecord('sales', sale.id);
        }

        // Import new data
        if (data.stock) {
            for (const item of data.stock) {
                delete item.id; // Let IndexedDB generate new IDs
                await this.addRecord('stock', item);
            }
        }

        if (data.sales) {
            for (const sale of data.sales) {
                delete sale.id; // Let IndexedDB generate new IDs
                await this.addRecord('sales', sale);
            }
        }
    }

    // Local Storage Management for Offline Persistence
    async backupToLocalStorage() {
        try {
            const data = await this.exportData();
            localStorage.setItem('adah_backup', JSON.stringify(data));
            localStorage.setItem('adah_last_backup', new Date().toISOString());
            console.log('Data backed up to local storage');
            return true;
        } catch (error) {
            console.error('Failed to backup to local storage:', error);
            return false;
        }
    }

    async restoreFromLocalStorage() {
        try {
            const backupData = localStorage.getItem('adah_backup');
            if (!backupData) {
                console.log('No backup data found in local storage');
                return false;
            }

            const data = JSON.parse(backupData);
            await this.importData(data);
            console.log('Data restored from local storage');
            return true;
        } catch (error) {
            console.error('Failed to restore from local storage:', error);
            return false;
        }
    }

    async syncLocalStorage() {
        try {
            const lastBackup = localStorage.getItem('adah_last_backup');
            const currentTime = new Date();
            
            // Backup if last backup was more than 5 minutes ago
            if (!lastBackup || (currentTime - new Date(lastBackup)) > 5 * 60 * 1000) {
                await this.backupToLocalStorage();
            }
        } catch (error) {
            console.error('Local storage sync failed:', error);
        }
    }

    // Enhanced data persistence with local storage
    async _addRecordOriginal(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Add timestamp
        data.created_date = new Date().toISOString();
        data.updated_date = new Date().toISOString();

        const request = store.add(data);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to add record to ${storeName}`));
            };
        });
    }
    
    async _updateRecordOriginal(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Update timestamp
        data.updated_date = new Date().toISOString();

        const request = store.put(data);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to update record in ${storeName}`));
            };
        });
    }
    
    async _deleteRecordOriginal(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error(`Failed to delete record from ${storeName}`));
            };
        });
    }
    
    async addRecord(storeName, data) {
        const result = await this._addRecordOriginal(storeName, data);
        await this.syncLocalStorage(); // Backup after changes
        return result;
    }

    async updateRecord(storeName, data) {
        const result = await this._updateRecordOriginal(storeName, data);
        await this.syncLocalStorage(); // Backup after changes
        return result;
    }

    async deleteRecord(storeName, id) {
        const result = await this._deleteRecordOriginal(storeName, id);
        await this.syncLocalStorage(); // Backup after changes
        return result;
    }

    // Offline detection and handling
    isOnline() {
        return navigator.onLine;
    }

    setupOfflineHandling() {
        // Handle online event
        window.addEventListener('online', async () => {
            console.log('Connection restored - syncing data');
            await this.syncLocalStorage();
        });

        // Handle offline event
        window.addEventListener('offline', () => {
            console.log('Connection lost - operating in offline mode');
        });

        // Periodic backup
        setInterval(() => {
            if (this.isOnline()) {
                this.syncLocalStorage();
            }
        }, 60000); // Backup every minute
    }

    // Enhanced initialization with offline support
    async initEnhanced() {
        try {
            // Call original init method
            const db = await this.init();
            
            // Set up offline handling
            this.setupOfflineHandling();
            
            // Try to restore from local storage if database is empty
            const stock = await this.getAllRecords('stock');
            const sales = await this.getAllRecords('sales');
            
            if (stock.length === 0 && sales.length === 0) {
                console.log('Database is empty, checking for local storage backup...');
                await this.restoreFromLocalStorage();
            }
            
            // Initial backup
            await this.syncLocalStorage();
            
            return db;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    // Get storage usage information
    getStorageInfo() {
        try {
            const backupData = localStorage.getItem('adah_backup');
            const lastBackup = localStorage.getItem('adah_last_backup');
            const actionLogs = localStorage.getItem('debtorActionLogs');
            
            return {
                hasBackup: !!backupData,
                lastBackup: lastBackup ? new Date(lastBackup) : null,
                backupSize: backupData ? new Blob([backupData]).size : 0,
                actionLogsCount: actionLogs ? JSON.parse(actionLogs).length : 0,
                isOnline: this.isOnline()
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return null;
        }
    }

    // Clear old data and optimize storage
    async cleanupStorage() {
        try {
            // Clean old action logs (keep only last 100)
            const logs = JSON.parse(localStorage.getItem('debtorActionLogs') || '[]');
            if (logs.length > 100) {
                const recentLogs = logs.slice(-100);
                localStorage.setItem('debtorActionLogs', JSON.stringify(recentLogs));
            }

            // Clean old backups (keep only latest)
            const currentBackup = localStorage.getItem('adah_backup');
            if (currentBackup) {
                localStorage.setItem('adah_backup_clean', currentBackup);
                localStorage.removeItem('adah_backup');
                localStorage.setItem('adah_backup', currentBackup);
            }

            console.log('Storage cleanup completed');
        } catch (error) {
            console.error('Storage cleanup failed:', error);
        }
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Database;
} else if (typeof window !== 'undefined') {
    window.Database = Database;
}
