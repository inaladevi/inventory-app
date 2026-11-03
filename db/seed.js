
const pool = require("./pool");

const categories = [
  {
    name: "Laptops",
    description: "Laptops and notebooks"
  },
  {
    name: "Smartphones",
    description: "Mobile phones and smartphones"
  },
  {
    name: "Tablets",
    description: "Tablets and iPads"
  },
  {
    name: "Mobile Accessories",
    description: "Accessories for mobile devices"
  }
];

async function seedCategories() {
  for (const category of categories) {
    const query = `
      INSERT INTO categories (name, description)
      VALUES ($1, $2)
      ON CONFLICT (name)
      DO UPDATE SET description = EXCLUDED.description
      RETURNING *;
    `;

    const values = [category.name, category.description];

    const result = await pool.query(query, values);

    console.log(result.rows[0]);
  }
}

async function seedProducts(apiCategory, dbCategoryName) {
  const response = await fetch(
    `https://dummyjson.com/products/category/${apiCategory}`
  );

  const data = await response.json();

  const categoryResult = await pool.query(
    "SELECT id FROM categories WHERE name = $1",
    [dbCategoryName]
  );

  const categoryId = categoryResult.rows[0].id;

  console.log(`Importing ${dbCategoryName}...`);
  console.log(`Category ID: ${categoryId}`);
  console.log(`Products found: ${data.products.length}`);

  for (const product of data.products) {
  const query = `
    INSERT INTO items (
      external_id,
      name,
      description,
      brand,
      price,
      stock_quantity,
      image_url,
      category_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (external_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      brand = EXCLUDED.brand,
      price = EXCLUDED.price,
      stock_quantity = EXCLUDED.stock_quantity,
      image_url = EXCLUDED.image_url,
      category_id = EXCLUDED.category_id;
  `;

  const values = [
    product.id,
    product.title,
    product.description,
    product.brand,
    product.price,
    product.stock,
    product.thumbnail,
    categoryId
  ];

  await pool.query(query, values);
}

console.log(`${dbCategoryName} imported successfully!`);
}

async function main() {
      await seedCategories();

  await seedProducts("laptops", "Laptops");
  await seedProducts("smartphones", "Smartphones");
  await seedProducts("tablets", "Tablets");
  await seedProducts("mobile-accessories", "Mobile Accessories");
}

main()
  .catch(console.error)
  .finally(() => pool.end());


