
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs";
import Painting from "./models/painting.js";

const data = JSON.parse(
  fs.readFileSync("./seedData/seed.json", "utf8")
);

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    for (const item of data.paintings) {
      await Painting.findOneAndUpdate(
        { seedId: item.id },
        {
          seedId: item.id,
          title: item.title,
          artist: item.artist,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          available: item.status === "available"
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    console.log("Paintings imported successfully!");
    console.log("Total paintings:", data.paintings.length);
  } catch (error) {
    console.error("Seed error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase();
