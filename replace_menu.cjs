const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new DatabaseSync(dbPath);

console.log('Replacing POS Products in database.db with Chinese Wala ADIT Campus Menu & Custom Dish Images...');

const chineseWalaProducts = [
  // --- Noodles ---
  { id: "cw-n-1", name: "Hakka Noodles", category: "Noodles", price: 99.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-n-2", name: "Manchurian Noodles", category: "Noodles", price: 99.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-n-3", name: "Schezwan Noodles", category: "Noodles", price: 99.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-n-4", name: "Singapoori Noodles", category: "Noodles", price: 99.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-n-5", name: "Hong Kong Noodles", category: "Noodles", price: 99.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-n-6", name: "Paneer Fry Noodles", category: "Noodles", price: 109.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 0, isFavorite: 1 },
  { id: "cw-n-7", name: "Hyderabadi Noodles", category: "Noodles", price: 129.00, image: "/images/hakka_noodles.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Rice ---
  { id: "cw-r-1", name: "Veg Fried Rice", category: "Rice", price: 99.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-r-2", name: "Manchurian Rice", category: "Rice", price: 99.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-r-3", name: "Schezwan Rice", category: "Rice", price: 99.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-r-4", name: "Singapore Rice", category: "Rice", price: 99.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-r-5", name: "Hong Kong Fried Rice", category: "Rice", price: 99.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-r-6", name: "Paneer Fried Rice", category: "Rice", price: 109.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 0, isFavorite: 1 },
  { id: "cw-r-7", name: "Hyderabadi Fried Rice", category: "Rice", price: 129.00, image: "/images/veg_fried_rice.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Chinese Starters ---
  { id: "cw-c-1", name: "Dry Manchurian", category: "Chinese Starters", price: 99.00, image: "/images/dry_manchurian.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-c-2", name: "Paneer Chilli", category: "Chinese Starters", price: 139.00, image: "/images/dry_manchurian.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-c-3", name: "Chinese Bhel", category: "Chinese Starters", price: 139.00, image: "/images/dry_manchurian.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-c-4", name: "Bombay Bhel", category: "Chinese Starters", price: 139.00, image: "/images/dry_manchurian.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-c-5", name: "Honey Chilli Potato", category: "Chinese Starters", price: 149.00, image: "/images/dry_manchurian.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },

  // --- French Fries ---
  { id: "cw-ff-1", name: "Salty French Fries", category: "French Fries", price: 99.00, image: "/images/peri_peri_fries.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-ff-2", name: "Pari Pari French Fries", category: "French Fries", price: 109.00, image: "/images/peri_peri_fries.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-ff-3", name: "Cheese French Fries", category: "French Fries", price: 129.00, image: "/images/peri_peri_fries.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Momos ---
  { id: "cw-m-1", name: "Steam Momos", category: "Momos", price: 99.00, image: "/images/steamed_veg_momos.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-m-2", name: "Fry Momos", category: "Momos", price: 109.00, image: "/images/steamed_veg_momos.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-m-3", name: "Cheese Fry Momos", category: "Momos", price: 129.00, image: "/images/steamed_veg_momos.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },

  // --- Cold Drinks ---
  { id: "cw-cd-1", name: "Pepsi", category: "Cold Drinks", price: 15.00, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-cd-2", name: "Mountain Dew", category: "Cold Drinks", price: 15.00, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cd-3", name: "7 Up", category: "Cold Drinks", price: 15.00, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=300&auto=format&fit=crop", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Chai Coffee ---
  { id: "cw-cc-1", name: "Chai", category: "Chai Coffee", price: 10.00, image: "/images/cold_coffee_chai.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-cc-2", name: "Coffee", category: "Chai Coffee", price: 15.00, image: "/images/cold_coffee_chai.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-cc-3", name: "Cold Coffee", category: "Chai Coffee", price: 75.00, image: "/images/cold_coffee_chai.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-cc-4", name: "Cold Bournvita", category: "Chai Coffee", price: 40.00, image: "/images/cold_coffee_chai.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-5", name: "Hot Bournvita", category: "Chai Coffee", price: 45.00, image: "/images/cold_coffee_chai.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-6", name: "Plain Thepla", category: "Chai Coffee", price: 20.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-7", name: "Cheese Thepla", category: "Chai Coffee", price: 30.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-8", name: "Butter Thepla", category: "Chai Coffee", price: 25.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-9", name: "Aloo Paratha", category: "Chai Coffee", price: 25.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-cc-10", name: "Aloo Schezwan Paratha", category: "Chai Coffee", price: 30.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-11", name: "Cheese Aloo Paratha", category: "Chai Coffee", price: 35.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-cc-12", name: "Cheese Sev Thepla", category: "Chai Coffee", price: 35.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Breakfast ---
  { id: "cw-bf-1", name: "Bataka Pauva", category: "Breakfast", price: 20.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-bf-2", name: "Indori Bataka Pauva", category: "Breakfast", price: 30.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-bf-3", name: "Regular Puff", category: "Breakfast", price: 15.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-bf-4", name: "Sev Puff", category: "Breakfast", price: 20.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-5", name: "Punjabi Puff", category: "Breakfast", price: 20.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-6", name: "Punjabi Sev Puff", category: "Breakfast", price: 25.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-7", name: "Punjabi Cheese Puff", category: "Breakfast", price: 30.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-8", name: "Chinese Puff", category: "Breakfast", price: 20.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-9", name: "Chinese Cheese Puff", category: "Breakfast", price: 30.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-10", name: "Schezwan Sev Cheese Puff", category: "Breakfast", price: 35.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-bf-11", name: "Cheese Puff", category: "Breakfast", price: 25.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-12", name: "Paneer Puff", category: "Breakfast", price: 25.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-13", name: "Schezwan Puff", category: "Breakfast", price: 20.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-14", name: "Samosa", category: "Breakfast", price: 17.00, image: "/images/indian_breakfast_items.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-bf-15", name: "Bread Butter", category: "Breakfast", price: 40.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-16", name: "Bread Butter Cheese", category: "Breakfast", price: 60.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-17", name: "Bread Butter Jam", category: "Breakfast", price: 50.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-bf-18", name: "Sev Khamani", category: "Breakfast", price: 25.00, image: "/images/gujarati_thali.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Pizza ---
  { id: "cw-pz-1", name: "Margariba Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-pz-2", name: "Tandoori Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-pz-3", name: "Butter Garlic Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-pz-4", name: "Eggsotic Pizza", category: "Pizza", price: 109.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-pz-5", name: "Paneer Makhani Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-pz-6", name: "Pari Pari Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-pz-7", name: "Hot N Spicy Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-pz-8", name: "Corn Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-pz-9", name: "Country Sp. Pizza", category: "Pizza", price: 159.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-pz-10", name: "Double Cheese Pizza", category: "Pizza", price: 199.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-pz-11", name: "Mexican Pizza", category: "Pizza", price: 99.00, image: "/images/cheesy_veg_pizza.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Burger ---
  { id: "cw-bg-1", name: "Aloo Tikki Burger", category: "Burger", price: 80.00, image: "/images/aloo_tikki_burger.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-bg-2", name: "Mexican Burger", category: "Burger", price: 80.00, image: "/images/aloo_tikki_burger.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },

  // --- Sandwich ---
  { id: "cw-sw-1", name: "Veg. Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-sw-2", name: "Bombay Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-sw-3", name: "Tandoori Paneer Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-sw-4", name: "Cheese Corn Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-sw-5", name: "Cheese Crunchy Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-sw-6", name: "Hot N Spicy Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-sw-7", name: "Cheese Chilli Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-sw-8", name: "Pizza Sandwich", category: "Sandwich", price: 120.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },
  { id: "cw-sw-9", name: "Mexican Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-sw-10", name: "Veg. Cheese Sandwich", category: "Sandwich", price: 99.00, image: "/images/bombay_grilled_sandwich.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },

  // --- Garlic Bread ---
  { id: "cw-gb-1", name: "Plain Garlic Bread", category: "Garlic Bread", price: 99.00, image: "/images/supreme_garlic_bread.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-gb-2", name: "Cheese Garlic Bread", category: "Garlic Bread", price: 119.00, image: "/images/supreme_garlic_bread.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-gb-3", name: "Cheese Chilli Garlic Bread", category: "Garlic Bread", price: 129.00, image: "/images/supreme_garlic_bread.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-gb-4", name: "Supreme Garlic Bread", category: "Garlic Bread", price: 150.00, image: "/images/supreme_garlic_bread.jpg", isVeg: 1, isPopular: 1, isFavorite: 0 },

  // --- Fix Gujarati Thali ---
  { id: "cw-gt-1", name: "Fix Gujarati Thali", category: "Gujarati Thali", price: 80.00, image: "/images/gujarati_thali.jpg", isVeg: 1, isPopular: 1, isFavorite: 1 },
  { id: "cw-gt-2", name: "Extra Roti", category: "Gujarati Thali", price: 9.00, image: "/images/gujarati_thali.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 },
  { id: "cw-gt-3", name: "Extra Subji", category: "Gujarati Thali", price: 20.00, image: "/images/gujarati_thali.jpg", isVeg: 1, isPopular: 0, isFavorite: 0 }
];

db.exec("DELETE FROM pos_products;");

const insertStmt = db.prepare(`
  INSERT INTO pos_products (id, name, category, price, image, isVeg, isPopular, isFavorite, stock, ingredients)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100, ?)
`);

for (const p of chineseWalaProducts) {
  const ingredients = JSON.stringify([{ name: 'Ingredients', qty: 1, unit: 'portion', cost: Math.round(p.price * 0.3) }]);
  insertStmt.run(p.id, p.name, p.category, p.price, p.image, p.isVeg, p.isPopular, p.isFavorite, ingredients);
}

console.log(`Successfully populated pos_products with ${chineseWalaProducts.length} items with updated images.`);
