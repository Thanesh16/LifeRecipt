import mongoose from 'mongoose';

async function cleanupMock() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lifereceipt');
  
  // 1. Remove mock email connections (thanesh.s@gmail.com and old test ones)
  const connResult = await mongoose.connection.db.collection('emailconnections').deleteMany({
    emailAddress: { $in: ['thanesh.s@gmail.com', 'alice.phase11@gmail.com'] }
  });
  console.log('Removed mock email connections:', connResult.deletedCount);

  // 2. Remove mock email receipt candidates
  const receiptResult = await mongoose.connection.db.collection('emailreceipts').deleteMany({
    providerMessageId: { $in: ['gmail_msg_in_001', 'gmail_msg_in_002', 'outlook_msg_in_001'] }
  });
  console.log('Removed mock email receipts:', receiptResult.deletedCount);

  // Verify counts
  const remainingReceipts = await mongoose.connection.db.collection('emailreceipts').countDocuments();
  const remainingConns = await mongoose.connection.db.collection('emailconnections').countDocuments();
  const totalProducts = await mongoose.connection.db.collection('products').countDocuments();
  const totalDocs = await mongoose.connection.db.collection('documents').countDocuments();

  console.log('Remaining email receipts:', remainingReceipts);
  console.log('Remaining email connections:', remainingConns);
  console.log('Total products preserved:', totalProducts);
  console.log('Total documents preserved:', totalDocs);

  await mongoose.disconnect();
}

cleanupMock().catch(console.error);
