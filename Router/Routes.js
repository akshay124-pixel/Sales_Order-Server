const express = require("express");
const router = express.Router();
const Controller = require("../Controller/Logic");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { verifyToken } = require("../utils/config jwt");

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../Uploads"));
  },
  filename: function (req, file, cb) {
    const randomBytes = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${randomBytes}${ext}`);
  },
}); // File filter to validate file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]; // Added Excel types for bulk upload
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, PNG, JPG, DOCX, XLS, and XLSX are allowed."
      ),
      false
    );
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.get("/get-orders", verifyToken, Controller.getAllOrders);
router.get(
  "/installation-orders",
  verifyToken,
  Controller.getInstallationOrders
);
router.get("/accounts-orders", verifyToken, Controller.getAccountsOrders);

router.post(
  "/orders",
  verifyToken,
  upload.single("poFile"),
  Controller.createOrder
);

router.delete("/delete/:id", verifyToken, Controller.DeleteData);
router.put("/edit/:id", Controller.editEntry);
router.get("/export", verifyToken, Controller.exportentry);
router.post("/bulk-orders", verifyToken, Controller.bulkUploadOrders);
router.get(
  "/production-orders",
  verifyToken,

  Controller.getProductionOrders
);
router.get("/finished-goods", verifyToken, Controller.getFinishedGoodsOrders);
router.get(
  "/get-verification-orders",
  verifyToken,
  Controller.getVerificationOrders
);
router.get(
  "/production-approval-orders",
  verifyToken,

  Controller.getProductionApprovalOrders
);
router.get("/get-bill-orders", verifyToken, Controller.getBillOrders);
router.get("/notifications", verifyToken, Controller.getNotifications);
router.post("/mark-read", verifyToken, Controller.markNotificationsRead);
router.delete("/clear", verifyToken, Controller.clearNotifications);

router.get("/current-user", verifyToken, Controller.getCurrentUser);
router.get(
  "/fetch-available-users",
  verifyToken,
  Controller.fetchAvailableUsers
);
router.get("/fetch-my-team", verifyToken, Controller.fetchMyTeam);
router.post("/assign-user", verifyToken, Controller.assignUser);
router.post("/unassign-user", verifyToken, Controller.unassignUser);

module.exports = router;
