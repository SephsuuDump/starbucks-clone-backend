import express from "express";
import { supabase } from "../config.js";

const router = express.Router();
const primaryTable = 'sales_orders';
const secondaryTable = 'customers';
const today = new Date().toISOString().split("T")[0];

router.get('/get-summary', async (req, res) => {
    const { data: totalSales, error: totalSalesError } = await supabase.rpc('sum_total_amount');

    const { count: ordersToday, error: ordersTodayError } = await supabase
    .from(primaryTable)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today} 00:00:00`)
    .lte('created_at', `${today} 23:59:59`);

    const { count: totalCustomers, error: totalCustomersError } = await supabase
    .from(secondaryTable)
    .select('*', { count: 'exact', head: true })

    const { data: salesOverview, error: salesOverviewError } = await supabase.rpc("get_sales_last_6_months");
    
    const [
        newCustomerRes,
        activeRes,
        inactiveRes
    ] = await Promise.all([
        supabase.from(secondaryTable).select("*", { count: "exact", head: true }).eq("is_new_customer", true),
        supabase.from(secondaryTable).select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from(secondaryTable).select("*", { count: "exact", head: true }).eq("is_active", false)
    ]);

    const { data: latestOrders, error: latestOrdersError } = await supabase
    .from(primaryTable)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

    if (totalSalesError) return res.status(500).json({ message: totalSalesError.message });
    if (ordersTodayError) return res.status(500).json({ message: ordersTodayError.message });
    if (totalCustomersError) return res.status(500).json({ message: totalCustomersError.message });
    if (salesOverviewError) return res.status(500).json({ message: salesOverviewError.message });
    if (newCustomerRes.error || activeRes.error || inactiveRes.error) {
        return res.status(500).json({
        message: newCustomerRes.error?.message || activeRes.error?.message || inactiveRes.error?.message
        });
    }
    if (latestOrdersError) return res.status(500).json({ message: latestOrdersError.message });

    const payload = {
        totalSales,
        ordersToday,
        totalCustomers,
        salesOverview,
        customerInsights: [
            { type: "New Customer", count: newCustomerRes.count },
            { type: "Active Customer", count: activeRes.count },
            { type: "Inactive Customer", count: inactiveRes.count }
        ],
        latestOrders
    }

    return res.json(payload);
})

export default router;