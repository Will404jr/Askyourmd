import mongoose from "mongoose";

const MONGODB_URI = "mongodb://localhost:27017/askyourmd";
// const MONGODB_URI =
//   "mongodb+srv://Junior:test01@cluster0.46lb860.mongodb.net/Askyourmd?retryWrites=true&w=majority";

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// Define the type for the cached connection
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Declare the type for the global mongoose property
declare global {
  var mongoose: MongooseCache | undefined;
}

// Initialize the cached variable with proper typing
let cached: MongooseCache = global.mongoose || {
  conn: null,
  promise: null,
};

// If global mongoose is undefined, initialize it
if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    // console.log("✅ Using existing MongoDB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    console.log("⏳ Connecting to MongoDB...");

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log("✅ Successfully connected to MongoDB");

        // Add connection event listeners
        mongoose.connection.on("connected", () => {
          console.log("🟢 MongoDB connected");
        });

        mongoose.connection.on("error", (err) => {
          console.log("🔴 MongoDB connection error:", err);
        });

        mongoose.connection.on("disconnected", () => {
          console.log("🔴 MongoDB disconnected");
        });

        return mongoose;
      })
      .catch((error) => {
        console.log("❌ MongoDB connection failed:", error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    console.log("❌ MongoDB connection error:", e);
    throw e;
  }
}

export default dbConnect;
