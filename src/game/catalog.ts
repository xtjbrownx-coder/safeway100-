export type Shape = "box" | "carton" | "bottle" | "can" | "bag" | "jar" | "tub" | "tray" | "produce";

export type ProductDef = {
  id: string;
  name: string;
  brand: string;
  aisle: string;
  color: string;
  accent: string;
  price: number;
  shape: Shape;
};

export const AISLES = [
  "Produce",
  "Bakery",
  "Dairy",
  "Meat & Deli",
  "Frozen",
  "Pantry",
  "Snacks",
  "Drinks",
  "Household",
  "Health & Beauty",
] as const;

export const CATALOG: ProductDef[] = [
  // Produce
  { id: "apples", name: "Red Apples", brand: "Orchard Lane", aisle: "Produce", color: "#c2202c", accent: "#2e7d32", price: 3.19, shape: "produce" },
  { id: "bananas", name: "Bananas", brand: "Sunbelt", aisle: "Produce", color: "#e9c231", accent: "#5a4a10", price: 1.89, shape: "produce" },
  { id: "tomatoes", name: "Vine Tomatoes", brand: "Orchard Lane", aisle: "Produce", color: "#d3342c", accent: "#2f6b2f", price: 2.89, shape: "produce" },
  { id: "avocado", name: "Hass Avocados", brand: "Verde", aisle: "Produce", color: "#3f5b2a", accent: "#d8e4b8", price: 4.49, shape: "produce" },
  { id: "lettuce", name: "Romaine Hearts", brand: "Verde", aisle: "Produce", color: "#5c9a3a", accent: "#e8f2d8", price: 3.29, shape: "produce" },
  { id: "carrots", name: "Baby Carrots", brand: "Sunbelt", aisle: "Produce", color: "#e07820", accent: "#2f6b2f", price: 2.19, shape: "bag" },
  { id: "berries", name: "Strawberries", brand: "Orchard Lane", aisle: "Produce", color: "#c11f3a", accent: "#f5e3e6", price: 5.49, shape: "tray" },
  { id: "onions", name: "Yellow Onions", brand: "Sunbelt", aisle: "Produce", color: "#cba24d", accent: "#6a4a18", price: 2.79, shape: "bag" },
  { id: "potatoes", name: "Russet Potatoes", brand: "Sunbelt", aisle: "Produce", color: "#a97f4e", accent: "#3d2a13", price: 4.99, shape: "bag" },
  { id: "grapes", name: "Green Grapes", brand: "Orchard Lane", aisle: "Produce", color: "#9fbe4a", accent: "#3b4d16", price: 4.29, shape: "tray" },

  // Bakery
  { id: "bread", name: "Sourdough Loaf", brand: "Stone Hearth", aisle: "Bakery", color: "#d09a54", accent: "#5d3510", price: 4.5, shape: "bag" },
  { id: "bagels", name: "Sesame Bagels", brand: "Stone Hearth", aisle: "Bakery", color: "#dcb377", accent: "#43280b", price: 3.75, shape: "bag" },
  { id: "wheatbread", name: "Whole Wheat Bread", brand: "Field & Grain", aisle: "Bakery", color: "#b4813f", accent: "#f2e6cc", price: 3.99, shape: "bag" },
  { id: "croissants", name: "Butter Croissants", brand: "Petit Four", aisle: "Bakery", color: "#e6b96a", accent: "#5c3a0e", price: 5.29, shape: "tray" },
  { id: "muffins", name: "Blueberry Muffins", brand: "Petit Four", aisle: "Bakery", color: "#4a5aa8", accent: "#f4efe2", price: 4.79, shape: "tray" },
  { id: "tortillas", name: "Flour Tortillas", brand: "Casa Verde", aisle: "Bakery", color: "#e8ddc4", accent: "#a63a20", price: 2.99, shape: "bag" },
  { id: "cake", name: "Chocolate Cake", brand: "Petit Four", aisle: "Bakery", color: "#4b2c19", accent: "#eddcc0", price: 12.99, shape: "box" },

  // Dairy
  { id: "milk", name: "Whole Milk", brand: "Clearfield", aisle: "Dairy", color: "#f2f6fb", accent: "#2f6fd0", price: 3.49, shape: "carton" },
  { id: "oatmilk", name: "Oat Milk", brand: "Grainhouse", aisle: "Dairy", color: "#e6dcc6", accent: "#3f6d3a", price: 4.99, shape: "carton" },
  { id: "eggs", name: "Free-Range Eggs", brand: "Clearfield", aisle: "Dairy", color: "#e6d6b0", accent: "#b8762a", price: 4.29, shape: "box" },
  { id: "butter", name: "Salted Butter", brand: "Clearfield", aisle: "Dairy", color: "#f2dd76", accent: "#7d5f0f", price: 2.99, shape: "box" },
  { id: "yogurt", name: "Greek Yogurt", brand: "Aegea", aisle: "Dairy", color: "#eef2f6", accent: "#4a8f5b", price: 5.19, shape: "tub" },
  { id: "cheddar", name: "Sharp Cheddar", brand: "Hollow Creek", aisle: "Dairy", color: "#e08b1e", accent: "#3a2a10", price: 6.49, shape: "box" },
  { id: "cream", name: "Heavy Cream", brand: "Clearfield", aisle: "Dairy", color: "#f6f2ea", accent: "#c22a3a", price: 3.89, shape: "carton" },
  { id: "sourcream", name: "Sour Cream", brand: "Hollow Creek", aisle: "Dairy", color: "#f2f4f6", accent: "#1f68a8", price: 2.49, shape: "tub" },
  { id: "mozzarella", name: "Shredded Mozzarella", brand: "Hollow Creek", aisle: "Dairy", color: "#f4efe0", accent: "#2f7d4a", price: 4.59, shape: "bag" },

  // Meat & Deli
  { id: "chicken", name: "Chicken Breast", brand: "Prairie Farms", aisle: "Meat & Deli", color: "#e9c6bc", accent: "#a12030", price: 9.99, shape: "tray" },
  { id: "groundbeef", name: "Ground Beef 85/15", brand: "Prairie Farms", aisle: "Meat & Deli", color: "#a8322e", accent: "#f0e8dc", price: 8.49, shape: "tray" },
  { id: "bacon", name: "Thick Cut Bacon", brand: "Smokehouse Co", aisle: "Meat & Deli", color: "#8e2a26", accent: "#f3ddc6", price: 7.99, shape: "tray" },
  { id: "salmon", name: "Atlantic Salmon", brand: "Cold Harbor", aisle: "Meat & Deli", color: "#e37a54", accent: "#20455e", price: 13.49, shape: "tray" },
  { id: "turkeyslices", name: "Sliced Turkey", brand: "Smokehouse Co", aisle: "Meat & Deli", color: "#e4c3ae", accent: "#5b2a2a", price: 6.29, shape: "tray" },
  { id: "sausage", name: "Italian Sausage", brand: "Smokehouse Co", aisle: "Meat & Deli", color: "#b0503c", accent: "#25401f", price: 6.99, shape: "tray" },

  // Frozen
  { id: "pizza", name: "Pepperoni Pizza", brand: "Forno", aisle: "Frozen", color: "#c33427", accent: "#f6e2b8", price: 6.99, shape: "box" },
  { id: "icecream", name: "Vanilla Bean Ice Cream", brand: "North Bay", aisle: "Frozen", color: "#efe6d4", accent: "#3a2b6b", price: 5.99, shape: "tub" },
  { id: "peas", name: "Frozen Peas", brand: "Field & Grain", aisle: "Frozen", color: "#3f8a45", accent: "#eef6e2", price: 2.29, shape: "bag" },
  { id: "fries", name: "Crinkle Fries", brand: "North Bay", aisle: "Frozen", color: "#e0a92c", accent: "#b02a1e", price: 3.99, shape: "bag" },
  { id: "waffles", name: "Toaster Waffles", brand: "Morningside", aisle: "Frozen", color: "#dca24a", accent: "#2f4d8a", price: 3.49, shape: "box" },
  { id: "burrito", name: "Bean Burritos", brand: "Casa Verde", aisle: "Frozen", color: "#8a5a2a", accent: "#e8d8b0", price: 4.49, shape: "box" },

  // Pantry
  { id: "cereal", name: "Honey Oat Cereal", brand: "Morningside", aisle: "Pantry", color: "#eda43c", accent: "#6f3705", price: 4.99, shape: "box" },
  { id: "pasta", name: "Penne Pasta", brand: "Forno", aisle: "Pantry", color: "#efd79c", accent: "#1f5d3a", price: 1.99, shape: "box" },
  { id: "sauce", name: "Tomato Basil Sauce", brand: "Forno", aisle: "Pantry", color: "#b8272a", accent: "#f2e6c8", price: 2.39, shape: "jar" },
  { id: "coffee", name: "Dark Roast Coffee", brand: "Harbor Roasters", aisle: "Pantry", color: "#452a19", accent: "#d3ab6c", price: 8.99, shape: "bag" },
  { id: "rice", name: "Jasmine Rice", brand: "Golden Field", aisle: "Pantry", color: "#ece2ce", accent: "#2b6f8f", price: 6.49, shape: "bag" },
  { id: "beans", name: "Black Beans", brand: "Casa Verde", aisle: "Pantry", color: "#2c2a33", accent: "#e0b23c", price: 1.29, shape: "can" },
  { id: "soup", name: "Chicken Noodle Soup", brand: "Kettle & Co", aisle: "Pantry", color: "#d0342c", accent: "#f2f2f2", price: 2.19, shape: "can" },
  { id: "peanutbutter", name: "Peanut Butter", brand: "Nutway", aisle: "Pantry", color: "#a86a25", accent: "#2a4f8f", price: 4.39, shape: "jar" },
  { id: "honey", name: "Clover Honey", brand: "Golden Field", aisle: "Pantry", color: "#d99a1c", accent: "#4a2f08", price: 6.79, shape: "jar" },
  { id: "oliveoil", name: "Olive Oil", brand: "Aegea", aisle: "Pantry", color: "#4f6b23", accent: "#e8dcb0", price: 10.49, shape: "bottle" },
  { id: "flour", name: "All-Purpose Flour", brand: "Field & Grain", aisle: "Pantry", color: "#f0ead8", accent: "#a02a2a", price: 3.59, shape: "bag" },
  { id: "sugar", name: "Cane Sugar", brand: "Golden Field", aisle: "Pantry", color: "#f4f1ea", accent: "#2f6fd0", price: 3.29, shape: "bag" },
  { id: "oats", name: "Rolled Oats", brand: "Morningside", aisle: "Pantry", color: "#e3d2ac", accent: "#7a4a12", price: 4.19, shape: "tub" },

  // Snacks
  { id: "chips", name: "Sea Salt Chips", brand: "Crestline", aisle: "Snacks", color: "#2f7ec4", accent: "#f2cf3a", price: 3.29, shape: "bag" },
  { id: "tortillachips", name: "Tortilla Chips", brand: "Casa Verde", aisle: "Snacks", color: "#e2a52c", accent: "#8a2318", price: 3.79, shape: "bag" },
  { id: "cookies", name: "Choc Chip Cookies", brand: "Petit Four", aisle: "Snacks", color: "#6f4322", accent: "#efe1c0", price: 3.99, shape: "box" },
  { id: "crackers", name: "Butter Crackers", brand: "Kettle & Co", aisle: "Snacks", color: "#d8a63c", accent: "#a3271f", price: 3.49, shape: "box" },
  { id: "popcorn", name: "Kettle Popcorn", brand: "Crestline", aisle: "Snacks", color: "#efe4cc", accent: "#c22a3a", price: 4.29, shape: "bag" },
  { id: "granola", name: "Granola Bars", brand: "Morningside", aisle: "Snacks", color: "#b98a3c", accent: "#25562f", price: 5.49, shape: "box" },
  { id: "pretzels", name: "Sourdough Pretzels", brand: "Crestline", aisle: "Snacks", color: "#8b5a24", accent: "#f0e2c2", price: 3.19, shape: "bag" },
  { id: "trailmix", name: "Trail Mix", brand: "Nutway", aisle: "Snacks", color: "#7a4b2a", accent: "#e6c05a", price: 6.99, shape: "bag" },
  { id: "chocolate", name: "Dark Chocolate Bar", brand: "Cacao Nord", aisle: "Snacks", color: "#3a2118", accent: "#c9a45a", price: 2.99, shape: "box" },

  // Drinks
  { id: "soda", name: "Cola 6-Pack", brand: "Fizzworks", aisle: "Drinks", color: "#a81e28", accent: "#f2f2f2", price: 5.99, shape: "can" },
  { id: "lemonsoda", name: "Lemon Lime Soda", brand: "Fizzworks", aisle: "Drinks", color: "#3f9a4a", accent: "#f4f1d8", price: 5.49, shape: "can" },
  { id: "water", name: "Spring Water 12pk", brand: "Cold Harbor", aisle: "Drinks", color: "#8bcbe4", accent: "#12506e", price: 4.49, shape: "bottle" },
  { id: "sparkling", name: "Sparkling Water", brand: "Cold Harbor", aisle: "Drinks", color: "#cfe6ef", accent: "#2f7d8f", price: 5.29, shape: "can" },
  { id: "juice", name: "Orange Juice", brand: "Sunbelt", aisle: "Drinks", color: "#e88a1c", accent: "#5c3200", price: 4.79, shape: "carton" },
  { id: "applejuice", name: "Apple Juice", brand: "Orchard Lane", aisle: "Drinks", color: "#cf9c22", accent: "#2f5d2a", price: 3.99, shape: "bottle" },
  { id: "coldbrew", name: "Cold Brew Coffee", brand: "Harbor Roasters", aisle: "Drinks", color: "#2e2119", accent: "#d8b478", price: 6.49, shape: "bottle" },
  { id: "energy", name: "Energy Drink 4pk", brand: "Voltic", aisle: "Drinks", color: "#1e2a3a", accent: "#9be03a", price: 8.99, shape: "can" },
  { id: "tea", name: "Iced Green Tea", brand: "Aegea", aisle: "Drinks", color: "#7aa83a", accent: "#22401a", price: 3.29, shape: "bottle" },

  // Household
  { id: "soap", name: "Dish Soap", brand: "Brightly", aisle: "Household", color: "#2fae87", accent: "#f2faf7", price: 3.59, shape: "bottle" },
  { id: "towels", name: "Paper Towels", brand: "Brightly", aisle: "Household", color: "#f0f2f4", accent: "#5f7f9a", price: 7.29, shape: "bag" },
  { id: "detergent", name: "Laundry Detergent", brand: "Brightly", aisle: "Household", color: "#3a55a8", accent: "#f0be4a", price: 11.49, shape: "bottle" },
  { id: "toiletpaper", name: "Bath Tissue 12pk", brand: "Brightly", aisle: "Household", color: "#e8eef4", accent: "#2f7d8f", price: 12.99, shape: "bag" },
  { id: "trashbags", name: "Trash Bags", brand: "Ironhold", aisle: "Household", color: "#2b2f36", accent: "#e0e4e8", price: 9.49, shape: "box" },
  { id: "foil", name: "Aluminum Foil", brand: "Ironhold", aisle: "Household", color: "#9aa3ab", accent: "#1f3a5a", price: 5.19, shape: "box" },
  { id: "sponges", name: "Scrub Sponges", brand: "Brightly", aisle: "Household", color: "#e0c22a", accent: "#2f6b4a", price: 4.29, shape: "bag" },
  { id: "cleaner", name: "All-Purpose Cleaner", brand: "Brightly", aisle: "Household", color: "#4ab0d8", accent: "#f2f6f8", price: 4.99, shape: "bottle" },
  { id: "candles", name: "Vanilla Candle", brand: "Northlight", aisle: "Household", color: "#e4d6bc", accent: "#6a4a22", price: 8.49, shape: "jar" },

  // Health & Beauty
  { id: "shampoo", name: "Shampoo", brand: "Lumea", aisle: "Health & Beauty", color: "#d8cbe8", accent: "#3a2a6b", price: 7.99, shape: "bottle" },
  { id: "conditioner", name: "Conditioner", brand: "Lumea", aisle: "Health & Beauty", color: "#c8e2ea", accent: "#1f4a5c", price: 7.99, shape: "bottle" },
  { id: "toothpaste", name: "Mint Toothpaste", brand: "Northlight", aisle: "Health & Beauty", color: "#f2f6f8", accent: "#1f68a8", price: 4.49, shape: "box" },
  { id: "bodywash", name: "Body Wash", brand: "Lumea", aisle: "Health & Beauty", color: "#2f6f6b", accent: "#e8f2ef", price: 6.79, shape: "bottle" },
  { id: "lotion", name: "Daily Lotion", brand: "Lumea", aisle: "Health & Beauty", color: "#f0e6dc", accent: "#c07a4a", price: 8.29, shape: "bottle" },
  { id: "vitamins", name: "Multivitamins", brand: "Northlight", aisle: "Health & Beauty", color: "#e88a2a", accent: "#22405c", price: 13.99, shape: "jar" },
  { id: "bandages", name: "Bandages", brand: "Northlight", aisle: "Health & Beauty", color: "#e8d8c0", accent: "#a02a2a", price: 4.99, shape: "box" },
  { id: "deodorant", name: "Deodorant", brand: "Lumea", aisle: "Health & Beauty", color: "#26303a", accent: "#4ab0d8", price: 5.49, shape: "box" },
];

const INDEX = new Map(CATALOG.map((p) => [p.id, p] as const));
export const byId = (id: string) => INDEX.get(id)!;

/** How many of an item a real shopper would grab — matches real-world pack sizes. */
export function realisticQty(p: ProductDef): number {
  const pick = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
  const single = new Set(["cake", "eggs", "toiletpaper", "turkey", "vitamins", "candles", "shampoo", "conditioner", "bodywash", "lotion"]);
  if (single.has(p.id)) return 1;
  switch (p.shape) {
    case "produce":
      return pick(2, 6);
    case "can":
      return pick(2, 4);
    case "tub":
    case "jar":
      return pick(1, 2);
    case "carton":
    case "bottle":
      return pick(1, 2);
    case "tray":
      return pick(1, 2);
    case "bag":
      return pick(1, 2);
    default:
      return pick(1, 2);
  }
}
