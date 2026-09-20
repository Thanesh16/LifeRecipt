import path from 'path';
import documentIntelligenceService from '../backend/src/services/documentIntelligenceService.js';
import { parseDeterministicReceipt } from '../backend/src/services/aiExtractionService.js';

async function testStructuredFields() {
  const filePath = path.resolve('bird_nest.pdf');
  const { fullText, pages } = await documentIntelligenceService.extractMultiPageText(filePath, 'application/pdf');

  console.log('--- Testing documentIntelligenceService.extractStructuredFields ---');
  const structured = documentIntelligenceService.extractStructuredFields(fullText, 'RECEIPT', pages);
  console.log('Structured Fields:', {
    productName: structured.productName,
    brand: structured.brand,
    model: structured.model,
    purchasePrice: structured.purchasePrice,
    sellerName: structured.sellerName,
    invoiceNumber: structured.invoiceNumber,
    taxInfo: structured.taxInfo,
    currency: structured.currency,
  });

  console.log('\n--- Testing aiExtractionService.parseDeterministicReceipt ---');
  const deterministic = parseDeterministicReceipt(fullText, 'bird_nest.pdf');
  console.log('Deterministic Fields:', {
    productName: deterministic.productName,
    brand: deterministic.brand,
    model: deterministic.model,
    purchasePrice: deterministic.purchasePrice,
    sellerName: deterministic.sellerName,
    invoiceNumber: deterministic.invoiceNumber,
    taxInfo: deterministic.taxInfo,
    currency: deterministic.currency,
  });
}

testStructuredFields().catch(console.error);
