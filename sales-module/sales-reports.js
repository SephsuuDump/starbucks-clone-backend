import express from "express";
import { supabase } from "../config.js";
import PDFDocument from 'pdfkit'

const router = express.Router();

router.get('/get-previous-sales', async (req, res) => {
    const { data: salesOverview, error: salesOverviewError } = await supabase.rpc("get_sales_last_6_months");

    if (salesOverviewError) return res.status(500).json({ message: salesOverviewError.message });

    res.json(salesOverview);
})

router.get('/get-product-monthly-sales', async (req, res) => {
    const { data, error } = await supabase.rpc('get_product_monthly_sales');

    if (error) {
    console.error(error);
    return res.status(400).json(error);
    }

res.json(data);
})

router.get('/top-products', async (req, res) => {
    const { id } = req.query;

    const { data, error } = await supabase.rpc(
        'get_top_products',
        { branch: id || null }
    );

    if (error) return res.status(400).json({ error });

    res.json(data);
});

router.get('/get-customer-product-count', async (req, res) => {
    const { data, error } = await supabase.rpc(
        'get_customer_product_item_counts'
    );

    if (error) {
        console.error(error);
        return res.status(400).json(error);
    }

    res.json(data);
});

router.post("/export-product-sales-report", async (req, res) => {
    try {
        const data = req.body; // array of monthly product sales

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: "No data provided" });
        }

        const doc = new PDFDocument({ margin: 50, size: "A4" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=monthly-product-sales-report.pdf"
        );

        doc.pipe(res);

        /* ================= HEADER ================= */
        doc
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("STARBUCKS", { align: "left" });

        doc
            .fontSize(12)
            .font("Helvetica")
            .text("Monthly Product Sales Report", { align: "left" });

        doc.moveDown(0.5);
        doc
            .fontSize(10)
            .text(`Generated on: ${new Date().toLocaleDateString()}`);

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        /* ================= TABLE HEADER ================= */
        let tableTop = doc.y + 15;

        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("Month", 50, tableTop);
        doc.text("Product Name", 120, tableTop);
        doc.text("Units Sold", 350, tableTop, { width: 80, align: "right" });
        doc.text("Revenue (₱)", 450, tableTop, { width: 80, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        /* ================= TABLE ROWS ================= */
        doc.font("Helvetica").fontSize(10);
        let y = tableTop + 25;

        let totalUnits = 0;
        let totalRevenue = 0;

        for (const row of data) {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }

            doc.text(row.month_label, 50, y);
            doc.text(row.product_name.trim(), 120, y, { width: 210 });
            doc.text(row.units_sold.toString(), 350, y, {
                width: 80,
                align: "right",
            });
            doc.text(row.product_revenue.toLocaleString(), 450, y, {
                width: 80,
                align: "right",
            });

            totalUnits += row.units_sold;
            totalRevenue += row.product_revenue;

            y += 22;
        }

        /* ================= TOTALS ================= */
        doc.moveDown(1);
        doc.moveTo(50, y).lineTo(550, y).stroke();

        y += 15;
        doc.font("Helvetica-Bold");
        doc.text("TOTAL", 120, y);
        doc.text(totalUnits.toLocaleString(), 350, y, {
            width: 80,
            align: "right",
        });
        doc.text(`₱${totalRevenue.toLocaleString()}`, 450, y, {
            width: 80,
            align: "right",
        });

        /* ================= FOOTER ================= */
        doc.moveDown(3);
        doc.fontSize(8).font("Helvetica");
        doc.text(
            "This report is system-generated and intended for internal use only.",
            50,
            doc.page.height - 80,
            { align: "center", width: 500 }
        );

        doc.end();
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate report" });
    }
});

