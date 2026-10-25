import mongoose from "mongoose";

const muralBookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true
    },
    customerName: {
      type: String,
      required: true
    },
    bookingDate: {
      type: String,
      required: true
    },
    sizeSqFt: {
      type: Number,
      required: true,
      min: 10,
      max: 500
    },
    address: {
      type: String,
      required: true
    },
    pricePerSqFt: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: [
        "requested",
        "confirmed",
        "declined",
        "cancelled"
      ],
      default: "requested"
    }
  },
  {
    timestamps: true
  }
);

// A date can have only one active mural booking.
// Declined and cancelled bookings do not reserve the date.
muralBookingSchema.index(
  { bookingDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ["requested", "confirmed"]
      }
    }
  }
);

const MuralBooking = mongoose.model(
  "MuralBooking",
  muralBookingSchema
);

export default MuralBooking;