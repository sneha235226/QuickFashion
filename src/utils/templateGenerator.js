const XLSX = require('xlsx');

/**
 * Static columns every product must have in a bulk upload file.
 */
const STATIC_HEADERS = [
  'name',
  'price',
  'stock',
  'sku',
  'hsn',
  'gst_rate',
  'weight_kg',
];

/**
 * Build an in-memory Excel workbook (.xlsx) template for bulk upload.
 *
 * Sheet 1 ("Products") — the data entry sheet:
 *   Static columns + one column per category attribute
 *
 * Sheet 2 ("Instructions") — human-readable guidance:
 *   Field-by-field description + allowed values for SELECT attributes
 *
 * @param {object} category - { id, name }
 * @param {Array}  attributes - [{ id, name, type, isRequired, options: [{value}] }]
 * @returns {Buffer} xlsx file buffer
 */
const generateBulkTemplate = (category, attributes) => {
  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: Products ──────────────────────────────────────────────────────

  const attrHeaders = attributes.map((a) => a.name);
  const headers     = [...STATIC_HEADERS, ...attrHeaders];

  // Sample row to guide the seller
  const sampleRow = {
    name:       'Example Product Name',
    price:      '499.00',
    stock:      '100',
    sku:        'SKU001',
    hsn:        '6104',
    gst_rate:   '12',
    weight_kg:  '0.250',
  };
  attributes.forEach((a) => {
    if (a.type === 'SELECT' && a.options.length > 0) {
      sampleRow[a.name] = a.options[0].value;
    } else if (a.type === 'NUMBER') {
      sampleRow[a.name] = '1';
    } else {
      sampleRow[a.name] = 'example';
    }
  });

  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  // ─── Sheet 2: Instructions ──────────────────────────────────────────────────

  const instructions = [
    { field: 'name',       description: 'Product name (required)',          example: 'Blue Kurti M' },
    { field: 'price',      description: 'Selling price in INR (required)',  example: '499.00' },
    { field: 'stock',      description: 'Available quantity (required)',    example: '100' },
    { field: 'sku',        description: 'Your unique SKU code (required)',  example: 'KRT-BLU-M' },
    { field: 'hsn',        description: 'HSN code for GST',                example: '6104' },
    { field: 'gst_rate',   description: 'GST % (e.g. 5, 12, 18)',         example: '12' },
    { field: 'weight_kg',  description: 'Shipping weight in kg',           example: '0.250' },
  ];

  attributes.forEach((a) => {
    const allowed = a.type === 'SELECT'
      ? a.options.map((o) => o.value).join(' | ')
      : a.type === 'NUMBER' ? 'numeric value' : 'any text';

    instructions.push({
      field:       a.name,
      description: `${a.isRequired ? '[REQUIRED] ' : '[OPTIONAL] '}${a.type} attribute`,
      example:     allowed,
    });
  });

  const ws2 = XLSX.utils.json_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  // ─── Sheet 3: Rules ────────────────────────────────────────────────────────

  const rules = [
    { rule: `Category: ${category.name} (ID: ${category.id})` },
    { rule: 'Maximum 9 products per upload.' },
    { rule: 'Delete the sample row before uploading.' },
    { rule: 'Do not rename or remove column headers.' },
    { rule: 'Price must be a positive number.' },
    { rule: 'Stock must be a whole number ≥ 0.' },
    { rule: 'For SELECT fields, only the values listed in Instructions are accepted.' },
  ];
  const ws3 = XLSX.utils.json_to_sheet(rules);
  XLSX.utils.book_append_sheet(wb, ws3, 'Rules');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Parse an uploaded CSV/Excel buffer into an array of row objects.
 * Uses the first sheet. Returns raw parsed rows.
 *
 * @param {Buffer} buffer
 * @returns {object[]}
 */
const parseUploadedFile = (buffer) => {
  const wb      = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws      = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
};

module.exports = { generateBulkTemplate, parseUploadedFile, STATIC_HEADERS };
