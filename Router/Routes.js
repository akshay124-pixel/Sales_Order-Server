const express = require("express");
const router = express.Router();
const Controller = require("../Controller/Logic"); // Adjust path
const checkProductionRole = require("../Middleware/middleware");
// GET all orders
router.get("/get-orders", Controller.getAllOrders);

// POST a new order
router.post("/orders", Controller.createOrder);
router.get("/installation-orders", Controller.getInstallationOrders);
// DELETE an order by ID
router.delete("/delete/:id", Controller.DeleteData); // Updated to use :id parameter

// PUT to edit an order
router.put("/edit/:id", Controller.editEntry);
router.get("/export", Controller.exportentry);
router.get("/export", Controller.exportentry);
router.post("/bulk-orders", Controller.bulkUploadOrders);
router.get(
  "/production-orders",
  checkProductionRole,
  Controller.getProductionOrders
);
router.get("/finished-goods", Controller.getFinishedGoodsOrders);
module.exports = router;
