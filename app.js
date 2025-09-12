import { app } from './config.js';
import authRoutes from './auth-module/auth.js';
import supplierRoute from './procurement-module/supplier.js';
import purchaseOrderRoute from './procurement-module/purchase-order.js';
import purchaseRequestRouter from './procurement-module/purchase-request.js';
import purchaseOrderItemRoute from './procurement-module/purchase-order-item.js';

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoute);
app.use('/api/purchase-orders', purchaseOrderRoute);
app.use('/api/purchase-requests', purchaseRequestRouter);
app.use('/api/purchase-order-items', purchaseOrderItemRoute);

const PORT = process.env.PORT || 6000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))