import express from "express";
import { supabase } from "../config.js";
import { formatSalesOrders } from "../ecommerce-module/_helper.js";

const router = express.Router();
const primaryTable = 'sales_orders';
const secondaryTable = 'customers';
const tertiaryTable = 'products';
const discountsTable = 'discounts';
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

    const { count: totalProducts, error: totalProductsError } = await supabase
    .from(tertiaryTable)
    .select('*', { count: 'exact', head: true })

    const { count: totalDiscounts, error: totalDiscountsError } = await supabase
    .from(discountsTable)
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
    .select(`
        *, 
        order_items(
            *, branch_products(*, products(*))
        ),
        _users(*, customers(*)),
        branch(*)
    `)
    .order("created_at", { ascending: false })
    .limit(5);

    if (totalSalesError) return res.status(500).json({ message: totalSalesError.message });
    if (ordersTodayError) return res.status(500).json({ message: ordersTodayError.message });
    if (totalCustomersError) return res.status(500).json({ message: totalCustomersError.message });
    if (totalProductsError) return res.status(500).json({ message: totalProductsError.message });
    if (totalDiscountsError) return res.status(500).json({ message: totalDiscountsError.message });
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
        totalProducts,
        totalDiscounts,
        customerInsights: [
            { type: "New Customer", count: newCustomerRes.count },
            { type: "Active Customer", count: activeRes.count },
            { type: "Inactive Customer", count: inactiveRes.count }
        ],
        latestOrders: formatSalesOrders(latestOrders)
    }

    return res.json(payload);
})

export default router;