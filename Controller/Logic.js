const { Order, Counter } = require("../Models/Schema");
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const moment = require("moment");

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error("Error in getAllOrders:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Create a new order
const createOrder = async (req, res) => {
  try {
    console.log("Request body received in createOrder:", req.body);

    // Manual validation for required fields
    const { soDate, qty, unitPrice, total } = req.body;
    if (
      !soDate ||
      qty === undefined ||
      unitPrice === undefined ||
      total === undefined
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "soDate, qty, unitPrice, and total are required",
      });
    }

    // Validate numeric fields
    const numericFields = { qty, unitPrice, total };
    for (const [key, value] of Object.entries(numericFields)) {
      if (isNaN(Number(value)) || value === "") {
        return res.status(400).json({
          error: `Invalid ${key}`,
          details: `${key} must be a valid number`,
        });
      }
    }

    // Validate date
    if (isNaN(new Date(soDate).getTime())) {
      return res.status(400).json({
        error: "Invalid soDate",
        details: "soDate must be a valid date",
      });
    }

    const order = new Order(req.body);
    await order.validate();
    const savedOrder = await order.save();
    console.log("Order saved successfully:", savedOrder);
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Validation error in createOrder:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        error: "Validation failed",
        details: messages,
      });
    }
    res.status(400).json({ error: error.message });
  }
};

