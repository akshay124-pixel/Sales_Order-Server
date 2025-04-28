const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema({
  productType: { type: String, required: true, trim: true },
  size: { type: String, default: "N/A", trim: true },
  spec: { type: String, default: "N/A", trim: true },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  serialNos: [{ type: String, trim: true }],
  modelNos: [{ type: String, trim: true }],
  gst: { type: Number, default: 0, min: 0, max: 100 },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    soDate: { type: Date, required: true },

    dispatchFrom: { type: String, trim: true },

    dispatchDate: { type: Date },
    name: { type: String, trim: true },

    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    contactNo: { type: String, trim: true },
    alterno: { type: String, trim: true },
    customerEmail: { type: String, trim: true },
    customername: { type: String, trim: true },
    products: [productSchema],
    total: { type: Number, min: 0 },
    paymentCollected: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ["Cash", "NEFT", "RTGS", "Cheque", ""],
      default: "",
    },
    paymentDue: { type: String, trim: true },
    neftTransactionId: { type: String, trim: true },
    chequeId: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },

    freightcs: { type: String, trim: true },
    orderType: {
      type: String,
      enum: ["GEM", "Goverment", "Private", "Demo", "Replacement", "repair"],
      default: "Private order",
    },
    installation: { type: String, default: "N/A", trim: true },
    installationStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Failed"],
      default: "Pending",
    },
    remarksByInstallation: { type: String, default: "", trim: true },
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
    salesPerson: { type: String, trim: true },
    report: { type: String, trim: true },
    company: {
      type: String,
      enum: ["Promark", "Promine", "Others"],
      default: "Promark",
    },
    transporter: { type: String, trim: true },
    transporterDetails: { type: String, trim: true },
    docketNo: { type: String, trim: true },
    receiptDate: { type: Date },
    shippingAddress: { type: String, default: "", trim: true },
    billingAddress: { type: String, default: "", trim: true },
    invoiceNo: { type: String, trim: true },
    invoiceDate: { type: Date },
    fulfillingStatus: { type: String, default: "Pending", trim: true },
    remarksByProduction: { type: String, trim: true },
    remarksByAccounts: { type: String, trim: true },
    paymentReceived: {
      type: String,
      enum: ["Not Received", "Received"],
      default: "Not Received",
    },
    billNumber: { type: String, trim: true },
    completionStatus: {
      type: String,
      enum: ["In Progress", "Complete"],
      default: "In Progress",
    },
    fulfillmentDate: { type: Date },
    remarks: { type: String, trim: true },
    sostatus: {
      type: String,
      enum: ["Pending for Approval", "Accounts Approved", "Approved"],
      default: "Pending for Approval",
    },
  },
  { timestamps: true }
);

// Indexes for performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ soDate: 1 });

// Auto-generate orderId for new orders
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
const Counter = mongoose.model("Counter", counterSchema);

module.exports = { Order, Counter };
