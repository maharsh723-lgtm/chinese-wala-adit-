const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const brainDir = `C:\\Users\\mahar\\.gemini\\antigravity\\brain\\35127874-93ba-4d10-acdd-13327dc33035`;

const mappings = [
  { src: 'hakka_noodles_1790748713259.jpg', dest: 'hakka_noodles.jpg' },
  { src: 'dry_manchurian_1790748766099.jpg', dest: 'dry_manchurian.jpg' },
  { src: 'veg_fried_rice_1790748965540.jpg', dest: 'veg_fried_rice.jpg' },
  { src: 'steamed_veg_momos_1790749054500.jpg', dest: 'steamed_veg_momos.jpg' },
  { src: 'peri_peri_fries_1790749095529.jpg', dest: 'peri_peri_fries.jpg' },
  { src: 'cheesy_veg_pizza_1790749132798.jpg', dest: 'cheesy_veg_pizza.jpg' },
  { src: 'aloo_tikki_burger_1790749249674.jpg', dest: 'aloo_tikki_burger.jpg' },
  { src: 'bombay_grilled_sandwich_1790749304366.jpg', dest: 'bombay_grilled_sandwich.jpg' },
  { src: 'supreme_garlic_bread_1790749433640.jpg', dest: 'supreme_garlic_bread.jpg' },
  { src: 'cold_coffee_chai_1790749515600.jpg', dest: 'cold_coffee_chai.jpg' },
  { src: 'gujarati_thali_1790749598428.jpg', dest: 'gujarati_thali.jpg' },
  { src: 'indian_breakfast_items_1790749692955.jpg', dest: 'indian_breakfast_items.jpg' }
];

for (const item of mappings) {
  const srcPath = path.join(brainDir, item.src);
  const destPath = path.join(targetDir, item.dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${item.src} -> ${item.dest}`);
  } else {
    console.error(`Source file missing: ${srcPath}`);
  }
}
