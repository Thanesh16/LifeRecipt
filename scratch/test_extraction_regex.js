import fs from 'fs';
import path from 'path';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';

async function testExtractionRegex() {
  const filePath = path.resolve('bird_nest.pdf');
  const { fullText } = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');

  console.log('Testing extraction patterns on bird_nest.pdf...');

  // 1. Order ID pattern
  const orderIdMatch = fullText.match(/Order\s+(?:Id|Number|#)[:\s]*([A-Za-z0-9-_]+)/i);
  console.log('Order ID:', orderIdMatch ? orderIdMatch[1] : null);

  // 2. Invoice No pattern
  const invMatch = fullText.match(/Invoice\s+(?:No|Number|#)[:\s]*([A-Za-z0-9-_]+)/i);
  console.log('Invoice No:', invMatch ? invMatch[1] : null);

  // 3. Sold By / Seller pattern
  const sellerMatch = fullText.match(/Sold\s+By\s*\n\s*([^\n,]+)/i);
  console.log('Sold By:', sellerMatch ? sellerMatch[1].trim() : null);

  // 4. Total Price pattern (prioritize TOTAL PRICE / Total Amount over freight charges)
  const totalPriceMatch = fullText.match(/TOTAL\s+PRICE[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
    || fullText.match(/(?:Grand\s+Total|Total\s+Amount|Net\s+Payable)[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  console.log('Total Price:', totalPriceMatch ? parseFloat(totalPriceMatch[1].replace(/,/g, '')) : null);

  // 5. Product line item pattern
  // E.g. "Avirox HAND-BH-07 Bird House | HAND-BH-07 | IMEI/SrNo:"
  // or after "Product Description Qty Gross Amount..."
  const lineItemMatch = fullText.match(/\b([A-Za-z0-9\s-]{3,50}\s+Bird\s+House|\bboAt\s+[A-Za-z0-9\s-]{3,40}|[A-Za-z0-9\s-]{4,50}\s+(?:Laptop|Headphones|TV|Phone|Speaker|Earbuds|Watch|Camera))/i)
    || fullText.match(/Product\s*\t\s*Description\s*\t[^\n]*\n\s*([^\n\t|]{3,60})/i)
    || fullText.match(/(?:Description\s+of\s+Goods|Product\s+Description)\s*\n\s*([^\n\t(]{3,60})/i);
  console.log('Product Name Match:', lineItemMatch ? lineItemMatch[1].trim() : null);

  // 6. Brand / Model extraction from product line
  const prodLine = "Avirox HAND-BH-07 Bird House | HAND-BH-07 | IMEI/SrNo:";
  const brandMatch = prodLine.match(/^([A-Za-z0-9]+)\s+/);
  const modelMatch = prodLine.match(/\|\s*([A-Za-z0-9-_]+)\s*\|/);
  console.log('Brand from line:', brandMatch ? brandMatch[1] : null);
  console.log('Model from line:', modelMatch ? modelMatch[1] : null);
}

testExtractionRegex().catch(console.error);