/// Edit an existing order
const editEntry = async (req, res) => {
  console.log("Received PUT /api/edit/:id request:", {
    params: req.params,
    body: req.body,
  });

  try {
    const {
      soDate,
      serialno,
      committedDate,
      dispatchFrom,
      status,
      dispatchDate,
      partyAndAddress,
      city,
      state,
      pinCode,
      name,
      contactNo,
      customerEmail,
      modelNo,
      productType,
      size,
      spec,
      productDetails,
      qty,
      unitPrice,
      gst,
      total,
      paymentTerms,
      amount2,
      freightcs,
      installation,
      installationStatus,
      remarksByInstallation,
      dispatchStatus,
      salesPerson,
      company,
      transporter,
      transporterDetails,
      docketNo,
      receiptDate,
      remarks,
      sostatus,
      invoiceNo,
      invoiceDate,
      fulfillingStatus,
      shippingAddress,
      billingAddress,
      remarksByProduction,
      remarksByAccounts,
      paymentReceived,
      billNumber,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const updateData = {
      ...(soDate !== undefined && { soDate: soDate ? new Date(soDate) : null }),
      ...(serialno !== undefined && {
        serialno: serialno?.trim() || "",
      }),
      ...(committedDate !== undefined && {
        committedDate: committedDate ? new Date(committedDate) : null,
      }),
      ...(dispatchFrom !== undefined && {
        dispatchFrom: dispatchFrom?.trim() || "",
      }),
      ...(status !== undefined && { status: status?.trim() || "" }),
      ...(dispatchDate !== undefined && {
        dispatchDate: dispatchDate ? new Date(dispatchDate) : null,
      }),
      ...(partyAndAddress !== undefined && {
        partyAndAddress: partyAndAddress?.trim() || "",
      }),
      ...(city !== undefined && { city: city?.trim() || "" }),
      ...(state !== undefined && { state: state?.trim() || "" }),
      ...(pinCode !== undefined && { pinCode: pinCode?.trim() || "" }),
      ...(name !== undefined && { name: name?.trim() || "" }),
      ...(contactNo !== undefined && { contactNo: contactNo?.trim() || "" }),
      ...(customerEmail !== undefined && {
        customerEmail: customerEmail?.trim() || "",
      }),
      ...(modelNo !== undefined && { modelNo: modelNo?.trim() || "" }),
      ...(productType !== undefined && {
        productType: productType?.trim() || "",
      }),
      ...(size !== undefined && { size: size?.trim() || "" }),
      ...(spec !== undefined && { spec: spec?.trim() || "" }),
      ...(productDetails !== undefined && {
        productDetails: productDetails?.trim() || "",
      }),
      ...(qty !== undefined && { qty: qty !== "" ? Number(qty) : order.qty }),
      ...(unitPrice !== undefined && {
        unitPrice: unitPrice !== "" ? Number(unitPrice) : order.unitPrice,
      }),
      ...(gst !== undefined && { gst: gst !== "" ? Number(gst) : null }),
      ...(total !== undefined && {
        total: total !== "" ? Number(total) : order.total,
      }),
      ...(paymentTerms !== undefined && {
        paymentTerms: paymentTerms?.trim() || "",
      }),
      ...(amount2 !== undefined && {
        amount2: amount2 !== "" ? Number(amount2) : null,
      }),
      ...(freightcs !== undefined && {
        freightcs: freightcs?.trim() || "",
      }),

      ...(installation !== undefined && {
        installation: installation?.trim() || "",
      }),

      ...(installationStatus !== undefined && {
        installationStatus: installationStatus?.trim() || "",
      }),

      ...(remarksByInstallation !== undefined && {
        remarksByInstallation: remarksByInstallation?.trim() || "",
      }),

      ...(dispatchStatus !== undefined && {
        dispatchStatus: dispatchStatus?.trim() || "",
      }),

      ...(salesPerson !== undefined && {
        salesPerson: salesPerson?.trim() || "",
      }),
      ...(company !== undefined && { company: company?.trim() || "" }),
      ...(transporter !== undefined && {
        transporter: transporter?.trim() || "",
      }),
      ...(transporterDetails !== undefined && {
        transporterDetails: transporterDetails?.trim() || "",
      }),
      ...(docketNo !== undefined && { docketNo: docketNo?.trim() || "" }),
      ...(receiptDate !== undefined && {
        receiptDate: receiptDate ? new Date(receiptDate) : null,
      }),
      ...(remarks !== undefined && { remarks: remarks?.trim() || "" }),
      ...(sostatus !== undefined && {
        sostatus: sostatus?.trim() || "Pending for Approval",
      }),
      ...(invoiceNo !== undefined && {
        invoiceNo: invoiceNo !== "" ? Number(invoiceNo) : 0,
      }),
      ...(invoiceDate !== undefined && {
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      }),
      ...(fulfillingStatus !== undefined && {
        fulfillingStatus: fulfillingStatus?.trim() || "Pending",
      }),
      ...(shippingAddress !== undefined && {
        shippingAddress: shippingAddress?.trim() || "",
      }),
      ...(billingAddress !== undefined && {
        billingAddress: billingAddress?.trim() || "",
      }),
      ...(remarksByProduction !== undefined && {
        remarksByProduction: remarksByProduction?.trim() || "",
      }),
      ...(remarksByAccounts !== undefined && {
        remarksByAccounts: remarksByAccounts?.trim() || "",
      }),
      ...(paymentReceived !== undefined && {
        paymentRecived: paymentReceived?.trim() || "",
      }),
      ...(billNumber !== undefined && {
        billNumber: billNumber?.trim() || "",
      }),
    };

    // Automatic status transition logic
    if (
      fulfillingStatus === "Fulfilled" &&
      order.fulfillingStatus !== "Fulfilled"
    ) {
      updateData.completionStatus = "Complete";
      updateData.fulfillmentDate = new Date();
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updatedOrder) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to update order" });
    }

    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("Error in editEntry:", error.stack);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error updating order",
      error: error.message,
    });
  }
};
// Delete an order
const DeleteData = async (req, res) => {
  try {
    console.log("Delete request received for ID:", req.params.id);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("Invalid ID format:", req.params.id);
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    console.log("Fetching order with ID:", req.params.id);
    const order = await Order.findById(req.params.id);
    if (!order) {
      console.log("Order not found for ID:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    console.log("Deleting order with ID:", req.params.id);
    await Order.findByIdAndDelete(req.params.id);
    console.log("Order deleted successfully for ID:", req.params.id);

    res
      .status(200)
      .json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", {
      message: error.message,
      stack: error.stack,
      params: req.params,
    });
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

// Export orders to XLSX
const exportentry = async (req, res) => {
  try {
    const orders = await Order.find().lean();

    const formattedEntries = orders.map((entry) => ({
      soDate: entry.soDate ? entry.soDate.toLocaleDateString() : "Not Found",
      serialno: entry.serialno || "Not Found",
      committedDate: entry.committedDate
        ? entry.committedDate.toLocaleDateString()
        : "Not Found",
      dispatchFrom: entry.dispatchFrom || "Not Found",
      status: entry.status || "Not Found",
      dispatchDate: entry.dispatchDate
        ? entry.dispatchDate.toLocaleDateString()
        : "Not Found",
      partyAndAddress: entry.partyAndAddress || "Not Found",
      city: entry.city || "Not Found",
      state: entry.state || "Not Found",
      pinCode: entry.pinCode || "Not Found",
      name: entry.name || "Not Found",
      contactNo: entry.contactNo || "Not Found",
      customerEmail: entry.customerEmail || "Not Found",
      modelNo: entry.modelNo || "Not Found",
      productType: entry.productType || "Not Found",
      size: entry.size || "Not Found",
      spec: entry.spec || "Not Found",
      productDetails: entry.productDetails || "Not Found",
      qty: entry.qty || 0,
      unitPrice: entry.unitPrice || 0,
      gst: entry.gst || 0,
      total: entry.total || 0,
      paymentTerms: entry.paymentTerms || "Not Found",
      paymentReceived: entry.paymentReceived || "Not Received", // Updated default per schema
      amount2: entry.amount2 || 0,
      freightcs: entry.freightcs || "Not Found",
      installation: entry.installation || "Not Found",
      installationStatus: entry.installationStatus || "Not Found",
      remarksByInstallation: entry.remarksByInstallation || "Not Found",
      dispatchStatus: entry.dispatchStatus || "Not Found",
      salesPerson: entry.salesPerson || "Not Found",
      company: entry.company || "Not Found",
      transporter: entry.transporter || "Not Found",
      transporterDetails: entry.transporterDetails || "Not Found",
      shippingAddress: entry.shippingAddress || "Not Found",
      billingAddress: entry.billingAddress || "Not Found",
      docketNo: entry.docketNo || "Not Found",
      receiptDate: entry.receiptDate
        ? entry.receiptDate.toLocaleDateString()
        : "Not Found",
      sostatus: entry.sostatus || "Not Found",
      invoiceNo: entry.invoiceNo || 0,
      invoiceDate: entry.invoiceDate
        ? entry.invoiceDate.toLocaleDateString()
        : "Not Found",
      remarks: entry.remarks || "Not Found",
      fulfillingStatus: entry.fulfillingStatus || "Not Found",
      remarksByProduction: entry.remarksByProduction || "Not Found",
      // New fields from updated schema
      billNumber: entry.billNumber || "Not Found",
      completionStatus: entry.completionStatus || "Not Found",
      fulfillmentDate: entry.fulfillmentDate
        ? entry.fulfillmentDate.toLocaleDateString()
        : "Not Found",
      remarksByAccounts: entry.remarksByAccounts || "Not Found",
    }));

    const ws = XLSX.utils.json_to_sheet(formattedEntries);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    const fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader("Content-Disposition", "attachment; filename=orders.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(fileBuffer);
  } catch (error) {
    console.error("Error exporting orders:", error.message);
    res.status(500).json({
      success: false,
      message: "Error exporting orders",
      error: error.message,
    });
  }
};

// Bulk Upload
const bulkUploadOrders = async (req, res) => {
  try {
    const newEntries = req.body;
    if (!Array.isArray(newEntries) || newEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Array expected.",
      });
    }

    // Reserve sequence numbers for all new entries
    const counter = await Counter.findByIdAndUpdate(
      { _id: "orderId" },
      { $inc: { sequence: newEntries.length } },
      { new: true, upsert: true }
    );
    const startSequence = counter.sequence - newEntries.length + 1;

    const validatedEntries = newEntries.map((entry, index) => ({
      orderId: `PMTO${startSequence + index}`, // Assign unique orderId
      soDate: entry.soDate
        ? moment(entry.soDate, [
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/DD/YYYY",
          ]).toDate()
        : null,
      serialno: String(entry.serialno || "").trim() || null,
      committedDate: entry.committedDate
        ? moment(entry.committedDate, [
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/DD/YYYY",
          ]).toDate()
        : null,
      dispatchFrom: String(entry.dispatchFrom || "").trim() || null,
      status: String(entry.status || "Pending").trim(),
      dispatchDate: entry.dispatchDate
        ? moment(entry.dispatchDate, [
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/DD/YYYY",
          ]).toDate()
        : null,
      partyAndAddress: String(entry.partyAndAddress || "").trim() || null,
      city: String(entry.city || "").trim() || null,
      state: String(entry.state || "").trim() || null,
      pinCode: String(entry.pinCode || "").trim() || null,
      name: String(entry.name || "").trim() || null,
      contactNo: String(entry.contactNo || "").trim() || null,
      customerEmail: String(entry.customerEmail || "").trim() || null,
      modelNo: String(entry.modelNo || "").trim() || null,
      productType: String(entry.productType || "").trim() || null,
      size: String(entry.size || "").trim() || null,
      spec: String(entry.spec || "").trim() || null,
      productDetails: String(entry.productDetails || "").trim() || null,
      qty: entry.qty !== undefined ? Number(entry.qty) : null,
      unitPrice: entry.unitPrice !== undefined ? Number(entry.unitPrice) : null,
      gst: entry.gst !== undefined ? Number(entry.gst) : null,
      total: entry.total !== undefined ? Number(entry.total) : null,
      paymentTerms: String(entry.paymentTerms || "").trim() || null,
      amount2: entry.amount2 !== undefined ? Number(entry.amount2) : null,
      freightcs: String(entry.freightcs || "").trim() || null,
      installation: String(entry.installation || "N/A").trim(),
      installationStatus: String(entry.installationStatus || "Pending").trim(),
      remarksByInstallation: String(entry.remarksByInstallation || "").trim(),
      dispatchStatus: String(entry.dispatchStatus || "Not Dispatched").trim(),
      salesPerson: String(entry.salesPerson || "").trim() || null,
      shippingAddress: String(entry.shippingAddress || "").trim() || null,
      billingAddress: String(entry.billingAddress || "").trim() || null,
      company: String(entry.company || "ProMark").trim(),
      transporter: String(entry.transporter || "").trim() || null,
      transporterDetails: String(entry.transporterDetails || "").trim() || null,
      docketNo: String(entry.docketNo || "").trim() || null,
      receiptDate: entry.receiptDate
        ? moment(entry.receiptDate, [
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/DD/YYYY",
          ]).toDate()
        : null,
      sostatus: String(entry.sostatus || "Pending for Approval").trim(),
      invoiceNo: entry.invoiceNo !== undefined ? Number(entry.invoiceNo) : null,
      invoiceDate: entry.invoiceDate
        ? moment(entry.invoiceDate, [
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/DD/YYYY",
          ]).toDate()
        : null,
      remarks: String(entry.remarks || "").trim() || null,
      fulfillingStatus: String(entry.fulfillingStatus || "Pending").trim(),
      remarksByProduction:
        String(entry.remarksByProduction || "").trim() || null,
      // New fields from updated schema
      billNumber: String(entry.billNumber || "").trim() || null,
      completionStatus: String(entry.completionStatus || "In Progress").trim(),
      fulfillmentDate: entry.fulfillmentDate
        ? moment(entry.fulfillmentDate, [
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/DD/YYYY",
          ]).toDate()
        : null,
      remarksByAccounts: String(entry.remarksByAccounts || "").trim() || null,
      paymentReceived: String(entry.paymentReceived || "Not Received").trim(),
    }));

    const insertedOrders = await Order.insertMany(validatedEntries, {
      ordered: false,
    });
    res.status(201).json({
      success: true,
      data: insertedOrders,
      message: `${insertedOrders.length} orders uploaded successfully`,
    });
  } catch (error) {
    console.error("Error in bulkUploadOrders:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: messages,
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};
// Get production orders

const getProductionOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      sostatus: "Approved",
      completionStatus: { $ne: "Complete" },
      fulfillingStatus: { $ne: "Partial Dispatch" }, // Exclude Partial Dispatch
    }).lean();

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getProductionOrders:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching production orders",
      error: error.message,
    });
  }
};

// Get finished goods orders

const getFinishedGoodsOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { completionStatus: "Complete" },
        { fulfillingStatus: "Partial Dispatch" },
      ],
      dispatchStatus: { $ne: "Dispatched" }, // Exclude Dispatched orders
    }).lean();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getFinishedGoodsOrders:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching finished goods orders",
      error: error.message,
    });
  }
};
const getInstallationOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      dispatchStatus: "Dispatched",
      installationStatus: { $ne: "Completed" }, // Exclude completed installations
    }).lean();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getInstallationOrders:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching installation orders",
      error: error.message,
    });
  }
};

const getAccountsOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      installationStatus: "Completed",
      paymentReceived: { $ne: "Received" },
    }).lean();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getAccountsOrders:", error.message);
    res.status(500).json({
      success: false,
      message: "Error fetching accounts orders",
      error: error.message,
    });
  }
};
module.exports = {
  getInstallationOrders,
  getAccountsOrders,
  getAllOrders,
  createOrder,
  DeleteData,
  editEntry,
  exportentry,
  getProductionOrders,
  bulkUploadOrders,
  getFinishedGoodsOrders,
};
