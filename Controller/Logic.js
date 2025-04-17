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
      paymentCollected,
      paymentMethod,
      paymentDue,
      neftTransactionId,
      chequeId,
      remarks,
    } = req.body;

    // Validate required fields
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

    // Validate payment method-specific fields
    if (paymentMethod === "NEFT" && !neftTransactionId) {
      return res.status(400).json({
        error: "Missing NEFT Transaction ID",
        details: "NEFT Transaction ID is required for NEFT payments",
      });
    }

    if (paymentMethod === "Cheque" && !chequeId) {
      return res.status(400).json({
        error: "Missing Cheque ID",
        details: "Cheque ID is required for Cheque payments",
      });
    }

    // Validate product data
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

    // Calculate total
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

    const calculatedPaymentDue =
      calculatedTotal - Number(paymentCollected || 0);

    // Create new order
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
      paymentCollected: String(paymentCollected || ""),
      paymentMethod,
      paymentDue:
        paymentDue !== undefined && !isNaN(paymentDue)
          ? String(paymentDue)
          : String(calculatedPaymentDue),
      neftTransactionId: neftTransactionId || "",
      chequeId: chequeId || "",
      remarks,
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

// Edit an order

const editEntry = async (req, res) => {
  try {
    const {
      soDate,
      committedDate,
      dispatchFrom,
      status,
      dispatchDate,
      name,
      partyAndAddress,
      city,
      state,
      pinCode,
      contactNo,
      customerEmail,
      customername,
      products,
      total,
      paymentCollected,
      paymentMethod,
      paymentDue,
      neftTransactionId,
      chequeId,
      paymentTerms,
      amount2,
      freightcs,
      orderType,
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
      shippingAddress,
      billingAddress,
      invoiceNo,
      invoiceDate,
      fulfillingStatus,
      remarksByProduction,
      remarksByAccounts,
      paymentReceived,
      billNumber,
      completionStatus,
      fulfillmentDate,
      remarks,
      sostatus,
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    // Find existing order
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Prepare update data
    const updateData = {};

    // Handle fields only if provided (partial updates)
    if (soDate !== undefined) {
      const parsedDate = new Date(soDate);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid SO Date" });
      }
      updateData.soDate = parsedDate;
    }

    if (committedDate !== undefined) {
      updateData.committedDate = committedDate ? new Date(committedDate) : null;
    }

    if (dispatchFrom !== undefined) {
      updateData.dispatchFrom = dispatchFrom?.trim() || null;
    }

    if (status !== undefined) {
      updateData.status = status?.trim() || order.status;
    }

    if (dispatchDate !== undefined) {
      updateData.dispatchDate = dispatchDate ? new Date(dispatchDate) : null;
    }

    if (name !== undefined) {
      updateData.name = name?.trim() || null;
    }

    if (partyAndAddress !== undefined) {
      updateData.partyAndAddress = partyAndAddress?.trim() || null;
    }

    if (city !== undefined) {
      updateData.city = city?.trim() || null;
    }

    if (state !== undefined) {
      updateData.state = state?.trim() || null;
    }

    if (pinCode !== undefined) {
      updateData.pinCode = pinCode?.trim() || null;
    }

    if (contactNo !== undefined) {
      updateData.contactNo = contactNo?.trim() || null;
    }

    if (customerEmail !== undefined) {
      updateData.customerEmail = customerEmail?.trim() || null;
    }

    if (customername !== undefined) {
      updateData.customername = customername?.trim() || null;
    }

    if (products !== undefined) {
      updateData.products = products.map((p, index) => {
        if (!p.productType?.trim()) {
          throw new Error(`Product ${index + 1}: Product Type is required`);
        }
        if (p.qty === undefined || isNaN(p.qty) || Number(p.qty) <= 0) {
          throw new Error(
            `Product ${index + 1}: Quantity must be a positive number`
          );
        }
        if (
          p.unitPrice === undefined ||
          isNaN(p.unitPrice) ||
          p.unitPrice < 0
        ) {
          throw new Error(
            `Product ${index + 1}: Unit Price must be a non-negative number`
          );
        }
        return {
          productType: p.productType.trim(),
          size: p.size?.trim() || "N/A",
          spec: p.spec?.trim() || "N/A",
          qty: Number(p.qty),
          unitPrice: Number(p.unitPrice),
          serialNos: Array.isArray(p.serialNos)
            ? p.serialNos.map((s) => s.trim()).filter(Boolean)
            : [],
          modelNos: Array.isArray(p.modelNos)
            ? p.modelNos.map((m) => m.trim()).filter(Boolean)
            : [],
          gst: p.gst !== undefined && !isNaN(p.gst) ? Number(p.gst) : 0,
        };
      });
    }

    if (total !== undefined) {
      if (isNaN(total) || total <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Total must be a positive number" });
      }
      updateData.total = Number(total);
    }

    if (paymentCollected !== undefined) {
      updateData.paymentCollected =
        paymentCollected !== "" && paymentCollected !== null
          ? String(paymentCollected).trim()
          : null;
    }

    if (paymentMethod !== undefined) {
      const validMethods = ["Cash", "NEFT", "RTGS", "Cheque", ""];
      if (paymentMethod && !validMethods.includes(paymentMethod.trim())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Payment Method" });
      }
      updateData.paymentMethod = paymentMethod?.trim() || "";
    }

    if (paymentDue !== undefined) {
      updateData.paymentDue =
        paymentDue !== "" && paymentDue !== null
          ? String(paymentDue).trim()
          : null;
    }

    if (neftTransactionId !== undefined) {
      updateData.neftTransactionId = neftTransactionId?.trim() || null;
    }

    if (chequeId !== undefined) {
      updateData.chequeId = chequeId?.trim() || null;
    }

    if (paymentTerms !== undefined) {
      updateData.paymentTerms = paymentTerms?.trim() || null;
    }

    if (amount2 !== undefined) {
      updateData.amount2 =
        amount2 !== undefined && !isNaN(amount2) ? Number(amount2) : 0;
    }

    if (freightcs !== undefined) {
      updateData.freightcs = freightcs?.trim() || null;
    }

    if (orderType !== undefined) {
      updateData.orderType = orderType?.trim() || order.orderType;
    }

    if (installation !== undefined) {
      updateData.installation = installation?.trim() || "N/A";
    }

    if (installationStatus !== undefined) {
      updateData.installationStatus =
        installationStatus?.trim() || order.installationStatus;
    }

    if (remarksByInstallation !== undefined) {
      updateData.remarksByInstallation = remarksByInstallation?.trim() || "";
    }

    if (dispatchStatus !== undefined) {
      updateData.dispatchStatus =
        dispatchStatus?.trim() || order.dispatchStatus;
    }

    if (salesPerson !== undefined) {
      updateData.salesPerson = salesPerson?.trim() || null;
    }

    if (company !== undefined) {
      updateData.company = company?.trim() || order.company;
    }

    if (transporter !== undefined) {
      updateData.transporter = transporter?.trim() || null;
    }

    if (transporterDetails !== undefined) {
      updateData.transporterDetails = transporterDetails?.trim() || null;
    }

    if (docketNo !== undefined) {
      updateData.docketNo = docketNo?.trim() || null;
    }

    if (receiptDate !== undefined) {
      updateData.receiptDate = receiptDate ? new Date(receiptDate) : null;
    }

    if (shippingAddress !== undefined) {
      updateData.shippingAddress = shippingAddress?.trim() || "";
    }

    if (billingAddress !== undefined) {
      updateData.billingAddress = billingAddress?.trim() || "";
    }

    if (invoiceNo !== undefined) {
      updateData.invoiceNo = invoiceNo?.trim() || null;
    }

    if (invoiceDate !== undefined) {
      updateData.invoiceDate = invoiceDate ? new Date(invoiceDate) : null;
    }

    if (fulfillingStatus !== undefined) {
      updateData.fulfillingStatus =
        fulfillingStatus?.trim() || order.fulfillingStatus;
    }

    if (remarksByProduction !== undefined) {
      updateData.remarksByProduction = remarksByProduction?.trim() || null;
    }

    if (remarksByAccounts !== undefined) {
      updateData.remarksByAccounts = remarksByAccounts?.trim() || null;
    }

    if (paymentReceived !== undefined) {
      updateData.paymentReceived =
        paymentReceived?.trim() || order.paymentReceived;
    }

    if (billNumber !== undefined) {
      updateData.billNumber = billNumber?.trim() || null;
    }

    if (completionStatus !== undefined) {
      updateData.completionStatus =
        completionStatus?.trim() || order.completionStatus;
    }

    if (fulfillmentDate !== undefined) {
      updateData.fulfillmentDate = fulfillmentDate
        ? new Date(fulfillmentDate)
        : null;
    }

    if (remarks !== undefined) {
      updateData.remarks = remarks?.trim() || null;
    }

    if (sostatus !== undefined) {
      updateData.sostatus = sostatus?.trim() || order.sostatus;
    }

    // Additional validations
    if (updateData.paymentMethod === "NEFT" && !updateData.neftTransactionId) {
      return res.status(400).json({
        success: false,
        message: "NEFT Transaction ID is required for NEFT payments",
      });
    }

    if (updateData.paymentMethod === "Cheque" && !updateData.chequeId) {
      return res.status(400).json({
        success: false,
        message: "Cheque ID is required for Cheque payments",
      });
    }

    // Automatic completion status update
    if (
      updateData.fulfillingStatus === "Fulfilled" &&
      order.fulfillingStatus !== "Fulfilled"
    ) {
      updateData.completionStatus = "Complete";
      updateData.fulfillmentDate = updateData.fulfillmentDate || new Date();
    }

    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
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
    if (error.message.includes("Product")) {
      return res.status(400).json({
        success: false,
        message: error.message,
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
