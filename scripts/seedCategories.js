/**
 * Run: node scripts/seedCategories.js
 *
 * Creates 10 parent categories + their leaf subcategories directly via Prisma.
 * No token needed — run this once from the terminal.
 */

require('../src/config/env');
require('dotenv').config();

const prisma = require('../src/config/database');

const TREE = [
  {
    name: "Women's Clothing",
    slug: 'womens-clothing',
    children: [
      { name: 'Kurtas & Suits',    slug: 'kurtas-suits' },
      { name: 'Sarees',            slug: 'sarees' },
      { name: 'Lehengas',          slug: 'lehengas' },
      { name: 'Tops & T-Shirts',   slug: 'womens-tops-tshirts' },
      { name: 'Dresses & Skirts',  slug: 'dresses-skirts' },
    ],
  },
  {
    name: "Men's Clothing",
    slug: 'mens-clothing',
    children: [
      { name: 'Casual Shirts',     slug: 'mens-casual-shirts' },
      { name: 'Formal Shirts',     slug: 'mens-formal-shirts' },
      { name: "Men's T-Shirts",    slug: 'mens-tshirts' },
      { name: 'Trousers & Jeans',  slug: 'mens-trousers-jeans' },
      { name: 'Ethnic Wear',       slug: 'mens-ethnic-wear' },
    ],
  },
  {
    name: "Kids' Clothing",
    slug: 'kids-clothing',
    children: [
      { name: 'Boys Clothing',        slug: 'boys-clothing' },
      { name: 'Girls Clothing',       slug: 'girls-clothing' },
      { name: 'Infants & Toddlers',   slug: 'infants-toddlers' },
    ],
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    children: [
      { name: "Women's Footwear", slug: 'womens-footwear' },
      { name: "Men's Footwear",   slug: 'mens-footwear' },
      { name: "Kids' Footwear",   slug: 'kids-footwear' },
    ],
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    children: [
      { name: 'Jewellery',             slug: 'jewellery' },
      { name: 'Handbags & Clutches',   slug: 'handbags-clutches' },
      { name: 'Sunglasses',            slug: 'sunglasses' },
      { name: 'Watches',               slug: 'watches' },
      { name: 'Belts & Wallets',       slug: 'belts-wallets' },
    ],
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    children: [
      { name: 'Bedding & Pillows',  slug: 'bedding-pillows' },
      { name: 'Kitchen & Dining',   slug: 'kitchen-dining' },
      { name: 'Home Decor',         slug: 'home-decor' },
      { name: 'Bath & Towels',      slug: 'bath-towels' },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    children: [
      { name: 'Skincare',   slug: 'skincare' },
      { name: 'Haircare',   slug: 'haircare' },
      { name: 'Makeup',     slug: 'makeup' },
      { name: 'Fragrances', slug: 'fragrances' },
    ],
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    children: [
      { name: 'Mobile Accessories',     slug: 'mobile-accessories' },
      { name: 'Earphones & Headphones', slug: 'earphones-headphones' },
      { name: 'Laptop Accessories',     slug: 'laptop-accessories' },
      { name: 'Smartwatches & Bands',   slug: 'smartwatches-bands' },
    ],
  },
  {
    name: 'Sports & Fitness',
    slug: 'sports-fitness',
    children: [
      { name: 'Gym & Fitness Equipment', slug: 'gym-fitness' },
      { name: 'Sports Clothing',         slug: 'sports-clothing' },
      { name: 'Outdoor & Adventure',     slug: 'outdoor-adventure' },
      { name: 'Yoga & Meditation',       slug: 'yoga-meditation' },
    ],
  },
  {
    name: 'Bags & Luggage',
    slug: 'bags-luggage',
    children: [
      { name: 'Backpacks',    slug: 'backpacks' },
      { name: 'Travel Bags',  slug: 'travel-bags' },
      { name: 'Laptop Bags',  slug: 'laptop-bags' },
      { name: 'Gym Bags',     slug: 'gym-bags' },
    ],
  },
];

async function seed() {
  let parentCount = 0;
  let childCount  = 0;

  for (const { name, slug, children } of TREE) {
    // Create parent (not a leaf — cannot hold products directly)
    const parent = await prisma.category.create({
      data: { name, slug, isLeaf: false },
    });
    parentCount++;
    console.log(`  [parent] ${parent.name} (id: ${parent.id})`);

    // Create leaf children
    for (const child of children) {
      const leaf = await prisma.category.create({
        data: { name: child.name, slug: child.slug, parentId: parent.id, isLeaf: true },
      });
      childCount++;
      console.log(`      [leaf] ${leaf.name} (id: ${leaf.id})`);
    }
  }

  console.log(`\nDone! ${parentCount} parent categories + ${childCount} leaf categories created.`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
