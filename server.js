
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import User from "./models/user.js";
import Painting from "./models/painting.js";
import Order from "./models/order.js";
import MuralBooking from "./models/muralBooking.js";
import potteryRouter from "./pottery-routes.js";

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seedData = JSON.parse(
  readFileSync(
    path.join(__dirname, "seedData", "seed.json"),
    "utf8"
  )
);

const muralRate = Number(seedData.mural?.ratePerSqFt);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/pottery", potteryRouter);

// --------------------------------------------------
// AUTHENTICATION AND ROLE CHECKS
// --------------------------------------------------

function checkLogin(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Please log in again."
    });
  }
}

function checkAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only the studio admin can do this."
    });
  }

  next();
}

function checkCustomer(req, res, next) {
  if (req.user.role !== "customer") {
    return res.status(403).json({
      message: "Only customers can do this."
    });
  }

  next();
}

function validPaintingInput(body) {
  const title = String(body.title || "").trim();
  const artist = String(body.artist || "").trim();
  const price = Number(body.price);
  const imageUrl = String(body.imageUrl || "").trim();
  const description = String(body.description || "").trim();

  if (
    !title ||
    !artist ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return {
      error: "Enter a title, artist and positive price."
    };
  }

  return {
    title,
    artist,
    price,
    imageUrl,
    description
  };
}

// --------------------------------------------------
// ACCOUNT REGISTRATION
// --------------------------------------------------

app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (
      name.length < 2 ||
      !email.includes("@") ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          "Enter a name, valid email and password with at least 8 characters."
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({
        message: "That email is already registered."
      });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "customer"
    });

    const token = jwt.sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.status(201).json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "That email is already registered."
      });
    }

    res.status(500).json({
      message: "Could not register. Please try again."
    });
  }
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email });

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: "Email or password is incorrect."
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch {
    res.status(500).json({
      message: "Could not log in."
    });
  }
});

// --------------------------------------------------
// PUBLIC CONFIGURATION
// --------------------------------------------------

app.get("/api/config", (req, res) => {
  res.json({
    muralRatePerSqFt: muralRate
  });
});

// --------------------------------------------------
// PAINTINGS
// --------------------------------------------------

app.get("/api/paintings", async (req, res) => {
  try {
    const paintings = await Painting.find().sort({
      _id: -1
    });

    res.json(paintings);
  } catch {
    res.status(500).json({
      message: "Could not load paintings."
    });
  }
});

// Admin adds a painting.
app.post(
  "/api/paintings",
  checkLogin,
  checkAdmin,
  async (req, res) => {
    try {
      const input = validPaintingInput(req.body);

      if (input.error) {
        return res.status(400).json({
          message: input.error
        });
      }

      const painting = await Painting.create({
        ...input,
        available: true
      });

      res.status(201).json(painting);
    } catch {
      res.status(500).json({
        message: "Could not add painting."
      });
    }
  }
);

// Admin edits an available painting.
app.put(
  "/api/paintings/:id",
  checkLogin,
  checkAdmin,
  async (req, res) => {
    try {
      const input = validPaintingInput(req.body);

      if (input.error) {
        return res.status(400).json({
          message: input.error
        });
      }

      const painting = await Painting.findOneAndUpdate(
        {
          _id: req.params.id,
          available: true
        },
        input,
        {
          new: true,
          runValidators: true
        }
      );

      if (!painting) {
        const exists = await Painting.exists({
          _id: req.params.id
        });

        return exists
          ? res.status(409).json({
              message: "Sold paintings cannot be edited."
            })
          : res.status(404).json({
              message: "Painting not found."
            });
      }

      res.json({
        message: "Painting updated successfully.",
        painting
      });
    } catch {
      res.status(400).json({
        message: "Could not update painting."
      });
    }
  }
);

// --------------------------------------------------
// PURCHASE PAINTING
// --------------------------------------------------

app.post(
  "/api/buy",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    let painting;

    try {
      painting = await Painting.findOneAndUpdate(
        {
          _id: req.body.paintingId,
          available: true
        },
        {
          available: false
        },
        {
          new: true
        }
      );

      if (!painting) {
        return res.status(409).json({
          message: "This painting has already been sold."
        });
      }

      const order = await Order.create({
        customerId: req.user.id,
        customerName: req.user.name,
        paintingId: painting._id.toString(),
        paintingTitle: painting.title,
        price: painting.price,
        status: "placed"
      });

      res.status(201).json({
        message: "Painting purchased successfully.",
        order
      });
    } catch {
      if (painting) {
        await Painting.updateOne(
          {
            _id: painting._id,
            available: false
          },
          {
            available: true
          }
        );
      }

      res.status(500).json({
        message: "Order failed. Please try again."
      });
    }
  }
);

// --------------------------------------------------
// ORDERS
// --------------------------------------------------

app.get("/api/orders", checkLogin, async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { customerId: req.user.id };

    const orders = await Order.find(filter).sort({
      createdAt: -1
    });

    res.json(orders);
  } catch {
    res.status(500).json({
      message: "Could not load orders."
    });
  }
});

