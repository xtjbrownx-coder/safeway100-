export type ProductDef = {
  id: string;
  name: string;
  aisle: string;
  color: string;
  accent: string;
  price: number;
  shape: "box" | "carton" | "bottle" | "can" | "bag";
};

export const CATALOG: ProductDef[] = [
  { id: "milk", name: "Whole Milk", aisle: "Dairy", color: "#f4f7fb", accent: "#2f6fd0", price: 3.49, shape: "carton" },
  { id: "eggs", name: "Free-Range Eggs", aisle: "Dairy", color: "#e8d9b5", accent: "#b8762a", price: 4.29, shape: "box" },
  { id: "butter", name: "Salted Butter", aisle: "Dairy", color: "#f6e27a", accent: "#8a6a12", price: 2.99, shape: "box" },
  { id: "yogurt", name: "Greek Yogurt", aisle: "Dairy", color: "#eef2f6", accent: "#4a8f5b", price: 5.19, shape: "can" },
  { id: "bread", name: "Sourdough Bread", aisle: "Bakery", color: "#d9a15b", accent: "#6b3f14", price: 4.5, shape: "bag" },
  { id: "bagels", name: "Sesame Bagels", aisle: "Bakery", color: "#e0b878", accent: "#4a2d0c", price: 3.75, shape: "bag" },
  { id: "cereal", name: "Honey Cereal", aisle: "Pantry", color: "#f0a63c", accent: "#7a3d05", price: 4.99, shape: "box" },
  { id: "pasta", name: "Penne Pasta", aisle: "Pantry", color: "#f2d9a0", accent: "#1f5d3a", price: 1.99, shape: "box" },
  { id: "sauce", name: "Tomato Sauce", aisle: "Pantry", color: "#c02a24", accent: "#f4e6c8", price: 2.39, shape: "can" },
  { id: "coffee", name: "Dark Roast Coffee", aisle: "Pantry", color: "#4a2c1a", accent: "#d8b072", price: 8.99, shape: "bag" },
  { id: "rice", name: "Jasmine Rice", aisle: "Pantry", color: "#efe6d2", accent: "#2b6f8f", price: 6.49, shape: "bag" },
  { id: "chips", name: "Sea Salt Chips", aisle: "Snacks", color: "#2f7ec4", accent: "#f6d33c", price: 3.29, shape: "bag" },
  { id: "cookies", name: "Choc Chip Cookies", aisle: "Snacks", color: "#7a4a24", accent: "#f0e2c0", price: 3.99, shape: "box" },
  { id: "soda", name: "Cola 6-Pack", aisle: "Drinks", color: "#b3202a", accent: "#f2f2f2", price: 5.99, shape: "can" },
  { id: "water", name: "Spring Water", aisle: "Drinks", color: "#8fd0e8", accent: "#12506e", price: 1.49, shape: "bottle" },
  { id: "juice", name: "Orange Juice", aisle: "Drinks", color: "#f08a1c", accent: "#5c3200", price: 4.79, shape: "carton" },
  { id: "apples", name: "Red Apples", aisle: "Produce", color: "#c8202c", accent: "#2e7d32", price: 3.19, shape: "bag" },
  { id: "bananas", name: "Bananas", aisle: "Produce", color: "#efc73a", accent: "#5a4a10", price: 1.89, shape: "bag" },
  { id: "tomatoes", name: "Vine Tomatoes", aisle: "Produce", color: "#d8342c", accent: "#2f6b2f", price: 2.89, shape: "bag" },
  { id: "soap", name: "Dish Soap", aisle: "Household", color: "#2fae87", accent: "#f4faf7", price: 3.59, shape: "bottle" },
  { id: "towels", name: "Paper Towels", aisle: "Household", color: "#f1f3f5", accent: "#6a7f95", price: 7.29, shape: "box" },
  { id: "detergent", name: "Laundry Detergent", aisle: "Household", color: "#3a55a8", accent: "#f2c14e", price: 11.49, shape: "bottle" },
];

export const byId = (id: string) => CATALOG.find((p) => p.id === id)!;
