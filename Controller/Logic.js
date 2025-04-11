const { Order, Counter } = require("../Models/Schema");
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const moment = require("moment");
const { format, parse } = require("date-fns");
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
    const {
      soDate,
      committedDate,
      status,
      name,
      partyAndAddress,
      city,
      state,
      pinCode,
      contactNo,
      customerEmail,
      customername,
      products,
      paymentTerms,
      orderType,
      amount2,
      freightcs,
      installation,
      salesPerson,
      company,
      shippingAddress,
      billingAddress,
      sameAddress,
      total,
    } = req.body;

    if (
      !soDate ||
      !products ||
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "soDate and at least one product are required",
      });
    }

    for (const product of products) {
      if (
        !product.productType ||
        !product.qty ||
        !product.unitPrice ||
        product.gst === undefined
      ) {
        return res.status(400).json({
          error: "Invalid product data",
          details:
            "Each product must have productType, qty, unitPrice, and gst",
        });
      }
      if (
        isNaN(Number(product.qty)) ||
        isNaN(Number(product.unitPrice)) ||
        isNaN(Number(product.gst))
      ) {
        return res.status(400).json({
          error: "Invalid product data",
          details: "qty, unitPrice, and gst must be valid numbers",
        });
      }
      // Ensure serialNos and modelNos are arrays
      product.serialNos = Array.isArray(product.serialNos)
        ? product.serialNos
        : [];
      product.modelNos = Array.isArray(product.modelNos)
        ? product.modelNos
        : [];
    }

    const calculatedTotal =
      products.reduce(
        (sum, product) =>
          sum +
          Number(product.qty) * Number(product.unitPrice) +
          (Number(product.gst || 0) / 100) *
            Number(product.unitPrice) *
            Number(product.qty),
        0
      ) +
      Number(amount2 || 0) +
      Number(freightcs || 0);

    const order = new Order({
      soDate: new Date(soDate),
      committedDate: committedDate ? new Date(committedDate) : null,
      status,
      name,
      partyAndAddress,
      city,
      state,
      pinCode,
      contactNo,
      customerEmail,
      customername,
      products,
      paymentTerms,
      amount2: Number(amount2 || 0),
      freightcs,
      installation,
      salesPerson,
      company,
      orderType,
      shippingAddress,
      billingAddress,
      sameAddress,
      total:
        total !== undefined && !isNaN(total) ? Number(total) : calculatedTotal,
    });

    await order.validate();
    const savedOrder = await order.save();
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
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
// Edit an existing order
const editEntry = async (req, res) => {
  try {
    const {
      soDate,
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
      customername,
      products,
      orderType,
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
      ...(customername !== undefined && {
        customername: customername?.trim() || "",
      }),
      ...(products !== undefined && {
        products: products.map((p) => ({
          ...p,
          serialNos: Array.isArray(p.serialNos) ? p.serialNos : [],
          modelNos: Array.isArray(p.modelNos) ? p.modelNos : [],
        })),
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
      ...(orderType !== undefined && {
        orderType: orderType?.trim() || "",
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
        paymentReceived: paymentReceived?.trim() || "",
      }),
      ...(billNumber !== undefined && {
        billNumber: billNumber?.trim() || "",
      }),
    };

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
// Export orders to XLSX
const exportentry = async (req, res) => {
  try {
    const orders = await Order.find().lean();

    // Log the orders to debug
    console.log("Orders fetched:", JSON.stringify(orders, null, 2));

    // Check if orders is an array
    if (!Array.isArray(orders) || orders.length === 0) {
      console.warn("No orders found.");
      const ws = XLSX.utils.json_to_sheet([]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");

      const fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      res.setHeader("Content-Disposition", "attachment; filename=orders.xlsx");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(fileBuffer);
    }

    const formattedEntries = [];

    orders.forEach((entry) => {
      // Check if products array exists; if not, construct a single product from top-level fields
      const products =
        Array.isArray(entry.products) && entry.products.length > 0
          ? entry.products
          : [
              {
                productType: entry.productType || "Not Found",
                size: entry.size || "Not Found",
                spec: entry.spec || "Not Found",
                qty: entry.qty || 0,
                unitPrice: entry.unitPrice || 0,
                serialNos: entry.serialno ? [entry.serialno] : [],
                modelNos: entry.modelNo ? [entry.modelNo] : [],
              },
            ];

      products.forEach((product, index) => {
        formattedEntries.push({
          orderId: entry.orderId || "",
          soDate: entry.soDate ? format(entry.soDate, "yyyy-MM-dd") : "",
          committedDate: entry.committedDate
            ? format(entry.committedDate, "yyyy-MM-dd")
            : "",
          dispatchFrom: entry.dispatchFrom || "",
          status: entry.status || "Pending",
          dispatchDate: entry.dispatchDate
            ? format(entry.dispatchDate, "yyyy-MM-dd")
            : "",
          partyAndAddress: entry.partyAndAddress || "",
          city: entry.city || "",
          state: entry.state || "",
          pinCode: entry.pinCode || "",
          name: entry.name || "",
          contactNo: entry.contactNo || "",
          customerEmail: entry.customerEmail || "",
          customername: entry.customername || "",
          productType: product.productType || "",
          productSize: product.size || "",
          productSpec: product.spec || "",
          productQty: product.qty || 0,
          productUnitPrice: product.unitPrice || 0,
          productSerialNos: Array.isArray(product.serialNos)
            ? product.serialNos.join(", ")
            : "",
          productModelNos: Array.isArray(product.modelNos)
            ? product.modelNos.join(", ")
            : "",
          gst: index === 0 ? entry.gst || 0 : "",
          total: index === 0 ? entry.total || 0 : "",
          paymentTerms: index === 0 ? entry.paymentTerms || "" : "",
          amount2: index === 0 ? entry.amount2 || 0 : "",
          freightcs: index === 0 ? entry.freightcs || "" : "",
          installation: index === 0 ? entry.installation || "" : "",
          installationStatus: index === 0 ? entry.installationStatus || "" : "",
          remarksByInstallation:
            index === 0 ? entry.remarksByInstallation || "" : "",
          dispatchStatus: index === 0 ? entry.dispatchStatus || "" : "",
          salesPerson: index === 0 ? entry.salesPerson || "" : "",
          shippingAddress: index === 0 ? entry.shippingAddress || "" : "",
          billingAddress: index === 0 ? entry.billingAddress || "" : "",
          company: index === 0 ? entry.company || "" : "",
          transporter: index === 0 ? entry.transporter || "" : "",
          transporterDetails: index === 0 ? entry.transporterDetails || "" : "",
          docketNo: index === 0 ? entry.docketNo || "" : "",
          receiptDate: entry.receiptDate
            ? format(entry.receiptDate, "yyyy-MM-dd")
            : "",
          sostatus: index === 0 ? entry.sostatus || "" : "",
          invoiceNo: index === 0 ? entry.invoiceNo || "" : "",
          invoiceDate: entry.invoiceDate
            ? format(entry.invoiceDate, "yyyy-MM-dd")
            : "",
          remarks: index === 0 ? entry.remarks || "" : "",
          fulfillingStatus: index === 0 ? entry.fulfillingStatus || "" : "",
          remarksByProduction:
            index === 0 ? entry.remarksByProduction || "" : "",
          billNumber: index === 0 ? entry.billNumber || "" : "",
          completionStatus: index === 0 ? entry.completionStatus || "" : "",
          fulfillmentDate: entry.fulfillmentDate
            ? format(entry.fulfillmentDate, "yyyy-MM-dd")
            : "",
          remarksByAccounts: index === 0 ? entry.remarksByAccounts || "" : "",
          paymentReceived: index === 0 ? entry.paymentReceived || "" : "",
          orderType: index === 0 ? entry.orderType || "Private order" : "", // Added orderType
        });
      });
    });

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const newEntries = req.body;
    if (!Array.isArray(newEntries) || newEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Array expected.",
      });
    }

    const counter = await Counter.findByIdAndUpdate(
      { _id: "orderId" },
      { $inc: { sequence: newEntries.length } },
      { new: true, upsert: true, session }
    );
    const startSequence = counter.sequence - newEntries.length + 1;

    const validatedEntries = newEntries.map((entry, index) => {
      // Handle products: check if array exists, otherwise construct from top-level fields
      const products =
        Array.isArray(entry.products) && entry.products.length > 0
          ? entry.products.map((p) => ({
              productType: String(p.productType || "Not Found").trim(),
              size: String(p.size || "Not Found").trim(),
              spec: String(p.spec || "Not Found").trim(),
              qty: Number(p.qty) || 0,
              unitPrice: Number(p.unitPrice) || 0,
              serialNos: Array.isArray(p.serialNos)
                ? p.serialNos.map((s) => String(s).trim()).filter(Boolean)
                : String(p.serialNos || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
              modelNos: Array.isArray(p.modelNos)
                ? p.modelNos.map((m) => String(m).trim()).filter(Boolean)
                : String(p.modelNos || "")
                    .split(",")
                    .map((m) => m.trim())
                    .filter(Boolean),
            }))
          : [
              {
                productType: String(entry.productType || "Not Found").trim(),
                size: String(entry.size || "Not Found").trim(),
                spec: String(entry.spec || "Not Found").trim(),
                qty: Number(entry.qty) || 0,
                unitPrice: Number(entry.unitPrice) || 0,
                serialNos: entry.serialno
                  ? [String(entry.serialno).trim()]
                  : [],
                modelNos: entry.modelNo ? [String(entry.modelNo).trim()] : [],
              },
            ];

      if (products.some((p) => !p.productType || p.qty === 0)) {
        throw new Error(`Invalid product data at entry ${index + 1}`);
      }

      // Calculate total if not provided
      const calculatedTotal =
        products.reduce(
          (sum, p) =>
            sum +
            p.qty * p.unitPrice +
            (Number(entry.gst || 0) / 100) * p.unitPrice * p.qty,
          0
        ) +
        Number(entry.amount2 || 0) +
        (entry.freightcs && !isNaN(Number(entry.freightcs))
          ? Number(entry.freightcs)
          : 0);

      return {
        orderId: `PMTO${startSequence + index}`,
        soDate: entry.soDate
          ? parse(entry.soDate, "yyyy-MM-dd", new Date())
          : null,
        committedDate: entry.committedDate
          ? parse(entry.committedDate, "yyyy-MM-dd", new Date())
          : null,
        dispatchFrom: String(entry.dispatchFrom || "").trim() || null,
        status: String(entry.status || "Pending").trim(),
        dispatchDate: entry.dispatchDate
          ? parse(entry.dispatchDate, "yyyy-MM-dd", new Date())
          : null,
        partyAndAddress: String(entry.partyAndAddress || "").trim() || null,
        city: String(entry.city || "").trim() || null,
        state: String(entry.state || "").trim() || null,
        pinCode: String(entry.pinCode || "").trim() || null,
        name: String(entry.name || "").trim() || null,
        contactNo: String(entry.contactNo || "").trim() || null,
        customerEmail: String(entry.customerEmail || "").trim() || null,
        customername: String(entry.customername || "").trim() || null,
        products,
        gst: Number(entry.gst) || 0,
        total: Number(entry.total) || calculatedTotal,
        paymentTerms: String(entry.paymentTerms || "").trim() || null,
        amount2: Number(entry.amount2) || 0,
        freightcs: String(entry.freightcs || "").trim() || null,
        installation: String(entry.installation || "N/A").trim(),
        installationStatus: String(
          entry.installationStatus || "Pending"
        ).trim(),
        remarksByInstallation: String(entry.remarksByInstallation || "").trim(),
        dispatchStatus: String(entry.dispatchStatus || "Not Dispatched").trim(),
        salesPerson: String(entry.salesPerson || "").trim() || null,
        shippingAddress: String(entry.shippingAddress || "").trim() || null,
        billingAddress: String(entry.billingAddress || "").trim() || null,
        company: String(entry.company || "Promark").trim(),
        transporter: String(entry.transporter || "").trim() || null,
        transporterDetails:
          String(entry.transporterDetails || "").trim() || null,
        docketNo: String(entry.docketNo || "").trim() || null,
        receiptDate: entry.receiptDate
          ? parse(entry.receiptDate, "yyyy-MM-dd", new Date())
          : null,
        sostatus: String(entry.sostatus || "Pending for Approval").trim(),
        invoiceNo: String(entry.invoiceNo || "").trim() || null,
        invoiceDate: entry.invoiceDate
          ? parse(entry.invoiceDate, "yyyy-MM-dd", new Date())
          : null,
        remarks: String(entry.remarks || "").trim() || null,
        fulfillingStatus: String(entry.fulfillingStatus || "Pending").trim(),
        remarksByProduction:
          String(entry.remarksByProduction || "").trim() || null,
        billNumber: String(entry.billNumber || "").trim() || null,
        completionStatus: String(
          entry.completionStatus || "In Progress"
        ).trim(),
        fulfillmentDate: entry.fulfillmentDate
          ? parse(entry.fulfillmentDate, "yyyy-MM-dd", new Date())
          : null,
        remarksByAccounts: String(entry.remarksByAccounts || "").trim() || null,
        paymentReceived: String(entry.paymentReceived || "Not Received").trim(),
        orderType:
          String(entry.orderType || "Private order").trim() || "Private order", // Added orderType with default
      };
    });

    const insertedOrders = await Order.insertMany(validatedEntries, {
      session,
    });
    await session.commitTransaction();
    res.status(201).json({
      success: true,
      data: insertedOrders,
      message: `${insertedOrders.length} orders uploaded successfully`,
    });
  } catch (error) {
    await session.abortTransaction();
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
  } finally {
    session.endSession();
  }
};
// Get production orders
const getProductionOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      sostatus: "Approved",
      completionStatus: { $ne: "Complete" },
      fulfillingStatus: { $ne: "Partial Dispatch" },
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
      dispatchStatus: {
        $in: ["Not Dispatched", "Docket Awaited Dispatched", "Dispatched"],
      }, // Include all statuses except "Delivered"
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

// Get installation orders
const getInstallationOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      dispatchStatus: "Delivered", // Only "Delivered" orders move here
      installationStatus: { $ne: "Completed" },
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

// Get accounts orders
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
