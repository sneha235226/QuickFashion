const prisma = require('../src/config/database');

const categories = [
  {
    name: 'Women',
    slug: 'women',
    children: [
      {
        name: 'Ethnic Wear',
        slug: 'women-ethnic-wear',
        children: [
          {
            name: 'Sarees',
            slug: 'women-ethnic-sarees',
            children: [
              { name: 'Silk Sarees', slug: 'women-ethnic-sarees-silk' },
              { name: 'Cotton Sarees', slug: 'women-ethnic-sarees-cotton' },
              { name: 'Georgette Sarees', slug: 'women-ethnic-sarees-georgette' }
            ]
          },
          {
            name: 'Kurtas & Suits',
            slug: 'women-ethnic-kurtas',
            children: [
              { name: 'Anarkali Suits', slug: 'women-ethnic-kurtas-anarkali' },
              { name: 'Straight Kurtas', slug: 'women-ethnic-kurtas-straight' }
            ]
          }
        ]
      },
      {
        name: 'Western Wear',
        slug: 'women-western-wear',
        children: [
          {
            name: 'Tops & Tees',
            slug: 'women-western-tops',
            children: [
              { name: 'Casual Tops', slug: 'women-western-tops-casual' },
              { name: 'T-Shirts', slug: 'women-western-tops-tees' }
            ]
          },
          {
            name: 'Dresses',
            slug: 'women-western-dresses',
            children: [
              { name: 'Maxi Dresses', slug: 'women-western-dresses-maxi' },
              { name: 'Mini Dresses', slug: 'women-western-dresses-mini' }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'Men',
    slug: 'men',
    children: [
      {
        name: 'Topwear',
        slug: 'men-topwear',
        children: [
          {
            name: 'Shirts',
            slug: 'men-topwear-shirts',
            children: [
              { name: 'Casual Shirts', slug: 'men-topwear-shirts-casual' },
              { name: 'Formal Shirts', slug: 'men-topwear-shirts-formal' }
            ]
          },
          {
            name: 'T-Shirts',
            slug: 'men-topwear-tshirts',
            children: [
              { name: 'Polo T-Shirts', slug: 'men-topwear-tshirts-polo' },
              { name: 'Round Neck T-Shirts', slug: 'men-topwear-tshirts-round' }
            ]
          }
        ]
      },
      {
        name: 'Bottomwear',
        slug: 'men-bottomwear',
        children: [
          {
            name: 'Jeans',
            slug: 'men-bottomwear-jeans',
            children: [
              { name: 'Slim Fit Jeans', slug: 'men-bottomwear-jeans-slim' },
              { name: 'Regular Fit Jeans', slug: 'men-bottomwear-jeans-regular' }
            ]
          },
          {
            name: 'Trousers',
            slug: 'men-bottomwear-trousers',
            children: [
              { name: 'Chinos', slug: 'men-bottomwear-trousers-chinos' },
              { name: 'Formal Trousers', slug: 'men-bottomwear-trousers-formal' }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'Kids',
    slug: 'kids',
    children: [
      {
        name: 'Boys Clothing',
        slug: 'kids-boys',
        children: [
          {
            name: 'T-Shirts',
            slug: 'kids-boys-tshirts',
            children: [
              { name: 'Graphic T-Shirts', slug: 'kids-boys-tshirts-graphic' },
              { name: 'Striped T-Shirts', slug: 'kids-boys-tshirts-striped' }
            ]
          }
        ]
      },
      {
        name: 'Girls Clothing',
        slug: 'kids-girls',
        children: [
          {
            name: 'Dresses',
            slug: 'kids-girls-dresses',
            children: [
              { name: 'Party Dresses', slug: 'kids-girls-dresses-party' },
              { name: 'Casual Dresses', slug: 'kids-girls-dresses-casual' }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    children: [
      {
        name: 'Home Decor',
        slug: 'home-decor',
        children: [
          {
            name: 'Wall Decor',
            slug: 'home-decor-wall',
            children: [
              { name: 'Paintings', slug: 'home-decor-wall-paintings' },
              { name: 'Wall Shelves', slug: 'home-decor-wall-shelves' }
            ]
          }
        ]
      },
      {
        name: 'Furnishing',
        slug: 'home-furnishing',
        children: [
          {
            name: 'Bed Linen',
            slug: 'home-furnishing-bed',
            children: [
              { name: 'Bedsheets', slug: 'home-furnishing-bed-sheets' },
              { name: 'Blankets', slug: 'home-furnishing-bed-blankets' }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    children: [
      {
        name: 'Makeup',
        slug: 'beauty-makeup',
        children: [
          {
            name: 'Face',
            slug: 'beauty-makeup-face',
            children: [
              { name: 'Foundation', slug: 'beauty-makeup-face-foundation' },
              { name: 'Compact', slug: 'beauty-makeup-face-compact' }
            ]
          },
          {
            name: 'Lips',
            slug: 'beauty-makeup-lips',
            children: [
              { name: 'Lipstick', slug: 'beauty-makeup-lips-lipstick' },
              { name: 'Lip Gloss', slug: 'beauty-makeup-lips-gloss' }
            ]
          }
        ]
      }
    ]
  }
];

async function seed(categoryList, parentId = null, level = 1) {
  for (const cat of categoryList) {
    const isLeaf = !cat.children || cat.children.length === 0;

    // Check if category exists
    let category = await prisma.category.findUnique({
      where: { slug: cat.slug }
    });

    if (category) {
      // Update existing
      category = await prisma.category.update({
        where: { id: category.id },
        data: {
          name: cat.name,
          parentId: parentId,
          level: level,
          isLeaf: isLeaf
        }
      });
      console.log(`Updated: ${'  '.repeat(level - 1)}${cat.name} (L${level})`);
    } else {
      // Create new
      category = await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          parentId: parentId,
          level: level,
          isLeaf: isLeaf
        }
      });
      console.log(`Created: ${'  '.repeat(level - 1)}${cat.name} (L${level})`);
    }

    if (cat.children && cat.children.length > 0) {
      await seed(cat.children, category.id, level + 1);
    }
  }
}

async function main() {
  try {
    console.log('Starting category seeding...');
    await seed(categories);
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
