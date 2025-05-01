const express = require("express");
const router = express.Router();
const Controller = require("../Controller/Logic");
const checkProductionRole = require("../Middleware/middleware");
const { verifyToken } = require("../utils/config jwt");

router.get("/get-orders", verifyToken, Controller.getAllOrders);
router.get(
  "/installation-orders",
  verifyToken,
  Controller.getInstallationOrders
);
router.get("/accounts-orders", verifyToken, Controller.getAccountsOrders);
router.post("/orders", verifyToken, Controller.createOrder);
router.delete("/delete/:id", verifyToken, Controller.DeleteData);
router.put("/edit/:id", Controller.editEntry);
router.get("/export", verifyToken, Controller.exportentry);
router.post("/bulk-orders", verifyToken, Controller.bulkUploadOrders);
router.get(
  "/production-orders",
  verifyToken,
  checkProductionRole,
  Controller.getProductionOrders
);
router.get("/finished-goods", verifyToken, Controller.getFinishedGoodsOrders);

module.exports = router;