// Customers cancel their own placed orders.
// The painting becomes available again.
app.post(
  "/api/orders/:id/cancel",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          customerId: req.user.id,
          status: "placed"
        },
        {
          status: "cancelled"
        },
        {
          new: true
        }
      );

      if (!order) {
        const exists = await Order.exists({
          _id: req.params.id,
          customerId: req.user.id
        });

        if (!exists) {
          return res.status(404).json({
            message: "Order not found."
          });
        }

        return res.status(400).json({
          message: "Only placed orders can be cancelled."
        });
      }

      await Painting.updateOne(
        { _id: order.paintingId },
        { available: true }
      );

      res.json({
        message:
          "Order cancelled. The painting is available again."
      });
    } catch {
      res.status(400).json({
        message: "Could not cancel this order."
      });
    }
  }
);

// --------------------------------------------------
// WALL PAINTING BOOKINGS
// --------------------------------------------------

app.get(
  "/api/mural-bookings",
  checkLogin,
  async (req, res) => {
    try {
      const filter =
        req.user.role === "admin"
          ? {}
          : { customerId: req.user.id };

      const bookings = await MuralBooking.find(filter).sort({
        bookingDate: 1
      });

      res.json(bookings);
    } catch {
      res.status(500).json({
        message: "Could not load wall painting bookings."
      });
    }
  }
);

// Customer creates a mural booking request.
app.post(
  "/api/mural-bookings",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    try {
      const bookingDate = String(
        req.body.bookingDate || ""
      ).trim();
      const sizeSqFt = Number(req.body.sizeSqFt);
      const address = String(req.body.address || "").trim();

      if (!Number.isFinite(muralRate) || muralRate < 0) {
        return res.status(500).json({
          message: "The mural rate is not configured correctly."
        });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
        return res.status(400).json({
          message: "Choose a valid booking date."
        });
      }

      const selectedDate = new Date(
        `${bookingDate}T00:00:00`
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 7);

      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 90);

      if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.toISOString().slice(0, 10) !== bookingDate ||
        selectedDate < minDate ||
        selectedDate > maxDate
      ) {
        return res.status(400).json({
          message:
            "Choose a date between 7 and 90 days from today."
        });
      }

      if (
        !Number.isInteger(sizeSqFt) ||
        sizeSqFt < 10 ||
        sizeSqFt > 500
      ) {
        return res.status(400).json({
          message:
            "Wall size must be between 10 and 500 square feet."
        });
      }

      if (address.length < 8) {
        return res.status(400).json({
          message: "Enter the complete wall painting address."
        });
      }

      const booking = await MuralBooking.create({
        customerId: req.user.id,
        customerName: req.user.name,
        bookingDate,
        sizeSqFt,
        address,
        pricePerSqFt: muralRate,
        totalPrice: sizeSqFt * muralRate,
        status: "requested"
      });

      res.status(201).json({
        message: "Wall painting request submitted.",
        booking
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message:
            "That date already has a requested or confirmed booking."
        });
      }

      res.status(500).json({
        message:
          "Could not create the booking. Please try again."
      });
    }
  }
);

// IMPORTANT: Keep the cancellation route BEFORE the
// general /:action route below.
app.post(
  "/api/mural-bookings/:id/cancel",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    try {
      const booking = await MuralBooking.findOne({
        _id: req.params.id,
        customerId: req.user.id
      });

      if (!booking) {
        return res.status(404).json({
          message: "Booking not found."
        });
      }

      if (
        !["requested", "confirmed"].includes(booking.status)
      ) {
        return res.status(400).json({
          message: "This booking can no longer be cancelled."
        });
      }

      booking.status = "cancelled";
      await booking.save();

      res.json({
        message: "Wall painting booking cancelled."
      });
    } catch {
      res.status(400).json({
        message: "Could not cancel this booking."
      });
    }
  }
);

// Admin confirms or declines a requested mural booking.
app.post(
  "/api/mural-bookings/:id/:action",
  checkLogin,
  checkAdmin,
  async (req, res) => {
    try {
      const { action } = req.params;

      if (!["approve", "decline"].includes(action)) {
        return res.status(400).json({
          message: "Invalid booking action."
        });
      }

      const status =
        action === "approve" ? "confirmed" : "declined";

      const booking = await MuralBooking.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "requested"
        },
        {
          status
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!booking) {
        return res.status(404).json({
          message:
            "Requested booking not found or already processed."
        });
      }

      res.json({
        message: `Wall painting booking ${status}.`,
        booking
      });
    } catch {
      res.status(400).json({
        message: "Could not update this booking."
      });
    }
  }
);

// --------------------------------------------------
// ADMIN ACCOUNT
// --------------------------------------------------

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL
    ?.trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create the admin."
    );
    return;
  }

  const existing = await User.findOne({ email });

  if (!existing) {
    await User.create({
      name: "Studio Admin",
      email,
      password: await bcrypt.hash(password, 10),
      role: "admin"
    });

    console.log("Admin account created.");
  } else if (existing.role !== "admin") {
    console.log(
      "Warning: ADMIN_EMAIL belongs to a non-admin account."
    );
  }
}

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const port = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    await createAdmin();

    app.listen(port, () => {
      console.log(`Website running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error(
      "MongoDB connection error:",
      error.message
    );
    process.exit(1);
  });
