import mongoose from 'mongoose';

async function searchDb() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lifereceipt');
  const cols = await mongoose.connection.db.collections();
  console.log('--- Collections in lifereceipt ---');
  for (const col of cols) {
    const total = await col.countDocuments();
    console.log(`${col.collectionName}: ${total}`);
  }

  console.log('\n--- Checking EmailReceipt candidates ---');
  const emailReceiptsCol = mongoose.connection.db.collection('emailreceipts');
  if (emailReceiptsCol) {
    const docs = await emailReceiptsCol.find({}).toArray();
    console.log(`Found ${docs.length} emailreceipt records`);
    for (const d of docs) {
      console.log(`- ID: ${d._id}, Subject: "${d.subject}", Sender: "${d.sender}", Product: "${d.extractedData?.productName}", Attachments: ${d.attachments?.length}`);
    }
  }

  console.log('\n--- Checking EmailAccount connections ---');
  const emailAccountsCol = mongoose.connection.db.collection('emailaccounts');
  if (emailAccountsCol) {
    const accs = await emailAccountsCol.find({}).toArray();
    console.log(`Found ${accs.length} emailaccount records`);
    for (const a of accs) {
      console.log(`- ID: ${a._id}, Provider: ${a.provider}, Email: ${a.emailAddress || a.email}, Status: ${a.status}, User: ${a.userId}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

searchDb().catch(console.error);