router.post("/export-top-products-report", async (req, res) => {
    try {
        const data = req.body;

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ message: "No data provided" });
        }

        // Sort by revenue (highest first)
        const sortedData = [...data].sort(
            (a, b) => Number(b.total_revenue) - Number(a.total_revenue)
        );

        const doc = new PDFDocument({ margin: 50, size: "A4" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=top-products-sales-report.pdf"
        );

        doc.pipe(res);

        /* ================= HEADER ================= */
        doc
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("STARBUCKS");

        doc
            .fontSize(12)
            .font("Helvetica")
            .text("Top Products Sales Report");

        doc
            .fontSize(10)
            .text(`Generated on: ${new Date().toLocaleDateString()}`);

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        /* ================= TABLE HEADER ================= */
        let tableTop = doc.y + 15;

        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("#", 50, tableTop);
        doc.text("Product Name", 80, tableTop);
        doc.text("Units Sold", 360, tableTop, { width: 80, align: "right" });
        doc.text("Revenue (₱)", 460, tableTop, { width: 80, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        /* ================= TABLE ROWS ================= */
        doc.font("Helvetica").fontSize(10);
        let y = tableTop + 25;

        let totalUnits = 0;
        let totalRevenue = 0;

        sortedData.forEach((row, index) => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }

            doc.text(String(index + 1), 50, y);
            doc.text((row.product_name ?? "").trim(), 80, y, {
                width: 260,
            });

            doc.text(
                String(Number(row.total_quantity_sold) || 0),
                360,
                y,
                { width: 80, align: "right" }
            );

            doc.text(
                Number(row.total_revenue || 0).toLocaleString(),
                460,
                y,
                { width: 80, align: "right" }
            );

            totalUnits += Number(row.total_quantity_sold) || 0;
            totalRevenue += Number(row.total_revenue) || 0;

            y += 22;
        });

        /* ================= TOTALS ================= */
        doc.moveDown(1);
        doc.moveTo(50, y).lineTo(550, y).stroke();

        y += 15;
        doc.font("Helvetica-Bold");
        doc.text("TOTAL", 80, y);
        doc.text(totalUnits.toLocaleString(), 360, y, {
            width: 80,
            align: "right",
        });
        doc.text(`₱${totalRevenue.toLocaleString()}`, 460, y, {
            width: 80,
            align: "right",
        });

        /* ================= FOOTER ================= */
        doc.fontSize(8).font("Helvetica");
        doc.text(
            "This report is system-generated and intended for internal business analysis only.",
            50,
            doc.page.height - 80,
            { align: "center", width: 500 }
        );

        doc.end();
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate report" });
    }
});

