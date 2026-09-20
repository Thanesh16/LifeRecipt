import connectDB from '../backend/src/config/db.js';
import mongoose from 'mongoose';
import Product from '../backend/src/models/Product.js';
import Document from '../backend/src/models/Document.js';

async function run() {
  await connectDB();
  
  const totalBefore = await Product.countDocuments();
  console.log('Total products before:', totalBefore);

  const prodRes = await Product.updateMany({ currency: 'USD' }, { $set: { currency: 'INR' } });
  console.log('Updated products from USD to INR:', prodRes.modifiedCount);

  const docRes = await Document.updateMany({ 'extractedData.currency': 'USD' }, { $set: { 'extractedData.currency': 'INR' } });
  console.log('Updated documents from USD to INR:', docRes.modifiedCount);

  const remainingUSDProd = await Product.countDocuments({ currency: 'USD' });
  const remainingUSDDoc = await Document.countDocuments({ 'extractedData.currency': 'USD' });
  console.log('Remaining USD products:', remainingUSDProd, 'Remaining USD docs:', remainingUSDDoc);

  const totalAfter = await Product.countDocuments();
  console.log('Total products after (zero loss):', totalAfter);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
