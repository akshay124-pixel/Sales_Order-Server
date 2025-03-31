const mongoose = require("mongoose");

// Schema for counter collection
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

// Main Order Schema
const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    soDate: { type: Date },
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
    serialno: { type: String, default: null },
    name: { type: String, default: null },
    partyAndAddress: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pinCode: { type: String, default: null },
    contactNo: { type: String, default: null },
    customerEmail: { type: String, default: null },
    modelNo: { type: String, default: null },
    productType: { type: String, default: null },
    size: { type: String, default: null },
    spec: { type: String, default: null },
    productDetails: { type: String, default: null },
    qty: { type: Number },
    unitPrice: { type: Number, default: null },
    gst: { type: Number, default: null },
    total: { type: Number },
    paymentTerms: { type: String, default: null },
    amount2: { type: Number, default: null },
    freight: { type: Number, default: 0 },
    freightmode: { type: String, default: "To Pay" },
    freightmodes: { type: String, default: "Others" },
    installation: { type: String, default: "N/A" },
    salesPerson: { type: String, default: null },
    company: {
      type: String,
      enum: ["ProMark", "ProMine", "Others"],
      default: "ProMark",
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
  if (this.isNew && (this.orderId === null || this.orderId === undefined)) {
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

// Export both models
module.exports = { Order, Counter };
