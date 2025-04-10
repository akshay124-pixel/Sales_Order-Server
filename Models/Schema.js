const mongoose = require("mongoose");

// Schema for counter collection
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

// Sub-schema for products
const productSchema = new mongoose.Schema({
  productType: { type: String, required: true },
  size: { type: String, default: "N/A" },
  spec: { type: String, default: "N/A" },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  serialNos: [{ type: String, default: null }], // Array of serial numbers
  modelNos: [{ type: String, default: null }], // Array of model numbers
});

// Main Order Schema
const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    soDate: { type: Date, required: true },
    committedDate: { type: Date, default: null },
    dispatchFrom: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "Pending",
        "Delivered",
        "Hold",
        "Order Canceled",
        "Dispatched",
        "In Transit",
      ],
      default: "Pending",
    },
    dispatchDate: { type: Date, default: null },
    name: { type: String, default: null },
    partyAndAddress: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pinCode: { type: String, default: null },
    contactNo: { type: String, default: null },
    customername: { type: String, default: null },
    customerEmail: { type: String, default: null },
    products: [productSchema],
    gst: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentTerms: { type: String, default: null },
    amount2: { type: Number, default: 0 },
    freightcs: { type: String, default: null },
    installation: { type: String, default: "N/A" },
    installationStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Failed"],
      default: "Pending",
    },
    remarksByInstallation: { type: String, default: "" },
    dispatchStatus: {
      type: String,
      enum: [
        "Not Dispatched",
        "Dispatched",
        "Delivered",
        "Docket Awaited Dispatched",
      ],
      default: "Not Dispatched",
    },
    salesPerson: { type: String, default: null },
    company: {
      type: String,
      enum: ["Promark", "Promine", "Others"],
      default: "Promark",
    },
    transporter: { type: String, default: null },
    transporterDetails: { type: String, default: null },
    docketNo: { type: String, default: null },
    receiptDate: { type: Date, default: null },
    remarks: { type: String, default: null },
    sostatus: {
      type: String,
      enum: ["Pending for Approval", "Approved"],
      default: "Pending for Approval",
    },
    shippingAddress: { type: String, default: "" },
    billingAddress: { type: String, default: "" },
    sameAddress: { type: Boolean, default: false },
    invoiceNo: { type: Number, sparse: true, default: null },
    invoiceDate: { type: Date, default: null },
    fulfillingStatus: { type: String, default: "Pending" },
    remarksByProduction: { type: String, default: null },
    remarksByAccounts: { type: String, default: null },
    paymentReceived: {
      type: String,
      enum: ["Not Received", "Received"],
      default: "Not Received",
    },
    billNumber: { type: String, default: "" },
    completionStatus: {
      type: String,
      enum: ["In Progress", "Complete"],
      default: "In Progress",
    },
    fulfillmentDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// Pre-save hook to generate orderId
orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderId) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "orderId" },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true }
      );
      this.orderId = `PMTO${counter.sequence}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const Order = mongoose.model("Order", orderSchema);

module.exports = { Order, Counter };
