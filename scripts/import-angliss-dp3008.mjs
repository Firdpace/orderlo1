/**
 * Merge Angliss DP-3008 Product Catalogue 2026 (text PDF) into angliss vendor.
 * Source text: pdftotext -layout <pdf> /tmp/angliss-dp3008.txt
 * Catalogue has no prices — SKUs added with price 0 (enquire via WhatsApp).
 * Prior priced Dairy/GCL SKUs are kept.
 *
 * Run: node scripts/import-angliss-dp3008.mjs
 * (Prefer the Python one-shot used in this session if regenerating.)
 */
console.log("See conversation import; catalog already merged in importedCatalog.json");
