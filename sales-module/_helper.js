export function formatProducts(items) {
    const formattedProducts = items.map((item) => ({
        id: item.id,
        name: item.name ?? 'N/A',
        description: item.description,
        price: item.price,
        category: item.category,
        image_url: item.image_url,
        items_needed: item.product_inventory_item.map((subItem) => ({
            id: subItem.id,
            inventory_item_id: subItem.inventory_item_id ?? 'N/A',
            name: subItem.inventory_item.name ?? 'N/A',
            cost: subItem.inventory_item.cost ?? 0,
            category: subItem.inventory_item.category ?? 'N/A',
            description: subItem.inventory_item.description ?? 'N/A',
            unit_measurement: subItem.inventory_item.unit_measurement ?? 'N/A',
        }))
    }))

    return formattedProducts;
}
