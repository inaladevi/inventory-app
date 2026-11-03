const pool = require("./pool");

async function getAllCategories() {
  const { rows } = await pool.query(
    "SELECT * FROM categories ORDER BY name"
  );

  return rows;
}

async function createCategory(category) {
  const { name, description } = category;

  const result = await pool.query(
    `INSERT INTO categories (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name, description]
  );

  return result.rows[0];
}

async function updateCategory(categoryId, category) {
  const { name, description } = category;

  const result = await pool.query(
    `UPDATE categories
     SET name = $1, description = $2
     WHERE id = $3
     RETURNING *`,
    [name, description, categoryId]
  );

  return result.rows[0];
}

async function deleteCategory(categoryId) {
  const result = await pool.query(
    `DELETE FROM categories
     WHERE id = $1
     RETURNING *`,
    [categoryId]
  );

  return result.rows[0];
}

async function getItemsByCategory(
  categoryId,
  sortBy = "name",
  stockFilter = "all",
  page = 1
) {
  const limit = 8;
  const offset = (page - 1) * limit;

  const sortOptions = {
    name: "name ASC",
    price_low: "price ASC",
    price_high: "price DESC",
    stock_low: "stock_quantity ASC"
  };

  const stockConditions = {
    all: "",
    in_stock: "AND stock_quantity > 0",
    low_stock: "AND stock_quantity <= 5",
    out_of_stock: "AND stock_quantity = 0"
  };

  const orderBy = sortOptions[sortBy] || sortOptions.name;
  const stockCondition = stockConditions[stockFilter] ?? "";

  const query = `
    SELECT *
    FROM items
    WHERE category_id = $1
    ${stockCondition}
    ORDER BY ${orderBy}
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await pool.query(query, [
    categoryId,
    limit,
    offset
  ]);

  return rows;
}

async function getCategoryById(categoryId) {
  const { rows } = await pool.query(
    "SELECT * FROM categories WHERE id = $1",
    [categoryId]
  );

  return rows[0];
}

async function getItemById(itemId) {
  const { rows } = await pool.query(
    "SELECT * FROM items WHERE id = $1",
    [itemId]
  );

  return rows[0];
}

async function createItem(item) {
  const query = `
    INSERT INTO items (
      name,
      description,
      brand,
      price,
      stock_quantity,
      image_url,
      category_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    item.name,
    item.description,
    item.brand,
    item.price,
    item.stock_quantity,
    item.image_url,
    item.category_id
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
}

async function updateItem(itemId, item) {
  const query = `
    UPDATE items
    SET
      name = $1,
      description = $2,
      brand = $3,
      price = $4,
      stock_quantity = $5,
      image_url = $6,
      category_id = $7
    WHERE id = $8
    RETURNING *;
  `;

  const values = [
    item.name,
    item.description,
    item.brand,
    item.price,
    item.stock_quantity,
    item.image_url,
    item.category_id,
    itemId
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
}

async function deleteItem(itemId) {
  const { rows } = await pool.query(
    "DELETE FROM items WHERE id = $1 RETURNING *",
    [itemId]
  );

  return rows[0];
}

async function getDashboardStats() {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM items) AS total_products,
      (SELECT COUNT(*) FROM categories) AS total_categories,
      (SELECT COALESCE(SUM(stock_quantity), 0) FROM items) AS total_stock,
      (SELECT COALESCE(SUM(price * stock_quantity), 0) FROM items) AS inventory_value,
      (SELECT COUNT(*) FROM items WHERE stock_quantity <= 5) AS low_stock_count;
  `;

  const { rows } = await pool.query(query);

  return rows[0];
}

async function getLowStockItems() {
  const query = `
    SELECT
      items.id,
      items.name,
      items.brand,
      items.stock_quantity,
      categories.name AS category
    FROM items
    JOIN categories
    ON items.category_id = categories.id
    WHERE items.stock_quantity <= 5
    ORDER BY items.stock_quantity ASC;
  `;

  const { rows } = await pool.query(query);

  return rows;
}

async function searchItems(searchTerm) {
  const query = `
    SELECT *
    FROM items
    WHERE
      name ILIKE $1
      OR brand ILIKE $1
    ORDER BY name;
  `;

  const { rows } = await pool.query(query, [`%${searchTerm}%`]);

  return rows;
}

async function getRecentItems() {
  const query = `
    SELECT
      items.*,
      categories.name AS category_name
    FROM items
    JOIN categories
    ON items.category_id = categories.id
    ORDER BY items.id DESC
    LIMIT 5;
  `;

  const { rows } = await pool.query(query);

  return rows;
}

async function getCategoryInventory() {
  const query = `
    SELECT
      categories.id,
      categories.name,
      COUNT(items.id) AS product_count,
      COALESCE(SUM(items.stock_quantity), 0) AS total_stock,
      COALESCE(SUM(items.price * items.stock_quantity), 0) AS inventory_value
    FROM categories
    LEFT JOIN items
      ON categories.id = items.category_id
    GROUP BY categories.id, categories.name
    ORDER BY categories.name;
  `;

  const { rows } = await pool.query(query);

  return rows;
}

async function getCategoryItemCount(categoryId, stockFilter = "all") {
  const stockConditions = {
    all: "",
    in_stock: "AND stock_quantity > 0",
    low_stock: "AND stock_quantity <= 5",
    out_of_stock: "AND stock_quantity = 0"
  };

  const stockCondition = stockConditions[stockFilter] ?? "";

  const query = `
    SELECT COUNT(*)
    FROM items
    WHERE category_id = $1
    ${stockCondition}
  `;

  const { rows } = await pool.query(query, [categoryId]);

  return Number(rows[0].count);
}



module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getItemsByCategory,
  getCategoryById,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getDashboardStats,
  getLowStockItems,
  searchItems,
  getCategoryItemCount,
  getRecentItems,
  getCategoryInventory
};
