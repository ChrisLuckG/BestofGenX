import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI not found - MongoDB features will be disabled');
}

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sporttock';
const options = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      throw err;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  });
}

export default clientPromise;

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db('sporttock');
}
