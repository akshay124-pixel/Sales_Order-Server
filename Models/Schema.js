const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema({
  productType: { type: String, trim: true, required: true },
  size: { type: String, default: "N/A", trim: true },
  spec: { type: String, default: "N/A", trim: true },
  qty: { type: Number, min: 1, required: true },
  unitPrice: { type: Number, required: true },
  serialNos: [{ type: String, trim: true }],
  modelNos: [{ type: String, trim: true }],
  gst: {
    type: String,
    default: "18",
    enum: ["18", "28", "including"],
    trim: true,
    required: true,
  },
  brand: { type: String, trim: true, default: "" },
  warranty: { type: String, trim: true, required: true },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    soDate: { type: Date, required: true },
    dispatchFrom: {
      type: String,
      trim: true,
      enum: [
        "PMTS Patna",
        "PMTS Bareilly",
        "PMTS Ranchi",
        "PMTS Morinda",
        "PMTS Lucknow",
        "PMTS Delhi",
        "",
      ],
      default: "",
    },
    dispatchDate: { type: Date },
    name: { type: String, trim: true },
    gstno: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    contactNo: { type: String, trim: true },
    alterno: { type: String, trim: true },
    customerEmail: { type: String, trim: true },
    customername: { type: String, trim: true, required: true },
    products: [productSchema],
    total: { type: Number, min: 0, required: true },
    paymentCollected: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ["Cash", "NEFT", "RTGS", "Cheque", ""],
      default: "",
    },
    paymentDue: { type: String, trim: true },
    neftTransactionId: { type: String, trim: true },
    chequeId: { type: String, trim: true },
    paymentTerms: {
      type: String,
      enum: ["100% Advance", "Partial Advance", "Credit", ""],
      default: "",
    },
    creditDays: { type: String, trim: true },
    freightcs: { type: String, trim: true },
    freightstatus: {
      type: String,
      enum: ["Self-Pickup", "To Pay", "Including", "Extra"],
      default: "Extra",
    },
    actualFreight: { type: Number, min: 0 }, // New field
    installchargesstatus: {
      type: String,
      enum: ["To Pay", "Including", "Extra"],
      default: "Extra",
    },
    orderType: {
      type: String,
      enum: ["B2G", "B2C", "B2B", "Demo", "Replacement", "Stock Out"],
      default: "B2C",
    },
    gemOrderNumber: { type: String, trim: true },
    deliveryDate: { type: Date },
    installation: { type: String, default: "N/A", trim: true },
    installationStatus: {
      type: String,
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
      enum: ["Promark", "Foxmate", "Promine", "Primus"],
      default: "Promark",
      required: true,
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
    piNumber: { type: String, trim: true },
    remarksByBilling: { type: String, trim: true },
    verificationRemarks: { type: String, trim: true },
    billStatus: {
      type: String,
      enum: ["Pending", "Under Billing", "Billing Complete"],
      default: "Pending",
    },
    completionStatus: {
      type: String,
      enum: ["In Progress", "Complete"],
      default: "In Progress",
    },
    stockStatus: {
      type: String,
      enum: ["In Stock", "Not in Stock", "Partial Stock"],
      default: "In Stock",
    },
    demoDate: { type: Date },
    fulfillmentDate: { type: Date },
    remarks: { type: String, trim: true },
    sostatus: {
      type: String,
      enum: ["Pending for Approval", "Accounts Approved", "Approved"],
      default: "Pending for Approval",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ soDate: 1 });
orderSchema.index({ createdBy: 1 });

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
