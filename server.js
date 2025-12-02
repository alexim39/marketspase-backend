
// server.js (key changes only)
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// --- CORS first ---
app.use(cors({
  origin: [
    'https://marketspase.com',
    'http://marketspase.com',
    'https://www.marketspase.com',
    'https://admin.marketspase.com',
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4202',
  ],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.options('*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  });
  return res.sendStatus(204);
});

// Lightweight health endpoint so the platform can see we're alive
app.get('/health', (req, res) => res.status(200).json({status: 'ok'}));

// ... your routes ...

// Start the HTTP server immediately.
// Binding to 0.0.0.0 ensures it’s reachable in the container networking.
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
  connectToDb();               // kick off DB connection after we are listening
  startScheduledJobsSafely();  // start cron jobs only after DB is ready (see below)
});

async function connectToDb() {
  const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}` +
              `@cluster0.fblwb.mongodb.net/${process.env.MONGODB_DATABASE}` +
              `?retryWrites=true&w=majority&appName=Cluster0`;
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000, // fail fast rather than hanging indefinitely
      socketTimeoutMS: 20000
    });
    console.log('Connected to MongoDB');
    // if jobs depend on DB, you can start them here
    startScheduledJobsSafely(true);
  } catch (err) {
    console.error('MongoDB connection error:', err?.message || err);
    // Keep the HTTP server alive; platform can still serve /health and return 503s
    // Optionally: retry connect with backoff
    setTimeout(connectToDb, 15000);
  }
}

let jobsStarted = false;
function startScheduledJobsSafely(dbReady = false) {
  if (jobsStarted || !dbReady) return;
  jobsStarted = true;
  // Start cron jobs here only once DB is ready
  // PromotionExpirationCheckerCronJobs();
  // ...other jobs...
}