router.post("/export-sales-orders-report", async (req, res) => {
    try {
        const orders = req.body;

        if (!Array.isArray(orders) || orders.length === 0) {
            return res.status(400).json({ message: "No orders provided" });
        }

        // Sort newest first
        const sortedOrders = [...orders].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        const doc = new PDFDocument({ margin: 50, size: "A4" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=sales-orders-report.pdf"
        );

        doc.pipe(res);

        /* ================= HEADER ================= */
        doc.fontSize(20).font("Helvetica-Bold").text("STARBUCKS");
        doc.fontSize(12).font("Helvetica").text("Sales Orders Report");
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`);

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        let y = doc.y + 15;

        let grandTotal = 0;
        let paidTotal = 0;
        let pendingTotal = 0;

        /* ================= ORDERS ================= */
        sortedOrders.forEach((order, index) => {
            if (y > 720) {
                doc.addPage();
                y = 50;
            }

            const orderDate = new Date(order.created_at).toLocaleString();

            /* ---------- ORDER HEADER ---------- */
            doc.font("Helvetica-Bold").fontSize(11);
            doc.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, 50, y);
            doc.text(`Status: ${order.status}`, 350, y);
            y += 15;

            doc.font("Helvetica").fontSize(10);
            doc.text(`Date: ${orderDate}`, 50, y);
            doc.text(`Payment: ${order.payment_mode.toUpperCase()}`, 350, y);
            y += 15;

            doc.text(`Branch: ${order.branch?.name ?? "N/A"}`, 50, y);
            doc.text(
                `Customer: ${order.customer?.first_name} ${order.customer?.last_name}`,
                350,
                y
            );
            y += 15;

            /* ---------- ITEMS TABLE HEADER ---------- */
            doc.font("Helvetica-Bold");
            doc.text("Item", 60, y);
            doc.text("Qty", 300, y, { width: 50, align: "right" });
            doc.text("Price", 360, y, { width: 70, align: "right" });
            doc.text("Total", 450, y, { width: 80, align: "right" });

            y += 10;
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 8;

            doc.font("Helvetica");

            let orderItemsTotal = 0;

            if (order.order_items.length === 0) {
                doc.text("No items recorded", 60, y);
                y += 18;
            } else {
                order.order_items.forEach(item => {
                    if (y > 720) {
                        doc.addPage();
                        y = 50;
                    }

                    doc.text(item.name.trim(), 60, y, { width: 220 });
                    doc.text(item.quantity.toString(), 300, y, {
                        width: 50,
                        align: "right",
                    });
                    doc.text(
                        `₱${item.unit_price.toLocaleString()}`,
                        360,
                        y,
                        { width: 70, align: "right" }
                    );
                    doc.text(
                        `₱${item.total_price.toLocaleString()}`,
                        450,
                        y,
                        { width: 80, align: "right" }
                    );

                    orderItemsTotal += item.total_price;
                    y += 18;
                });
            }

            /* ---------- ORDER TOTAL ---------- */
            doc.font("Helvetica-Bold");
            doc.text("Order Total:", 360, y);
            doc.text(`₱${order.total_amount.toLocaleString()}`, 450, y, {
                width: 80,
                align: "right",
            });

            y += 25;
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 20;

            grandTotal += order.total_amount;
            if (order.status === "PAID") paidTotal += order.total_amount;
            if (order.status === "PENDING") pendingTotal += order.total_amount;
        });

        /* ================= SUMMARY ================= */
        if (y > 680) {
            doc.addPage();
            y = 50;
        }

        doc.font("Helvetica-Bold").fontSize(12);
        doc.text("SUMMARY", 50, y);
        y += 15;

        doc.font("Helvetica");
        doc.text(`Total Sales: ₱${grandTotal.toLocaleString()}`, 50, y);
        y += 12;
        doc.text(`Paid Sales: ₱${paidTotal.toLocaleString()}`, 50, y);
        y += 12;
        doc.text(`Pending Sales: ₱${pendingTotal.toLocaleString()}`, 50, y);

        /* ================= FOOTER ================= */
        doc.fontSize(8);
        doc.text(
            "This report is system-generated and intended for internal use only.",
            50,
            doc.page.height - 80,
            { align: "center", width: 500 }
        );

        doc.end();
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate sales report" });
    }
});

router.post("/export-top-products-period-report", async (req, res) => {
    try {
        const products = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: "No product data provided" });
        }

        // Sort by highest revenue
        const sortedProducts = [...products].sort(
            (a, b) => Number(b.total_revenue) - Number(a.total_revenue)
        );

        const doc = new PDFDocument({ margin: 50, size: "A4" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=top-products-period-report.pdf"
        );

        doc.pipe(res);

        /* ================= HEADER ================= */
        doc.fontSize(20).font("Helvetica-Bold").text("STARBUCKS");
        doc.fontSize(12).font("Helvetica").text("Top Products Sales Report");
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`);

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        /* ================= TABLE HEADER ================= */
        let tableTop = doc.y + 15;

        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("#", 50, tableTop);
        doc.text("Product Name", 80, tableTop);
        doc.text("Units Sold", 360, tableTop, { width: 80, align: "right" });
        doc.text("Revenue (₱)", 460, tableTop, { width: 80, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        /* ================= TABLE ROWS ================= */
        doc.font("Helvetica").fontSize(10);
        let y = tableTop + 25;

        let totalUnits = 0;
        let totalRevenue = 0;

        sortedProducts.forEach((p, index) => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }

            doc.text(String(index + 1), 50, y);
            doc.text((p.product_name ?? "").trim(), 80, y, { width: 260 });
            doc.text(
                String(Number(p.total_quantity_sold) || 0),
                360,
                y,
                { width: 80, align: "right" }
            );
            doc.text(
                Number(p.total_revenue || 0).toLocaleString(),
                460,
                y,
                { width: 80, align: "right" }
            );

            totalUnits += Number(p.total_quantity_sold) || 0;
            totalRevenue += Number(p.total_revenue) || 0;

            y += 22;
        });

        /* ================= TOTALS ================= */
        doc.moveDown(1);
        doc.moveTo(50, y).lineTo(550, y).stroke();

        y += 15;
        doc.font("Helvetica-Bold");
        doc.text("TOTAL", 80, y);
        doc.text(totalUnits.toLocaleString(), 360, y, {
            width: 80,
            align: "right",
        });
        doc.text(`₱${totalRevenue.toLocaleString()}`, 460, y, {
            width: 80,
            align: "right",
        });

        /* ================= FOOTER ================= */
        doc.fontSize(8).font("Helvetica");
        doc.text(
            "This report is system-generated and intended for internal sales analysis only.",
            50,
            doc.page.height - 80,
            { align: "center", width: 500 }
        );

        doc.end();
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate report" });
    }
});

export default router;