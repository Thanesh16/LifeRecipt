import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lifereceipt');
  const mockReceipts = await mongoose.connection.db.collection('emailreceipts').find({}).toArray();
  const mockIds = mockReceipts.map((r) => r._id);
  const linkedDocs = await mongoose.connection.db.collection('documents').find({ emailReceiptId: { $in: mockIds } }).toArray();
  const linkedProds = await mongoose.connection.db.collection('products').find({ source: 'EMAIL' }).toArray();
  console.log('Total mock receipts:', mockReceipts.length);
  console.log('Linked documents to mock receipts:', linkedDocs.length);
  console.log('Products with source EMAIL:', linkedProds.length);
  await mongoose.disconnect();
}

run().catch(console.error);
