const { Order, Counter } = require("../Models/Schema");
const mongoose = require("mongoose");
const XLSX = require("xlsx");

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

      name,

      city,
      state,
      pinCode,
      contactNo,
      customerEmail,
      customername,
      products,
      orderType,
      report,
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
      Number(freightcs || 0) +
      Number(installation || 0);

    const calculatedPaymentDue =
      calculatedTotal - Number(paymentCollected || 0);

    // Create new order
    const order = new Order({
      soDate: new Date(soDate),

      name,

      city,
      state,
      pinCode,
      contactNo,
      customerEmail,
      customername,
      products,

      freightcs,
      installation,
      report,
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

      dispatchFrom,

      dispatchDate,
      name,

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

      freightcs,
      orderType,
      installation,
      installationStatus,
      remarksByInstallation,
      dispatchStatus,
      salesPerson,
      report,
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

    if (dispatchFrom !== undefined) {
      updateData.dispatchFrom = dispatchFrom?.trim() || null;
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
    if (report !== undefined) {
      updateData.report = report?.trim() || null;
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
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(String(dateStr).trim());
  return isNaN(date.getTime()) ? null : date;
};

const bulkUploadOrders = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const newEntries = req.body;
    if (!Array.isArray(newEntries)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Array expected.",
      });
    }

    // Increment counter for orderIds
    const counter = await Counter.findByIdAndUpdate(
      { _id: "orderId" },
      { $inc: { sequence: newEntries.length } },
      { new: true, upsert: true, session }
    );
    const startSequence = counter.sequence - newEntries.length + 1;

    const validatedEntries = newEntries.map((entry, index) => {
      console.log(
        `Processing entry ${index + 1}:`,
        JSON.stringify(entry, null, 2)
      );

      // Handle products (default to a single product if none provided)
      let products = [];
      if (Array.isArray(entry.products) && entry.products.length > 0) {
        products = entry.products.map((p) => ({
          productType: String(p.productType || "Unknown").trim(),
          size: String(p.size || "N/A").trim(),
          spec: String(p.spec || "N/A").trim(),
          qty: Number(p.qty) || 1,
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
          gst: Number(p.gst) || 0,
        }));
      } else {
        products.push({
          productType: String(entry.productType || "Unknown").trim(),
          size: String(entry.size || "N/A").trim(),
          spec: String(entry.spec || "N/A").trim(),
          qty: Number(entry.qty) || 1,
          unitPrice: Number(entry.unitPrice) || 0,
          serialNos: String(entry.serialNos || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          modelNos: String(entry.modelNos || "")
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
          gst: Number(entry.gst) || 0,
        });
      }

      // Use current date if soDate is missing or invalid
      const parsedSoDate = parseDate(entry.soDate) || new Date();

      // Calculate total if not provided or invalid
      const calculatedTotal =
        products.reduce(
          (sum, p) => sum + p.qty * p.unitPrice * (1 + p.gst / 100),
          0
        ) +
        (entry.freightcs && !isNaN(Number(entry.freightcs))
          ? Number(entry.freightcs)
          : 0);

      return {
        orderId: `PMTO${startSequence + index}`,
        soDate: parsedSoDate,

        dispatchFrom: String(entry.dispatchFrom || "").trim(),

        dispatchDate: parseDate(entry.dispatchDate) || null,
        name: String(entry.name || "").trim(),

        city: String(entry.city || "").trim(),
        state: String(entry.state || "").trim(),
        pinCode: String(entry.pinCode || "").trim(),
        contactNo: String(entry.contactNo || "").trim(),
        customerEmail: String(entry.customerEmail || "").trim(),
        customername: String(entry.customername || "").trim(),
        products,
        total: Number(entry.total) >= 0 ? Number(entry.total) : calculatedTotal,
        paymentCollected: String(entry.paymentCollected || "").trim(),
        paymentMethod: String(entry.paymentMethod || "").trim(),
        paymentDue: String(entry.paymentDue || "").trim(),
        neftTransactionId: String(entry.neftTransactionId || "").trim(),
        chequeId: String(entry.chequeId || "").trim(),
        paymentTerms: String(entry.paymentTerms || "").trim(),

        freightcs: String(entry.freightcs || "").trim(),
        orderType: String(entry.orderType || "Private").trim(),
        installation: String(entry.installation || "N/A").trim(),
        installationStatus: String(
          entry.installationStatus || "Pending"
        ).trim(),
        remarksByInstallation: String(entry.remarksByInstallation || "").trim(),
        dispatchStatus: String(entry.dispatchStatus || "Not Dispatched").trim(),
        salesPerson: String(entry.salesPerson || "").trim(),
        report: String(entry.report || "").trim(),
        company: String(entry.company || "Promark").trim(),
        transporter: String(entry.transporter || "").trim(),
        transporterDetails: String(entry.transporterDetails || "").trim(),
        docketNo: String(entry.docketNo || "").trim(),
        receiptDate: parseDate(entry.receiptDate) || null,
        shippingAddress: String(entry.shippingAddress || "").trim(),
        billingAddress: String(entry.billingAddress || "").trim(),
        invoiceNo: String(entry.invoiceNo || "").trim(),
        invoiceDate: parseDate(entry.invoiceDate) || null,
        fulfillingStatus: String(entry.fulfillingStatus || "Pending").trim(),
        remarksByProduction: String(entry.remarksByProduction || "").trim(),
        remarksByAccounts: String(entry.remarksByAccounts || "").trim(),
        paymentReceived: String(entry.paymentReceived || "Not Received").trim(),
        billNumber: String(entry.billNumber || "").trim(),
        completionStatus: String(
          entry.completionStatus || "In Progress"
        ).trim(),
        fulfillmentDate: parseDate(entry.fulfillmentDate) || null,
        remarks: String(entry.remarks || "").trim(),
        sostatus: String(entry.sostatus || "Pending for Approval").trim(),
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
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors
        ? Object.values(error.errors).map((err) => err.message)
        : [],
    });
  } finally {
    session.endSession();
  }
};

const exportentry = async (req, res) => {
  try {
    const orders = await Order.find().lean();

    if (!Array.isArray(orders) || orders.length === 0) {
      console.warn("No orders found.");
      const ws = XLSX.utils.json_to_sheet([]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");

      const fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=orders_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(fileBuffer);
    }

    const formattedEntries = orders.flatMap((entry) => {
      const products =
        Array.isArray(entry.products) && entry.products.length > 0
          ? entry.products
          : [
              {
                productType: "Not Found",
                size: "N/A",
                spec: "N/A",
                qty: 0,
                unitPrice: 0,
                serialNos: [],
                modelNos: [],
                gst: 0,
              },
            ];

      return products.map((product, index) => ({
        orderId: entry.orderId || "",
        soDate: entry.soDate
          ? new Date(entry.soDate).toISOString().slice(0, 10)
          : "",

        dispatchFrom: entry.dispatchFrom || "",

        dispatchDate: entry.dispatchDate
          ? new Date(entry.dispatchDate).toISOString().slice(0, 10)
          : "",
        name: entry.name || "",

        city: entry.city || "",
        state: entry.state || "",
        pinCode: entry.pinCode || "",
        contactNo: entry.contactNo || "",
        customerEmail: entry.customerEmail || "",
        customername: entry.customername || "",
        productType: product.productType || "",
        size: product.size || "N/A",
        spec: product.spec || "N/A",
        qty: product.qty || 0,
        unitPrice: product.unitPrice || 0,
        serialNos: Array.isArray(product.serialNos)
          ? product.serialNos.join(", ")
          : "",
        modelNos: Array.isArray(product.modelNos)
          ? product.modelNos.join(", ")
          : "",
        gst: product.gst || 0,
        total: index === 0 ? entry.total || 0 : "",
        paymentCollected: index === 0 ? entry.paymentCollected || "" : "",
        paymentMethod: index === 0 ? entry.paymentMethod || "" : "",
        paymentDue: index === 0 ? entry.paymentDue || "" : "",
        neftTransactionId: index === 0 ? entry.neftTransactionId || "" : "",
        chequeId: index === 0 ? entry.chequeId || "" : "",
        paymentTerms: index === 0 ? entry.paymentTerms || "" : "",

        freightcs: index === 0 ? entry.freightcs || "" : "",
        orderType: index === 0 ? entry.orderType || "Private" : "",
        installation: index === 0 ? entry.installation || "N/A" : "",
        installationStatus:
          index === 0 ? entry.installationStatus || "Pending" : "",
        remarksByInstallation:
          index === 0 ? entry.remarksByInstallation || "" : "",
        dispatchStatus:
          index === 0 ? entry.dispatchStatus || "Not Dispatched" : "",
        salesPerson: index === 0 ? entry.salesPerson || "" : "",
        report: index === 0 ? entry.report || "" : "",
        company: index === 0 ? entry.company || "Promark" : "",
        transporter: index === 0 ? entry.transporter || "" : "",
        transporterDetails: index === 0 ? entry.transporterDetails || "" : "",
        docketNo: index === 0 ? entry.docketNo || "" : "",
        receiptDate: entry.receiptDate
          ? new Date(entry.receiptDate).toISOString().slice(0, 10)
          : "",
        shippingAddress: index === 0 ? entry.shippingAddress || "" : "",
        billingAddress: index === 0 ? entry.billingAddress || "" : "",
        invoiceNo: index === 0 ? entry.invoiceNo || "" : "",
        invoiceDate: entry.invoiceDate
          ? new Date(entry.invoiceDate).toISOString().slice(0, 10)
          : "",
        fulfillingStatus:
          index === 0 ? entry.fulfillingStatus || "Pending" : "",
        remarksByProduction: index === 0 ? entry.remarksByProduction || "" : "",
        remarksByAccounts: index === 0 ? entry.remarksByAccounts || "" : "",
        paymentReceived:
          index === 0 ? entry.paymentReceived || "Not Received" : "",
        billNumber: index === 0 ? entry.billNumber || "" : "",
        completionStatus:
          index === 0 ? entry.completionStatus || "In Progress" : "",
        fulfillmentDate: entry.fulfillmentDate
          ? new Date(entry.fulfillmentDate).toISOString().slice(0, 10)
          : "",
        remarks: index === 0 ? entry.remarks || "" : "",
        sostatus: index === 0 ? entry.sostatus || "Pending for Approval" : "",
      }));
    });

    const ws = XLSX.utils.json_to_sheet(formattedEntries);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    const fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
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
