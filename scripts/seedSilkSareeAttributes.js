const prisma = require('../src/config/database');

const CATEGORY_ID = 57; // Silk Sarees ID

const attributeGroups = [
    { name: 'Product Inventory', type: 'PRODUCT_INVENTORY' },
    { name: 'Product Details', type: 'PRODUCT_DETAILS' },
    { name: 'Other Attributes', type: 'OTHER_ATTRIBUTES' }
];

const attributes = [
    // Product Inventory
    {
        group: 'Product Inventory',
        name: 'GST',
        type: 'SELECT',
        isRequired: true,
        options: ['0%', '5%', '12%', '18%', '28%']
    },
    {
        group: 'Product Inventory',
        name: 'HSN Code',
        type: 'TEXT',
        isRequired: true
    },
    {
        group: 'Product Inventory',
        name: 'Net Weight (gms)',
        type: 'NUMBER',
        isRequired: true
    },
    // Product Details
    {
        group: 'Product Details',
        name: 'Saree Color',
        type: 'SELECT',
        isRequired: true,
        options: ['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Black', 'White', 'Gold', 'Silver', 'Purple', 'Orange', 'Maroon']
    },
    {
        group: 'Product Details',
        name: 'Saree Fabric',
        type: 'SELECT',
        isRequired: true,
        options: ['Banarasi Silk', 'Kanjeevaram Silk', 'Art Silk', 'Mysore Silk', 'Chanderi Silk', 'Bhagalpuri Silk', 'Tussar Silk']
    },
    {
        group: 'Product Details',
        name: 'Blouse Fabric',
        type: 'SELECT',
        isRequired: true,
        options: ['Silk', 'Cotton Silk', 'Satin', 'Brocade', 'Art Silk']
    },
    {
        group: 'Product Details',
        name: 'Occasion',
        type: 'SELECT',
        isRequired: true,
        options: ['Wedding', 'Party Wear', 'Festive', 'Formal', 'Casual Wear']
    },
    {
        group: 'Product Details',
        name: 'Print or Pattern Type',
        type: 'SELECT',
        isRequired: true,
        options: ['Zari Woven', 'Embroidered', 'Printed', 'Solid', 'Checkered', 'Striped']
    },
    {
        group: 'Product Details',
        name: 'Border',
        type: 'SELECT',
        isRequired: true,
        options: ['Heavy Zari Border', 'Small Border', 'No Border', 'Contrast Border', 'Temple Border']
    },
    {
        group: 'Product Details',
        name: 'Manufacturer Name',
        type: 'TEXT',
        isRequired: true
    },
    {
        group: 'Product Details',
        name: 'Manufacturer Address',
        type: 'TEXT',
        isRequired: true
    },
    // Other Attributes
    {
        group: 'Other Attributes',
        name: 'Brand',
        type: 'SELECT',
        isRequired: false,
        options: ['QuickFashion', 'EthnicVogue', 'SareeSansar', 'SilkHeritage']
    },
    {
        group: 'Other Attributes',
        name: 'Pattern',
        type: 'SELECT',
        isRequired: false,
        options: ['Floral', 'Paisley', 'Abstract', 'Geometric', 'Traditional Motifs']
    },
    {
        group: 'Other Attributes',
        name: 'Description',
        type: 'TEXT',
        isRequired: true
    }
];

async function main() {
    try {
        console.log(`Seeding attributes for Category ID: ${CATEGORY_ID}`);

        // 1. Create Groups
        for (const group of attributeGroups) {
            const g = await prisma.categoryAttributeGroup.upsert({
                where: { id: -1 }, // Just to use upsert, but we'll use findFirst instead or just create
                update: {},
                create: {
                    categoryId: CATEGORY_ID,
                    name: group.name
                }
            });
            // Better way: find by name and categoryId
            let existingGroup = await prisma.categoryAttributeGroup.findFirst({
                where: { categoryId: CATEGORY_ID, name: group.name }
            });
            if (!existingGroup) {
                existingGroup = await prisma.categoryAttributeGroup.create({
                    data: { categoryId: CATEGORY_ID, name: group.name }
                });
            }
            group.id = existingGroup.id;
        }

        // 2. Create Attributes
        for (const attr of attributes) {
            const group = attributeGroups.find(g => g.name === attr.group);

            let existingAttr = await prisma.categoryAttribute.findFirst({
                where: { categoryId: CATEGORY_ID, name: attr.name }
            });

            if (!existingAttr) {
                existingAttr = await prisma.categoryAttribute.create({
                    data: {
                        categoryId: CATEGORY_ID,
                        groupId: group.id,
                        name: attr.name,
                        type: attr.type,
                        isRequired: attr.isRequired,
                        groupType: group.type,
                        isVariant: attr.name === 'Saree Color' // Saree Color could be a variant
                    }
                });
                console.log(`Created Attribute: ${attr.name}`);
            } else {
                console.log(`Attribute already exists: ${attr.name}`);
            }

            // 3. Create Options
            if (attr.options && attr.options.length > 0) {
                for (const option of attr.options) {
                    const existingOption = await prisma.attributeOption.findFirst({
                        where: { attributeId: existingAttr.id, value: option }
                    });
                    if (!existingOption) {
                        await prisma.attributeOption.create({
                            data: {
                                attributeId: existingAttr.id,
                                value: option
                            }
                        });
                    }
                }
                console.log(`Seeded ${attr.options.length} options for ${attr.name}`);
            }
        }

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Error during seeding:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
