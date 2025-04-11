const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

const productSchema = new mongoose.Schema({
  productType: { type: String, required: true },
  size: { type: String, default: "N/A" },
  spec: { type: String, default: "N/A" },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  serialNos: [{ type: String }],
  modelNos: [{ type: String }],
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    soDate: { type: Date, required: true },
    committedDate: { type: Date },
    dispatchFrom: { type: String },
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
    dispatchDate: { type: Date },
    name: { type: String },
    partyAndAddress: { type: String },
    city: { type: String },
    state: { type: String },
    pinCode: { type: String },
    contactNo: { type: String },
    customername: { type: String },
    customerEmail: { type: String },
    products: [productSchema],
    gst: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentTerms: { type: String },
    amount2: { type: Number, default: 0 },
    freightcs: { type: String },
    orderType: {
      type: String,
      enum: [
        "GEM order",
        "Govt. order",
        "Private order",
        "For Demo",
        "Replacement",
        "For repair purpose",
      ],
      default: "Private order",
    },
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
    salesPerson: { type: String },
    company: {
      type: String,
      enum: ["Promark", "Promine", "Others"],
      default: "Promark",
    },
    transporter: { type: String },
    transporterDetails: { type: String },
    docketNo: { type: String },
    receiptDate: { type: Date },
    remarks: { type: String },
    sostatus: {
      type: String,
      enum: ["Pending for Approval", "Accounts Approved", "Approved"],
      default: "Pending for Approval",
    },
    shippingAddress: { type: String, default: "" },
    billingAddress: { type: String, default: "" },
    sameAddress: { type: Boolean, default: false },
    invoiceNo: { type: String },
    invoiceDate: { type: Date },
    fulfillingStatus: { type: String, default: "Pending" },
    remarksByProduction: { type: String },
    remarksByAccounts: { type: String },
    paymentReceived: {
      type: String,
      enum: ["Not Received", "Received"],
      default: "Not Received",
    },
    billNumber: { type: String },
    completionStatus: {
      type: String,
      enum: ["In Progress", "Complete"],
      default: "In Progress",
    },
    fulfillmentDate: { type: Date },
  },
  { timestamps: true }
);

// Indexes for performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ soDate: 1 });

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
