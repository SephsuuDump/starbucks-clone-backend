export function formatCustomer(item) {
    const formattedCustomer = {
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