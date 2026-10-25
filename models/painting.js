
import mongoose from "mongoose";

const paintingSchema = new mongoose.Schema({
  seedId: {
    type: String,
    unique: true,
    sparse: true
  },
  title: {
    type: String,
    required: true
  },
  artist: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  imageUrl: {
    type: String,
    default: ""
  },
  available: {
    type: Boolean,
    default: true
  }
});

const Painting = mongoose.model("Painting", paintingSchema);

export default Painting;
