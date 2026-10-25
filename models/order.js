import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true
    },
    customerName: {
      type: String,
      required: true
    },
    paintingId: {
      type: String,
      required: true
    },
    paintingTitle: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["placed", "cancelled"],
      default: "placed"
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;