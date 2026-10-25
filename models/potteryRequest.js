
import mongoose from "mongoose";

const potteryRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true
    },
    customerName: {
      type: String,
      required: true
    },
    itemId: {
      type: String,
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    glazeId: {
      type: String,
      required: true
    },
    glazeName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    neededBy: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "declined", "cancelled"],
      default: "requested"
    }
  },
  { timestamps: true }
);

export default mongoose.model("PotteryRequest", potteryRequestSchema);
