import { app } from './config.js';
import authRoute from './auth-module/auth.js';
import branchRoute from './inventory-module/Branch.js'
import userRoute from './user-module/user.js';
import inventoryItem from './inventory-module/InventoryItem.js'
import supplierRoute from './procurement-module/supplier.js';
import supplyItemRoute from './procurement-module/supply-item.js';
import purchaseOrderRoute from './procurement-module/purchase-order.js';
import purchaseOrderItemRoute from './procurement-module/purchase-order-item.js';
import procurementSummaryRoute from './procurement-module/summary.js';

import customerRoute from './ecommerce-module/customer.js';
import productRoute from './ecommerce-module/product.js';
import orderRoute from './ecommerce-module/order.js';


app.use('/api/auth', authRoute);
app.use('/api/inventory-item',inventoryItem)
app.use('/api/purchase-orders', purchaseOrderRoute);
app.use('/api/purchase-order-items', purchaseOrderItemRoute);
app.use('/api/suppliers', supplierRoute);
app.use('/api/supplier-items', supplyItemRoute)
app.use('/api/users', userRoute);
app.use('/api/branch', branchRoute)
app.use('/api/procurement-summary', procurementSummaryRoute),

app.use('/api/customers', customerRoute)
app.use('/api/products', productRoute)
app.use('/api/orders', orderRoute)


const PORT = process.env.PORT || 6000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))