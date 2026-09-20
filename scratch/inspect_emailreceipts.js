import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lifereceipt');
  const receipts = await mongoose.connection.db.collection('emailreceipts').find({}).toArray();
  for (const r of receipts) {
    console.log({
      id: r._id,
      status: r.extractionStatus,
      subject: r.subject,
      sender: r.senderEmail,
      linkedProd: r.linkedProductId,
      linkedDoc: r.linkedDocumentId,
    });
  }
  await mongoose.disconnect();
}

run().catch(console.error);
