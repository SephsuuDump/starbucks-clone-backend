import { app } from './config.js';
import authRoute from './auth-module/auth.js';
import branchRoute from './inventory-module/Branch.js'
import userRoute from './user-module/user.js';
import inventoryItem from './inventory-module/InventoryItem.js'
import inventoryRoute from './inventory-module/Inventory.js'
import supplierRoute from './procurement-module/supplier.js';
import supplyItemRoute from './procurement-module/supply-item.js';
import purchaseOrderRoute from './procurement-module/purchase-order.js';
import purchaseOrderItemRoute from './procurement-module/purchase-order-item.js';
import warehouseRouter from './inventory-module/Warehouse.js'
import transferRoute from './inventory-module/TransferRequest.js'
import projectRoute from './project-management-module/Projects.js'
import tasksRoute from './project-management-module/Tasks.js'
import inventoryLogsRoute from './inventory-module/InventoryLogs.js'
import resourceRoute from './project-management-module/Resource.js'
import resourceAllocationRoute from './project-management-module/ResourceAllocation.js'


app.use('/api/auth', authRoute);
app.use('/api/inventory-item',inventoryItem)
app.use('/api/inventory-logs', inventoryLogsRoute)
app.use('/api/inventory',inventoryRoute)
app.use('/api/purchase-orders', purchaseOrderRoute);
app.use('/api/purchase-order-items', purchaseOrderItemRoute);
app.use('/api/suppliers', supplierRoute);
app.use('/api/supplier-items', supplyItemRoute)
app.use('/api/users', userRoute);
app.use('/api/branch', branchRoute)
app.use('/api/warehouse', warehouseRouter)
app.use('/api/transfer', transferRoute)
app.use('/api/projects', projectRoute)
app.use('/api/tasks', tasksRoute)
app.use('/api/resources', resourceRoute)
app.use('/api/resource-allocation', resourceAllocationRoute)



const PORT = process.env.PORT || 6000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))