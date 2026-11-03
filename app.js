require("dotenv").config();

const express = require("express");
const path = require("node:path");
const crypto = require("crypto");

const {
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

} = require("./db/queries");

function verifyAdminPassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || typeof password !== "string") {
    return false;
  }

  const submitted = Buffer.from(password);
  const expected = Buffer.from(adminPassword);

  return (
    submitted.length === expected.length &&
    crypto.timingSafeEqual(submitted, expected)
  );
}

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

app.get("/", async (req, res) => {
  const categories = await getAllCategories();

  res.render("index", { categories });
});

app.get("/categories/new", async (req, res) => {
  res.render("category-form", {
    category: null,
  });
});

app.post("/categories/new", async (req, res) => {
  const { name, description } = req.body;
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return res.status(400).send("Category name is required.");
  }

  try {
    await createCategory({
      name: trimmedName,
      description: description?.trim() || "",
    });
    res.redirect("/");
  } catch (error) {
    console.error("Error creating category:", error);

    if (error.code === "23505") {
      return res.status(409).send("This category already exists.");
    }

    res.status(500).send("Something went wrong while creating the category.");
  }
});

app.get("/categories/:categoryId/edit", async (req, res) => {
  const { categoryId } = req.params;

  try {
    const category = await getCategoryById(categoryId);

    if (!category) {
      return res.status(404).send("Category not found");
    }

    res.render("category-form", { category });
  } catch (error) {
    console.error("Error loading category:", error);
    res.status(500).send("Something went wrong.");
  }
});

app.post("/categories/:categoryId/edit", async (req, res) => {
  const { categoryId } = req.params;
  const { name, description } = req.body;
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return res.status(400).send("Category name is required.");
  }

  try {
    const category = await getCategoryById(categoryId);

    if (!category) {
      return res.status(404).send("Category not found");
    }

    if (!verifyAdminPassword(req.body.adminPassword)) {
      return res.status(401).render("category-form", {
        category: { ...category, name, description },
        errorMessage: "Incorrect admin password. Please try again.",
      });
    }

    const updatedCategory = await updateCategory(categoryId, {
      name: trimmedName,
      description: description?.trim() || "",
    });

    if (!updatedCategory) {
      return res.status(404).send("Category not found");
    }

    res.redirect(`/categories/${categoryId}`);
  } catch (error) {
    console.error("Error updating category:", error);

    if (error.code === "23505") {
      return res.status(409).send("This category name already exists.");
    }

    res.status(500).send("Something went wrong while updating the category.");
  }
});

app.get("/categories/:categoryId/delete", async (req, res) => {
  const { categoryId } = req.params;

  try {
    const category = await getCategoryById(categoryId);

    if (!category) {
      return res.status(404).send("Category not found");
    }

    res.render("delete-category", { category });
  } catch (error) {
    console.error("Error loading category:", error);
    res.status(500).send("Something went wrong.");
  }
});

app.post("/categories/:categoryId/delete", async (req, res) => {
  const { categoryId } = req.params;

  try {
    const { adminPassword } = req.body;

    if (!verifyAdminPassword(adminPassword)) {
      const category = await getCategoryById(categoryId);

      return res.status(401).render("delete-category", {
        category,
        errorMessage: "Incorrect admin password. Please try again.",
      });
    }

    const deletedCategory = await deleteCategory(categoryId);

    if (!deletedCategory) {
      return res.status(404).send("Category not found");
    }

    res.redirect("/");
  } catch (error) {
    console.error("Error deleting category:", error);

    if (error.code === "23001") {
      const category = await getCategoryById(categoryId);

      return res.status(409).render("delete-category", {
        category,
        errorMessage:
          "This category still contains products. Move or delete those products before deleting the category.",
      });
    }

    res.status(500).send("Something went wrong while deleting the category.");
  }
});

app.get("/categories/:categoryId", async (req, res) => {
  const categoryId = req.params.categoryId;

  const sortBy = req.query.sort || "name";
  const stockFilter = req.query.stock || "all";
  let page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const category = await getCategoryById(categoryId);

  if (!category) {
    return res.status(404).send("Category not found.");
  }

  const totalItems = await getCategoryItemCount(
    categoryId,
    stockFilter
  );

  const totalPages = Math.ceil(totalItems / 8);

  if (totalPages > 0 && page > totalPages) {
    page = totalPages;
  }

  const items = await getItemsByCategory(
    categoryId,
    sortBy,
    stockFilter,
    page
  );

  res.render("category", {
    category,
    items,
    sortBy,
    stockFilter,
    page,
    totalPages,
    totalItems
  });
});

app.get("/items/new", async (req, res) => {
  const categories = await getAllCategories();

  res.render("item-form", {
    item: null,
    categories
  });
});

