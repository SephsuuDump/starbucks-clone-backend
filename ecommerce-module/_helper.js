export function formatBranchProduct(item) {
    const formattedProduct = {
        id: item.id,
        name: item.products.name,
        price: item.products.price,
        category: item.products.category,
        image_url: item.products.image_url,
        description: item.products.description,
        stock: item.stock,
    }

    return formattedProduct;
}

export function formatBranchProducts(items) {
    const formattedProducts = items.map((item) => ({
        id: item.id,
        name: item.products.name,
        price: item.products.price,
        category: item.products.category,
        image_url: item.products.image_url,
        description: item.products.description,
        stock: item.stock,
    }))

    return formattedProducts;
}

export function formatCustomer(item) {
    const formattedCustomer = {
        id: item.id,
        email: item.email,
        first_name: item.first_name,
        middle_name: item.middle_name,
        last_name: item.last_name,
        phone: item.customers[0].phone ?? null,
        address: item.customers[0].address ?? null,
        city: item.customers[0].city ?? null,
        province: item.customers[0].province ?? null,
        country: item.customers[0].country ?? null,
        zip_code: item.customers[0].zip_code ?? null,
        total_orders: item.customers[0].total_orders ?? null,
        total_spent: item.customers[0].total_spent ?? null,
        is_new_customer: item.customers[0].is_new_customer ?? null,
        created_at: item.customers[0].created_at ?? null,
        updated_at: item.customers[0].updated_at ?? null,
        customers: undefined
    }

    return formattedCustomer;
}

export function formatCustomers(items) {
    const formattedCustomers = items.map((item) => ({
        ...item,
        address: item.customers[0].address,
        city: item.customers[0].city,
        province: item.customers[0].province,
        country: item.customers[0].country,
        zip_code: item.customers[0].zip_code,
        total_orders: item.customers[0].total_orders,
        total_spent: item.customers[0].total_spent,
        is_new_customer: item.customers[0].is_new_customer,
        created_at: item.customers[0].created_at,
        updated_at: item.customers[0].updated_at,
        customers: undefined
    }))

    return formattedCustomers;
}

export function formatSalesOrders(items) {
    return items.map((item) => ({
        id: item.id,
        status: item.status,
        total_amount: item.total_amount,
        payment_mode: item.payment_mode,
        created_at: item.created_at,
        order_items: item.order_items.map((subItem) => ({
            ...formatBranchProduct(subItem.branch_products),
            quantity: subItem.quantity,
            unit_price: subItem.unit_price,
            total_price: subItem.total_price,
        })),
        customer: item._users ? {
            first_name: item._users.first_name,
            last_name: item._users.last_name,
            phone: item._users.customers[0].phone,
            address: item._users.customers[0].address,
            city: item._users.customers[0].city,
            province: item._users.customers[0].province,
            country: item._users.customers[0].country,
        } : null,
        branch: item.branch ? {
            name: item.branch.name
        } : null,
    }))
}
