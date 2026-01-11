import { app } from './config.js';
import cors from 'cors';
import authRoute from './auth-module/auth.js';
import branchRoute from './inventory-module/Branch.js'
import userRoute from './user-module/user.js';
import inventoryItem from './inventory-module/InventoryItem.js'
import inventoryRoute from './inventory-module/Inventory.js'
import inventoryTransferRoute from './inventory-module/TransferRequest.js'
import inventoryLogsRoute from './inventory-module/InventoryLogs.js';
import warehouseRoute from './inventory-module/Warehouse.js';

import supplierRoute from './procurement-module/supplier.js';
import supplyItemRoute from './procurement-module/supply-item.js';
import purchaseOrderRoute from './procurement-module/purchase-order.js';
import purchaseOrderItemRoute from './procurement-module/purchase-order-item.js';
import procurementSummaryRoute from './procurement-module/summary.js';

import customerRoute from './ecommerce-module/customer.js';
import productRoute from './ecommerce-module/product.js';
import orderRoute from './ecommerce-module/order.js';
import orderItemRoute from './ecommerce-module/order-item.js'
import accountCreditRoute from './ecommerce-module/account-credit.js'

import salesSummaryRoute from './sales-module/summary.js';
import salesReportRoute from './sales-module/sales-reports.js'
import discountRoute from './sales-module/discount.js';
import supportCasesRoute from './sales-module/support-case.js'

import projectRoute from './project-management-module/Projects.js'
import taskRoute from './project-management-module/Tasks.js'
import resourceRoute from './project-management-module/Resource.js'
import resourceAllocationRoute from './project-management-module/ResourceAllocation.js'
import projectActivityRoute from './project-management-module/ProjectActivity.js'

app.use(cors({
  origin: ['http://localhost:3100', 'https://x848qg05-3100.asse.devtunnels.ms'],
  credentials: true
}));

app.use('/api/auth', authRoute);
app.use('/api/inventory-item',inventoryItem)
app.use('/api/inventory-logs', inventoryLogsRoute)
app.use('/api/inventory',inventoryRoute)
app.use('/api/transfer', inventoryTransferRoute)
app.use('/api/branch', branchRoute)
app.use('/api/warehouse', warehouseRoute) 

app.use('/api/procurement-summary', procurementSummaryRoute);
app.use('/api/purchase-orders', purchaseOrderRoute);
app.use('/api/purchase-order-items', purchaseOrderItemRoute);
app.use('/api/suppliers', supplierRoute);
app.use('/api/supplier-items', supplyItemRoute)
app.use('/api/users', userRoute);

app.use('/api/customers', customerRoute)
app.use('/api/products', productRoute)
app.use('/api/orders', orderRoute)
app.use('/api/order-items', orderItemRoute)
app.use('/api/account-credit', accountCreditRoute)

app.use('/api/sales-summary', salesSummaryRoute)
app.use('/api/sales-report', salesReportRoute)
app.use('/api/discounts', discountRoute)
app.use('/api/support-cases', supportCasesRoute)

app.use('/api/projects', projectRoute )
app.use('/api/tasks', taskRoute )
app.use('/api/resources', resourceRoute)
app.use('/api/resource-allocation', resourceAllocationRoute)
app.use('/api/project-activity', projectActivityRoute)

const PORT = process.env.PORT || 6000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))