app.post("/items/new", async (req, res) => {
  const {
    name,
    description,
    brand,
    price,
    stock_quantity,
    image_url,
    category_id
  } = req.body;

  async function renderFormError(message) {
    const categories = await getAllCategories();

    return res.status(400).render("item-form", {
      item: req.body,
      categories,
      errorMessage: message,
    });
  }

  const parsedPrice = Number(price);
  const parsedStock = Number(stock_quantity);
  const parsedCategoryId = Number(category_id);

  if (
    !name?.trim() ||
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    !Number.isInteger(parsedStock) ||
    parsedStock < 0 ||
    !Number.isInteger(parsedCategoryId) ||
    parsedCategoryId <= 0
  ) {
    return renderFormError("Invalid product information.");
  }

  try {
    const category = await getCategoryById(parsedCategoryId);

    if (!category) {
      return renderFormError("The selected category does not exist.");
    }

    const newItem = await createItem({
      name: name.trim(),
      description,
      brand,
      price: parsedPrice,
      stock_quantity: parsedStock,
      image_url,
      category_id: parsedCategoryId
    });

    res.redirect(`/items/${newItem.id}`);
  } catch (error) {
    console.error("Error creating product:", error);

    const categories = await getAllCategories();

    res.status(500).render("item-form", {
      item: req.body,
      categories,
      errorMessage: "We couldn't save this product. Please try again.",
    });
  }
});

app.get("/items/search", async (req, res) => {
  const searchTerm = req.query.q || "";

  const items = await searchItems(searchTerm);

  res.render("search-results", {
    items,
    searchTerm
  });
});

app.get("/items/:itemId", async (req, res) => {
  const itemId = req.params.itemId;

  const item = await getItemById(itemId);

  if (!item) {
    return res.status(404).send("Product not found.");
  }

  const category = await getCategoryById(item.category_id);

  res.render("item", {
    item,
    category
  });
});

app.get("/items/:itemId/edit", async (req, res) => {
  const itemId = req.params.itemId;

  const item = await getItemById(itemId);

  if (!item) {
    return res.status(404).render("404");
  }

  const categories = await getAllCategories();

  res.render("item-form", {
    item,
    categories
  });
});

app.post("/items/:itemId/edit", async (req, res) => {
  const itemId = req.params.itemId;

  const {
    name,
    description,
    brand,
    price,
    stock_quantity,
    image_url,
    category_id
  } = req.body;

  async function renderFormError(message) {
    const item = await getItemById(itemId);
    const categories = await getAllCategories();

    return res.status(400).render("item-form", {
      item: { ...item, ...req.body },
      categories,
      errorMessage: message,
    });
  }

  if (!verifyAdminPassword(req.body.adminPassword)) {
    return renderFormError("Incorrect admin password. Please try again.");
  }

  const parsedPrice = Number(price);
  const parsedStock = Number(stock_quantity);
  const parsedCategoryId = Number(category_id);

  if (
    !name?.trim() ||
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    !Number.isInteger(parsedStock) ||
    parsedStock < 0 ||
    !Number.isInteger(parsedCategoryId) ||
    parsedCategoryId <= 0
  ) {
    return renderFormError("Invalid product information.");
  }

  try {
    const category = await getCategoryById(parsedCategoryId);

    if (!category) {
      return renderFormError("The selected category does not exist.");
    }

    const updatedItem = await updateItem(itemId, {
      name: name.trim(),
      description,
      brand,
      price: parsedPrice,
      stock_quantity: parsedStock,
      image_url,
      category_id: parsedCategoryId
    });

    res.redirect(`/items/${updatedItem.id}`);
  } catch (error) {
    console.error("Error updating product:", error);

    const item = await getItemById(itemId);
    const categories = await getAllCategories();

    res.status(500).render("item-form", {
      item: { ...item, ...req.body },
      categories,
      errorMessage: "We couldn't update this product. Please try again.",
    });
  }
});

app.get("/items/:itemId/delete", async (req, res) => {
  const itemId = req.params.itemId;

  const item = await getItemById(itemId);

  if (!item) {
    return res.status(404).send("Product not found.");
  }

  res.render("delete-item", { item });
});

app.post("/items/:itemId/delete", async (req, res) => {
  const itemId = req.params.itemId;

  const { adminPassword } = req.body;

  if (!verifyAdminPassword(adminPassword)) {
    const item = await getItemById(itemId);

    return res.status(401).render("delete-item", {
      item,
      errorMessage: "Incorrect admin password. Please try again.",
    });
  }

  const deletedItem = await deleteItem(itemId);

  if (!deletedItem) {
    return res.status(404).send("Product not found.");
  }

  res.redirect(`/categories/${deletedItem.category_id}`);
});

app.get("/dashboard", async (req, res) => {
  const stats = await getDashboardStats();
  const lowStockItems = await getLowStockItems();
  const recentItems = await getRecentItems();
  const categoryInventory = await getCategoryInventory();

  res.render("dashboard", {
    stats,
    lowStockItems,
    recentItems,
    categoryInventory
  });
});

app.use((req, res) => {
  res.status(404).render("404");
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).render("500");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
