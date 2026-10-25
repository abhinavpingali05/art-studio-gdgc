import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import PotteryRequest from "./models/potteryRequest.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seedData = JSON.parse(
  readFileSync(
    path.join(__dirname, "seedData", "seed.json"),
    "utf8"
  )
);

const potteryItems = seedData.potteryItems || [];
const glazes = seedData.glazes || [];

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

function checkCustomer(req, res, next) {
  if (req.user.role !== "customer") {
    return res.status(403).json({
      message: "Only customers can do this."
    });
  }

  next();
}

function checkAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only the studio admin can do this."
    });
  }

  next();
}

function validatePotteryInput(body) {
  const itemId = String(body.itemId || "").trim();
  const glazeId = String(body.glazeId || "").trim();
  const quantity = Number(body.quantity);
  const neededBy = String(body.neededBy || "").trim();

  const item = potteryItems.find(
    (entry) => String(entry.id) === itemId
  );

  const glaze = glazes.find(
    (entry) => String(entry.id) === glazeId
  );

  if (!item) {
    return { error: "Choose a valid pottery item." };
  }

  if (!glaze) {
    return { error: "Choose a valid glaze." };
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 12
  ) {
    return {
      error: "Quantity must be between 1 and 12."
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(neededBy)) {
    return {
      error: "Choose a valid needed-by date."
    };
  }

  const [year, month, day] = neededBy.split("-").map(Number);
  const chosenDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    chosenDate.getUTCFullYear() !== year ||
    chosenDate.getUTCMonth() !== month - 1 ||
    chosenDate.getUTCDate() !== day
  ) {
    return {
      error: "Choose a valid calendar date."
    };
  }

  const earliestDate = new Date();
  earliestDate.setHours(0, 0, 0, 0);
  earliestDate.setDate(earliestDate.getDate() + 14);

  const earliestYear = earliestDate.getFullYear();
  const earliestMonth = String(
    earliestDate.getMonth() + 1
  ).padStart(2, "0");
  const earliestDay = String(
    earliestDate.getDate()
  ).padStart(2, "0");

  const earliestAllowed = `${earliestYear}-${earliestMonth}-${earliestDay}`;

  if (neededBy < earliestAllowed) {
    return {
      error:
        "The needed-by date must be at least 14 days from today."
    };
  }

  return {
    itemId,
    itemName: item.name,
    glazeId,
    glazeName: glaze.name,
    quantity,
    neededBy
  };
}

// GET /api/pottery/options
// Public list of options sourced from seed data.
router.get("/options", (req, res) => {
  res.json({
    items: potteryItems,
    glazes
  });
});

// GET /api/pottery
// Admin sees all requests; customers see only their own.
router.get("/", checkLogin, async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { customerId: req.user.id };

    const requests = await PotteryRequest.find(filter).sort({
      createdAt: -1
    });

    res.json(requests);
  } catch {
    res.status(500).json({
      message: "Could not load pottery requests."
    });
  }
});

// POST /api/pottery
// Customer creates a pottery request.
router.post(
  "/",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    try {
      const input = validatePotteryInput(req.body);

      if (input.error) {
        return res.status(400).json({
          message: input.error
        });
      }

      const request = await PotteryRequest.create({
        customerId: req.user.id,
        customerName: req.user.name,
        ...input,
        status: "requested"
      });

      res.status(201).json({
        message: "Pottery request submitted successfully.",
        request
      });
    } catch {
      res.status(500).json({
        message: "Could not submit pottery request."
      });
    }
  }
);

// PUT /api/pottery/:id
// Customer can edit their own request while it is requested.
router.put(
  "/:id",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    try {
      const input = validatePotteryInput(req.body);

      if (input.error) {
        return res.status(400).json({
          message: input.error
        });
      }

      const request = await PotteryRequest.findOneAndUpdate(
        {
          _id: req.params.id,
          customerId: req.user.id,
          status: "requested"
        },
        input,
        {
          new: true,
          runValidators: true
        }
      );

      if (!request) {
        const ownRequest = await PotteryRequest.exists({
          _id: req.params.id,
          customerId: req.user.id
        });

        if (!ownRequest) {
          return res.status(404).json({
            message: "Pottery request not found."
          });
        }

        return res.status(400).json({
          message:
            "Only requests with requested status can be edited."
        });
      }

      res.json({
        message: "Pottery request updated successfully.",
        request
      });
    } catch {
      res.status(400).json({
        message: "Could not update pottery request."
      });
    }
  }
);

// POST /api/pottery/:id/cancel
router.post(
  "/:id/cancel",
  checkLogin,
  checkCustomer,
  async (req, res) => {
    try {
      const request = await PotteryRequest.findOneAndUpdate(
        {
          _id: req.params.id,
          customerId: req.user.id,
          status: "requested"
        },
        {
          status: "cancelled"
        },
        {
          new: true
        }
      );

      if (!request) {
        const ownRequest = await PotteryRequest.exists({
          _id: req.params.id,
          customerId: req.user.id
        });

        if (!ownRequest) {
          return res.status(404).json({
            message: "Pottery request not found."
          });
        }

        return res.status(400).json({
          message:
            "Only requests with requested status can be cancelled."
        });
      }

      res.json({
        message: "Pottery request cancelled successfully.",
        request
      });
    } catch {
      res.status(400).json({
        message: "Could not cancel pottery request."
      });
    }
  }
);

// Admin accepts or declines a request.
router.post(
  "/:id/:action",
  checkLogin,
  checkAdmin,
  async (req, res) => {
    try {
      const { action } = req.params;

      if (!["accept", "decline"].includes(action)) {
        return res.status(400).json({
          message: "Invalid pottery request action."
        });
      }

      const status =
        action === "accept" ? "accepted" : "declined";

      const request = await PotteryRequest.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "requested"
        },
        {
          status
        },
        {
          new: true
        }
      );

      if (!request) {
        return res.status(404).json({
          message:
            "Requested pottery order not found or already processed."
        });
      }

      res.json({
        message: `Pottery request ${status}.`,
        request
      });
    } catch {
      res.status(400).json({
        message: "Could not update pottery request."
      });
    }
  }
);

export default router;