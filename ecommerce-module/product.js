import express from "express";
import { supabase } from "../config.js";
import multer from "multer";
import { formatBranchProducts } from "./_helper.js";

const router = express.Router();
const parentTable = 'products';
const secondaryTable = 'branch_products';
const upload = multer({ storage: multer.memoryStorage() });

router.get('/get-all', async (req, res) => {
    const { data, error } = await supabase
    .from(parentTable)
    .select(`*`)
    .eq('is_deleted', false)

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.get('/get-by-id', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .select(`*`)
    .eq('id', id)
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` })

    return res.json(data);
})

router.get('/get-by-branch', async (req, res) => {
    const { id } = req.query;

    const { data, error } = await supabase
        .from(secondaryTable)
        .select(`
            *,
            products!inner(*)
        `)
        .eq("branch_id", id)
        .eq("products.is_deleted", false)
        .order('products(name)', { ascending: true })

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ message: error.message });
    }

    if (!data || data.length === 0) {
        return res.status(404).json({ message: `No products found for branch ${id}` });
    }

    return res.json(formatBranchProducts(data));
});

router.post('/create', async (req, res) => {
    const newProduct = req.body;

    const { data, error } = await supabase
    .from(parentTable)
    .insert(newProduct)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.post('/create-fd', upload.single("image"), async (req, res) => {
    const file = req.file;
    const { name, category, description, price } = req.body;
    
    if (!name || !category || !description || price === undefined) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const { data: imageUpload, error: uploadError } = await supabase.storage
        .from("images") 
        .upload(`product-images/${Date.now()}-${file.originalname}`, file.buffer, {
            contentType: file.mimetype,
        });

    if (uploadError) return res.status(500).json({ message: uploadError.message });

    const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(imageUpload.path);

    const { data, error } = await supabase
    .from(parentTable)
    .insert({
        name,
        category,
        description,
        price: Number(price),
        image_url: publicUrl,
    })
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
})

router.post('/create-branch-products', async (req, res) => {
    const { id } = req.query;
    const productsResponse = await fetch(
        `${process.env.NEST_PUBLIC_API_URL}/products/get-all`,
        { method: 'GET', headers: {"Content-Type": "application/json"} }
    )

    const products = await productsResponse.json()    
    const branchProducts = products.map((item) => ({
        product_id: item.id,
        branch_id: id,
        stock: 100
    }))

    const { data: existing, error: existingError } = await supabase
    .from(secondaryTable)
    .select('*')
    .eq('branch_id', id)

    if (existing && existing.length > 0) {
        return res.status(400).json({ message: 'Branch products already exist.' })
    }
    if (existingError) return res.status(500).json({ message: existingError.message });

    const { data, error } = await supabase
    .from(secondaryTable)
    .insert(branchProducts)
    .select('*')

    if (error) return res.status(500).json({ message: error.message });
    
    return res.json(data)
})

router.patch('/update', async (req, res) => {
    const updatedProduct = req.body;
    const { data, error } = await supabase
    .from(parentTable)
    .update(updatedProduct)
    .eq('id', updatedProduct.id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${updatedProduct.id} does not exists.` });

    return res.json(data);
})

router.patch('/update-branch-product', async (req, res) => {
    const updatedProduct = req.body;
    const { data, error } = await supabase
    .from(secondaryTable)
    .update(updatedProduct)
    .eq('id', updatedProduct.id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${updatedProduct.id} does not exists.` });

    return res.json(data);
})

router.patch('/bulk-edit', async (req, res) => {
    const { price, bulk } = req.body;

    if (price == null || !Array.isArray(bulk) || bulk.length === 0) {
        return res.status(400).json({ message: "Price and bulk array are required." });
    }

    const { data, error } = await supabase.rpc(
        "bulk_increase_price",
        {
            p_amount: price,
            p_ids: bulk
        }
    );

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    return res.json({
        message: "Bulk price increase successful"
    });
});

router.patch('/bulk-stock', async (req, res) => {
    const { stock, bulk } = req.body;

    if (stock == null || !Array.isArray(bulk) || bulk.length === 0) {
        return res.status(400).json({ message: "Stock amount and bulk array are required." });
    }

    const { error } = await supabase.rpc(
        "bulk_increase_stock",
        {
            p_amount: stock,
            p_ids: bulk
        }
    );

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    return res.json({
        message: "Bulk stock increase successful"
    });
});


router.patch('/bulk-delete', async (req, res) => {
    const { bulk } = req.body;

    if (!Array.isArray(bulk) || bulk.length === 0) {
        return res.status(400).json({ message: "Bulk array of IDs is required." });
    }

    const { error } = await supabase.rpc(
        "bulk_delete_products",
        {
            p_ids: bulk
        }
    );

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    return res.json({
        message: "Bulk delete successful."
    });
});

router.patch('/update-fd', upload.single("image"), async (req, res) => {
    const file = req.file;
    const { id, name, category, description, price } = req.body;
    console.log(id, name, category, description, price);
    
    if (!id) {
        return res.status(400).json({ message: "Product ID is required." });
    }

    if (!name || !category || !description || price === undefined) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    let imageUrl = null;

    // If a new image is uploaded, upload to Supabase
    if (file) {
        const { data: imageUpload, error: uploadError } = await supabase.storage
            .from("images")
            .upload(`product-images/${Date.now()}-${file.originalname}`, file.buffer, {
                contentType: file.mimetype,
            });

        if (uploadError) return res.status(500).json({ message: uploadError.message });

        const { data: { publicUrl } } = supabase.storage
            .from("images")
            .getPublicUrl(imageUpload.path);

        imageUrl = publicUrl;
    }

    // Build fields to update
    const updatePayload = {
        name,
        category,
        description,
        price: Number(price)
    };

    // Only include image_url if player uploaded a new one
    if (imageUrl) updatePayload.image_url = imageUrl;

    const { data, error } = await supabase
        .from(parentTable)
        .update(updatePayload)
        .eq("id", id)
        .select('*')
        .single();

    if (error) return res.status(500).json({ message: error.message });

    return res.json(data);
});


router.patch('/delete', async (req, res) => {
    const { id } = req.query;
    const { data, error } = await supabase
    .from(parentTable)
    .update({ is_deleted: true })
    .eq('id', id)
    .select('*')
    .single();

    if (error) return res.status(500).json({ message: error.message });
    if (!data) return res.status(500).json({ message: `ID ${id} does not exists.` });

    return res.json(data);
})

export default router;