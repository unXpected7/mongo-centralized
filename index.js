const { MongoClient } = require('mongodb');
const dotenv = require("dotenv");
dotenv.config();  // Load environment variables from .env file

const defaultOptions = { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 };  // Default MongoDB client options

let client;  // MongoClient instance
let clientPromise;  // Promise for MongoDB client connection

const MAX_RETRIES = 5;  // Maximum number of retries for connecting to the database
const RETRY_DELAY = 5000;  // Delay (in milliseconds) between retry attempts

// Function to connect to the MongoDB database
async function connectToDatabase(url, options, retries = 0) {

  if (!clientPromise) {  // Check if the clientPromise is not already created
    client = new MongoClient(url, options);  // Create a new MongoClient instance

    try {
      clientPromise = client.connect();  // Initiate the connection
      await clientPromise;  // Wait for the connection to be established 
    } catch (error) {
      console.error('Initial connection failed. Retrying...', error);
      clientPromise = null;  // Reset the promise to allow retry
      if (retries < MAX_RETRIES) {  // Check if the maximum number of retries is not reached
        retries++;
        console.log(`Retry attempt ${retries} in ${RETRY_DELAY / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));  // Wait before retrying
        return connectToDatabase(url, options, retries);  // Recursively retry connection
      } else {
        throw new Error('Failed to connect to database after several attempts.');  // Throw error if retries exhausted
      }
    }
  }
  return clientPromise;  // Return the clientPromise
}

// Function to get a specific database instance
async function getDatabase(url, options, dbName) {
  const client = await connectToDatabase(url, options);  // Ensure connection
  return client.db(dbName);  // Return the database instance
}

// Function to get a specific collection from a database
async function getCollection(url, options, dbName, collectionName) {
  const client = await connectToDatabase(url, options);  // Ensure connection
  const db = client.db(dbName);  // Get the database instance
  console.log('Connected successfully to db server');  // Log connection success
  const collection = db.collection(collectionName);  // Return the collection instance
  if (collection.error) throw collection.error;
  return collection;
}

// Function to initialize the database
async function initializeDatabase(url, options) {
  await connectToDatabase(url, options);
  console.log('Database initialized');
}

// Function to close the database connection
async function closeDatabase() {
  if (client) {
    await client.close(); // Close the database
    client = null;
    clientPromise = null;
    console.log('Database connection closed');
  }
}

// Function to set up graceful shutdown
function setupGracefulShutdown(server) {
  function shutdown() {
    server.close(async () => {
      console.log('Server closed');
      await closeDatabase();
      process.exit(0);
    });
  }

  process.on('SIGTERM', shutdown); // Listen for SIGTERM signal
  process.on('SIGINT', shutdown); // Listen for SIGINT signal
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getCollection,
  setupGracefulShutdown,
};

// Initialize with parameters
module.exports.init = function (urlConnection, maxPoolSize) {
  const options = { ...defaultOptions, maxPoolSize };
  return {
    initializeDatabase: () => initializeDatabase(urlConnection, options),
    getDatabase: (dbName) => getDatabase(urlConnection, options, dbName),
    getCollection: (dbName, collectionName) => getCollection(urlConnection, options, dbName, collectionName),
    setupGracefulShutdown
  };
};
