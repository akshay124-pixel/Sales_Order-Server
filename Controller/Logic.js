const mongoose = require("mongoose");
const XLSX = require("xlsx");
const { Server } = require("socket.io");
const User = require("../Models/Model");
const { Order, Notification } = require("../Models/Schema");
const { sendMail } = require("../utils/mailer");
let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.API_URL,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
  // NEW: Set up MongoDB change stream to watch for Order collection changes
  try {
    const changeStream = Order.watch();
    changeStream.on("change", (change) => {
      console.log("Order collection change detected:", change.operationType);
      // Emit orderUpdate event with relevant data
      io.to("global").emit("orderUpdate", {
        operationType: change.operationType,
        documentId: change.documentKey?._id,
        // Include full document for insert/update, if available
        fullDocument: change.fullDocument || null,
      });
    });

    // Handle change stream errors
    changeStream.on("error", (error) => {
      console.error("Change stream error:", error);
    });

    // Handle change stream close
    changeStream.on("close", () => {
      console.log("Change stream closed");
    });
  } catch (error) {
    console.error("Error setting up change stream:", error);
  }
};

// Shared function to create notifications
function createNotification(req, order, action) {
  const username = req.user?.username || "User";
  const customerName = order.customername || "Unknown";
  const orderId = order.orderId || "N/A";

  return new Notification({
    message: `${action} by ${username} for ${customerName} (Order ID: ${orderId})`,
    timestamp: new Date(),
    isRead: false,
    role: "All",
    userId: req.user?.id || null,
  });
}
// Get all orders
const getAllOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};

    if (userRole === "Admin" || userRole === "SuperAdmin") {
      // Admin can see all orders
      query = {};
    } else {
      // For Sales users, get their own orders plus their team members' orders
      const teamMembers = await User.find({ assignedToLeader: userId }).select(
        "_id"
      );
      const teamMemberIds = teamMembers.map((member) => member._id);

      // Include the leader's own ID in the list
      const allUserIds = [userId, ...teamMemberIds];

      query = {
        $or: [
          { createdBy: { $in: allUserIds } },
          { assignedTo: { $in: allUserIds } },
        ],
      };
    }

    const orders = await Order.find(query)
      .populate({
        path: "createdBy",
        select: "username email assignedToLeader",
        populate: { path: "assignedToLeader", select: "username" },
      })
      .populate({ path: "assignedTo", select: "username email" });
    res.json(orders);
  } catch (error) {
    console.error("Error in getAllOrders:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

const createOrder = async (req, res) => {
  try {
    const {
      name,
      city,
      state,
      pinCode,
      contactNo,
      alterno,
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
      gstno,
      freightstatus,
      installchargesstatus,
      paymentCollected,
      paymentMethod,
      paymentDue,
      neftTransactionId,
      chequeId,
      remarks,
      gemOrderNumber,
      deliveryDate,
      demoDate,
      paymentTerms,
      creditDays,
      dispatchFrom,

      fulfillingStatus,
    } = req.body;
    // Handle file upload
    let poFilePath = "";
    if (req.file) {
      poFilePath = `/Uploads/${req.file.filename}`;
    }
    // Required fields check
    if (orderType === "B2G" && !gemOrderNumber) {
      return res
        .status(400)
        .json({ success: false, error: "Missing GEM Order Number" });
    }

    if (orderType === "Demo" && !demoDate) {
      return res
        .status(400)
        .json({ success: false, error: "Missing Demo Date" });
    }

    if (!paymentTerms && orderType !== "Demo") {
      return res.status(400).json({
        success: false,
        error: "Payment Terms is required for non-Demo orders",
      });
    }

    // Default fulfilling status
    const computedFulfillingStatus =
      fulfillingStatus ||
      (orderType === "Demo" || dispatchFrom !== "Morinda"
        ? "Fulfilled"
        : "Not Fulfilled");

    // Validate dispatch location
    const validDispatchLocations = [
      "Patna",
      "Bareilly",
      "Ranchi",
      "Morinda",
      "Lucknow",
      "Delhi",
      "Jaipur",
      "Rajasthan",
    ];
    if (dispatchFrom && !validDispatchLocations.includes(dispatchFrom)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid dispatchFrom value" });
    }

    // Product validation and normalization
    for (const product of products) {
      if (
        !product.productType ||
        !product.qty ||
        !product.gst ||
        !product.warranty
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid product data",
          details: "Each product must have productType, qty, gst, and warranty",
        });
      }

      if (
        product.productType === "IFPD" &&
        (!product.modelNos || !product.brand)
      ) {
        return res.status(400).json({
          success: false,
          error: "Model Numbers and Brand are required for IFPD products",
        });
      }

      product.warranty =
        product.warranty ||
        (orderType === "B2G"
          ? "As Per Tender"
          : product.productType === "IFPD" && product.brand === "Promark"
          ? "3 Years"
          : "1 Year");

      product.serialNos = Array.isArray(product.serialNos)
        ? product.serialNos
        : [];
      product.modelNos = Array.isArray(product.modelNos)
        ? product.modelNos
        : product.modelNos
        ? product.modelNos.split(",").map((m) => m.trim())
        : [];
      product.brand = product.brand || "";
    }

    // Calculate totals
    const calculatedTotal =
      products.reduce((sum, product) => {
        const qty = Number(product.qty) || 0;
        const unitPrice = Number(product.unitPrice) || 0;
        const gstRate =
          product.gst === "including" ? 0 : Number(product.gst) || 0;
        return sum + qty * unitPrice * (1 + gstRate / 100);
      }, 0) +
      Number(freightcs || 0) +
      Number(installation || 0);

    const calculatedPaymentDue =
      calculatedTotal - Number(paymentCollected || 0);

    // Date formatting
    const formatDateTime = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    };

    // Create new order
    const order = new Order({
      soDate: formatDateTime(new Date()),
      name,
      city,
      state,
      pinCode,
      contactNo,
      alterno,
      customerEmail,
      customername,
      products,
      gstno,
      freightcs,
      freightstatus: freightstatus || "Extra",
      installchargesstatus: installchargesstatus || "Extra",
      installation,
      report,
      salesPerson,
      company,
      orderType: orderType || "B2C",
      shippingAddress,
      billingAddress,
      sameAddress,
      total:
        total !== undefined && !isNaN(total) ? Number(total) : calculatedTotal,
      paymentCollected: String(paymentCollected || ""),
      paymentMethod: paymentMethod || "",
      paymentDue:
        paymentDue !== undefined && !isNaN(paymentDue)
          ? String(paymentDue)
          : String(calculatedPaymentDue),
      neftTransactionId: neftTransactionId || "",
      chequeId: chequeId || "",
      remarks,
      gemOrderNumber: gemOrderNumber || "",
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      paymentTerms: paymentTerms || "",
      demoDate: demoDate ? new Date(demoDate) : null,
      creditDays: creditDays || "",
      createdBy: req.user.id,
      dispatchFrom,
      fulfillingStatus: computedFulfillingStatus,
    });

    // Save order
    const savedOrder = await order.save();

    // Create and emit notification
    const notification = createNotification(
      req,
      savedOrder,
      "New sales order created"
    );
    await notification.save();

    io.to("global").emit("newOrder", {
      _id: savedOrder._id,
      customername: savedOrder.customername,
      orderId: savedOrder.orderId,
      notification,
    });

    res.status(201).json({ success: true, data: savedOrder });
  } catch (error) {
    console.error("Error in createOrder:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: messages,
      });
    }
    res
      .status(500)
      .json({ success: false, error: "Server error", details: error.message });
  }
};

// Edit an existing order
const editEntry = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updateData = req.body;

    // Log request body for debugging
    console.log("Edit request body:", updateData);

    // Fetch existing order
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Define allowed fields for update
    const allowedFields = [
      "soDate",
      "dispatchFrom",
      "dispatchDate",
      "name",
      "city",
      "state",
      "pinCode",
      "contactNo",
      "alterno",
      "customerEmail",
      "customername",
      "products",
      "total",
      "gstno",
      "freightstatus",
      "installchargesstatus",
      "paymentCollected",
      "paymentMethod",
      "paymentDue",
      "neftTransactionId",
      "chequeId",
      "freightcs",
      "orderType",
      "installation",
      "installationStatus",
      "remarksByInstallation",
      "dispatchStatus",
      "salesPerson",
      "report",
      "company",
      "transporter",
      "transporterDetails",
      "docketNo",
      "receiptDate",
      "shippingAddress",
      "billingAddress",
      "sameAddress",
      "invoiceNo",
      "invoiceDate",
      "fulfillingStatus",
      "remarksByProduction",
      "remarksByAccounts",
      "paymentReceived",
      "billNumber",
      "piNumber",
      "remarksByBilling",
      "verificationRemarks",
      "billStatus",
      "completionStatus",
      "fulfillmentDate",
      "remarks",
      "sostatus",
      "gemOrderNumber",
      "deliveryDate",
      "deliveredDate",
      "demoDate",
      "paymentTerms",
      "creditDays",
      "actualFreight",
      "stockStatus",
    ];

    // Create update object with only provided fields
    const updateFields = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === "products") {
          // Validate and merge products
          if (!Array.isArray(updateData.products)) {
            return res.status(400).json({
              success: false,
              error: "Products must be an array",
            });
          }

          // Map incoming products and merge with existing ones
          updateFields.products = updateData.products.map((product, index) => {
            const existingProduct = existingOrder.products[index] || {};
            return {
              productType:
                product.productType || existingProduct.productType || "",
              size: product.size || existingProduct.size || "N/A",
              spec: product.spec || existingProduct.spec || "N/A",
              qty: Number(product.qty) || existingProduct.qty || 1,
              unitPrice:
                product.unitPrice !== undefined && product.unitPrice !== ""
                  ? Number(product.unitPrice)
                  : existingProduct.unitPrice !== undefined
                  ? existingProduct.unitPrice
                  : 0,
              serialNos: Array.isArray(product.serialNos)
                ? product.serialNos
                : existingProduct.serialNos || [],
              modelNos: Array.isArray(product.modelNos)
                ? product.modelNos
                : existingProduct.modelNos || [],
              productCode: Array.isArray(product.productCode)
                ? product.productCode
                : existingProduct.productCode || [],
              gst: product.gst || existingProduct.gst || "18",
              brand: product.brand || existingProduct.brand || "",
              warranty:
                product.warranty || existingProduct.warranty || "1 Year",
            };
          });

          // Validate products
          for (const product of updateFields.products) {
            if (
              !product.productType ||
              product.qty <= 0 ||
              product.unitPrice < 0 ||
              !product.gst ||
              !product.warranty
            ) {
              return res.status(400).json({
                success: false,
                error: "Invalid product data",
                details:
                  "Each product must have valid productType, qty, unitPrice, gst, and warranty",
              });
            }
          }
        } else if (
          field.endsWith("Date") &&
          updateData[field] &&
          !isNaN(new Date(updateData[field]))
        ) {
          // Handle date fields
          updateFields[field] = new Date(updateData[field]);
        } else {
          updateFields[field] = updateData[field];
        }
      }
    }

    // Automatically set completionStatus to "Complete" if fulfillingStatus is "Fulfilled"
    if (updateData.fulfillingStatus === "Fulfilled") {
      updateFields.completionStatus = "Complete";
      if (!updateFields.fulfillmentDate) {
        updateFields.fulfillmentDate = new Date();
      }
    }

    // Set receiptDate if dispatchStatus is "Delivered"
    if (
      updateFields.dispatchStatus === "Delivered" &&
      !updateFields.receiptDate
    ) {
      updateFields.receiptDate = new Date();
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Send confirmation email if sostatus is updated to "Approved"
    if (
      updateFields.sostatus === "Approved" &&
      updatedOrder.customerEmail &&
      existingOrder.sostatus !== "Approved"
    ) {
      try {
        const subject = `Your Order #${
          updatedOrder.orderId || updatedOrder._id
        } is Approved!`;
        const text = `
Dear ${updatedOrder.customername || "Customer"},

We're thrilled to confirm that your order for the following products has been approved! Get ready for an amazing experience with Promark Tech Solutions:

${updatedOrder.products
  .map(
    (p, i) =>
      `${i + 1}. ${p.productType} - Qty: ${p.qty}, Unit Price: ₹${
        p.unitPrice
      }, Brand: ${p.brand}`
  )
  .join("\n")}

Total: ₹${updatedOrder.total || 0}

Let's make it happen! Reach out to us to explore the next steps.

Cheers,
The Promark Tech Solutions Crew
        `;
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Poppins', Arial, sans-serif; background-color: #f0f2f5; margin: 0; padding: 0; }
              .container { max-width: 700px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
              .hero { background: linear-gradient(135deg, #007bff, #00d4ff); padding: 50px 20px; text-align: center; position: relative; }
              .hero h1 { color: #ffffff; font-size: 36px; font-weight: 700; margin: 0; text-shadow: 0 3px 6px rgba(0,0,0,0.3); letter-spacing: 1px; }
              .hero p { color: #ffffff; font-size: 18px; opacity: 0.9; margin: 15px 0; }
              .content { padding: 40px; background-color: #ffffff; }
              .content h2 { color: #1a1a1a; font-size: 26px; font-weight: 600; margin-bottom: 20px; }
              .content p { color: #444444; font-size: 16px; line-height: 1.8; margin: 0 0 25px; }
              .highlight { background: linear-gradient(135deg, #e6f3ff, #d9e9ff); padding: 20px; border-radius: 15px; text-align: center; font-size: 18px; font-weight: 500; color: #333; }
              .products { background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 25px; border-radius: 15px; border: 1px solid #dee2e6; }
              .products ul { list-style: none; padding: 0; margin: 0; }
              .products li { font-size: 16px; color: #333333; margin-bottom: 15px; display: flex; align-items: center; transition: transform 0.3s; }
              .products li:hover { transform: translateX(10px); }
              .products li::before { content: '★'; color: #ffc107; margin-right: 12px; font-size: 18px; }
              .cta-button { display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #28a745, #34c759); color: #ffffff; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: 600; margin: 25px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.3s ease; }
              .cta-button:hover { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(0,0,0,0.4); background: linear-gradient(135deg, #34c759, #28a745); }
              .footer { text-align: center; padding: 30px; background: linear-gradient(135deg, #f1f3f5, #e9ecef); color: #6c757d; font-size: 14px; }
              .footer a { color: #007bff; text-decoration: none; font-weight: 600; }
              .footer a:hover { text-decoration: underline; }
              .social-icons { margin-top: 20px; }
              .social-icons a { margin: 0 12px; display: inline-block; transition: transform 0.3s; }
              .social-icons a:hover { transform: scale(1.2); }
              .social-icons img { width: 28px; height: 28px; }
              @media (max-width: 600px) {
                .container { margin: 15px; }
                .hero h1 { font-size: 28px; }
                .hero p { font-size: 16px; }
                .content { padding: 25px; }
                .content h2 { font-size: 22px; }
                .cta-button { padding: 14px 28px; font-size: 16px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="hero">
                <h1>Order #${
                  updatedOrder.orderId || updatedOrder._id
                } Approved!</h1>
                <p>Your Journey with Promark Tech Solutions Begins!</p>
              </div>
              <div class="content">
                <h2>Dear ${updatedOrder.customername || "Customer"},</h2>
                <p>We're absolutely thrilled to confirm that your order has been approved! You're one step closer to experiencing the awesomeness of your selected products with Promark Tech Solutions.</p>
                <div class="products">
                  <ul>
                    ${updatedOrder.products
                      .map(
                        (p, i) =>
                          `<li><strong>${p.productType}</strong> - Qty: ${p.qty}, Unit Price: ₹${p.unitPrice}, Brand: ${p.brand}</li>`
                      )
                      .join("")}
                  </ul>
                </div>
                <div class="highlight">
                  <p>Total: ₹${updatedOrder.total || 0}</p>
                </div>
                <p>Let's make it happen! Reach out to us to dive into the next steps and unlock the full potential of your order.</p>
                <a href="mailto:support@promarktechsolutions.com" class="cta-button">Contact Us Now</a>
              </div>
              <div class="footer">
                <p>Cheers,<br/>The Promark Tech Solutions Crew</p>
                <p>&copy; 2025 <a href="https://promarktechsolutions.com">Promark Tech Solutions</a>. All rights reserved.</p>
                <div class="social-icons">
                  <a href="https://twitter.com/promarktech"><img src="https://img.icons8.com/color/28/000000/twitter.png" alt="Twitter"></a>
                  <a href="https://linkedin.com/company/promarktechsolutions"><img src="https://img.icons8.com/color/28/000000/linkedin.png" alt="LinkedIn"></a>
                  <a href="https://instagram.com/promarktechsolutions"><img src="https://img.icons8.com/color/28/000000/instagram.png" alt="Instagram"></a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        await sendMail(updatedOrder.customerEmail, subject, text, html);
      } catch (mailErr) {
        console.error(
          "Order confirmation email sending failed:",
          mailErr.message
        );
      }
    }

    // Send email if dispatchStatus is updated to "Dispatched" or "Delivered"
    if (
      (updateFields.dispatchStatus === "Dispatched" ||
        updateFields.dispatchStatus === "Delivered") &&
      updatedOrder.customerEmail
    ) {
      try {
        const statusText =
          updateFields.dispatchStatus === "Dispatched"
            ? "dispatched"
            : "delivered";
        const subject = `Your Order #${
          updatedOrder.orderId || updatedOrder._id
        } Has Been ${
          statusText.charAt(0).toUpperCase() + statusText.slice(1)
        }!`;
        const text = `
Dear ${updatedOrder.customername || "Customer"},

Great news! Your order has been ${statusText}. Here are the details of your order:

${updatedOrder.products
  .map(
    (p, i) =>
      `${i + 1}. ${p.productType} - Qty: ${p.qty}, Unit Price: ₹${
        p.unitPrice
      }, Brand: ${p.brand}, Size: ${p.size}, Spec: ${p.spec}`
  )
  .join("\n")}

Total: ₹${updatedOrder.total || 0}
${
  updateFields.dispatchStatus === "Dispatched"
    ? `Dispatch Date: ${
        updatedOrder.dispatchDate
          ? new Date(updatedOrder.dispatchDate).toLocaleString("en-IN")
          : "N/A"
      }`
    : `Delivery Date: ${
        updatedOrder.receiptDate
          ? new Date(updatedOrder.receiptDate).toLocaleString("en-IN")
          : "N/A"
      }`
}
Transporter: ${updatedOrder.transporter || "N/A"}
Docket No: ${updatedOrder.docketNo || "N/A"}

We're here to support you every step of the way!

Cheers,
The Promark Tech Solutions Crew
        `;
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Poppins', Arial, sans-serif; background-color: #f0f2f5; margin: 0; padding: 0; }
              .container { max-width: 700px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
              .hero { background: linear-gradient(135deg, #ff4b2b, #ff8e53); padding: 50px 20px; text-align: center; position: relative; }
              .hero h1 { color: #ffffff; font-size: 36px; font-weight: 700; margin: 0; text-shadow: 0 3px 6px rgba(0,0,0,0.3); letter-spacing: 1px; }
              .hero p { color: #ffffff; font-size: 18px; opacity: 0.9; margin: 15px 0; }
              .content { padding: 40px; background-color: #ffffff; }
              .content h2 { color: #1a1a1a; font-size: 26px; font-weight: 600; margin-bottom: 20px; }
              .content p { color: #444444; font-size: 16px; line-height: 1.8; margin: 0 0 25px; }
              .highlight { background: linear-gradient(135deg, #ffe8e0, #fff3e0); padding: 20px; border-radius: 15px; text-align: center; font-size: 18px; font-weight: 500; color: #333; }
              .products { background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 25px; border-radius: 15px; border: 1px solid #dee2e6; }
              .products ul { list-style: none; padding: 0; margin: 0; }
              .products li { font-size: 16px; color: #333333; margin-bottom: 15px; display: flex; align-items: center; transition: transform 0.3s; }
              .products li:hover { transform: translateX(10px); }
              .products li::before { content: '★'; color: #ffc107; margin-right: 12px; font-size: 18px; }
              .cta-button { display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #28a745, #34c759); color: #ffffff; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: 600; margin: 25px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.3s ease; }
              .cta-button:hover { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(0,0,0,0.4); background: linear-gradient(135deg, #34c759, #28a745); }
              .footer { text-align: center; padding: 30px; background: linear-gradient(135deg, #f1f3f5, #e9ecef); color: #6c757d; font-size: 14px; }
              .footer a { color: #ff4b2b; text-decoration: none; font-weight: 600; }
              .footer a:hover { text-decoration: underline; }
              .social-icons { margin-top: 20px; }
              .social-icons a { margin: 0 12px; display: inline-block; transition: transform 0.3s; }
              .social-icons a:hover { transform: scale(1.2); }
              .social-icons img { width: 28px; height: 28px; }
              @media (max-width: 600px) {
                .container { margin: 15px; }
                .hero h1 { font-size: 28px; }
                .hero p { font-size: 16px; }
                .content { padding: 25px; }
                .content h2 { font-size: 22px; }
                .cta-button { padding: 14px 28px; font-size: 16px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="hero">
                <h1>Order #${updatedOrder.orderId || updatedOrder._id} ${
          statusText.charAt(0).toUpperCase() + statusText.slice(1)
        }!</h1>
                <p>Exciting Update from Promark Tech Solutions!</p>
              </div>
              <div class="content">
                <h2>Dear ${updatedOrder.customername || "Customer"},</h2>
                <p>Awesome news! Your order has been ${statusText}, bringing you closer to enjoying your products from Promark Tech Solutions. Here's what's in your order:</p>
                <div class="products">
                  <ul>
                    ${updatedOrder.products
                      .map(
                        (p, i) =>
                          `<li><strong>${p.productType}</strong> - Qty: ${p.qty}, Unit Price: ₹${p.unitPrice}, Brand: ${p.brand}, Size: ${p.size}, Spec: ${p.spec}</li>`
                      )
                      .join("")}
                  </ul>
                </div>
                <div class="highlight">
                  <p>Total: ₹${updatedOrder.total || 0}</p>
                  <p>${
                    updateFields.dispatchStatus === "Dispatched"
                      ? `Dispatch Date: ${
                          updatedOrder.dispatchDate
                            ? new Date(
                                updatedOrder.dispatchDate
                              ).toLocaleString("en-IN")
                            : "N/A"
                        }`
                      : `Delivery Date: ${
                          updatedOrder.receiptDate
                            ? new Date(updatedOrder.receiptDate).toLocaleString(
                                "en-IN"
                              )
                            : "N/A"
                        }`
                  }</p>
                  <p>Transporter: ${updatedOrder.transporter || "N/A"}</p>
                  <p>Docket No: ${updatedOrder.docketNo || "N/A"}</p>
                </div>
                <p>We're here to make your experience unforgettable! Reach out if you have any questions or need further assistance.</p>
                <a href="mailto:support@promarktechsolutions.com" class="cta-button">Get in Touch</a>
              </div>
              <div class="footer">
                <p>Cheers,<br/>The Promark Tech Solutions Crew</p>
                <p>&copy; 2025 <a href="https://promarktechsolutions.com">Promark Tech Solutions</a>. All rights reserved.</p>
                <div class="social-icons">
                  <a href="https://twitter.com/promarktech"><img src="https://img.icons8.com/color/28/000000/twitter.png" alt="Twitter"></a>
                  <a href="https://linkedin.com/company/promarktechsolutions"><img src="https://img.icons8.com/color/28/000000/linkedin.png" alt="LinkedIn"></a>
                  <a href="https://instagram.com/promarktechsolutions"><img src="https://img.icons8.com/color/28/000000/instagram.png" alt="Instagram"></a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        await sendMail(updatedOrder.customerEmail, subject, text, html);
      } catch (mailErr) {
        console.error(
          `${updateFields.dispatchStatus} email sending failed:`,
          mailErr.message
        );
      }
    }

    // Create and save notification
    const notification = new Notification({
      message: `Order updated by ${req.user?.username || "Unknown User"} for ${
        updatedOrder.customername || "Unknown"
      } (Order ID: ${updatedOrder.orderId || "N/A"})`,
      timestamp: new Date(),
      isRead: false,
      role: "All",
      userId: req.user?.id || null,
    });
    await notification.save();

    // Emit notification with standardized structure
    const notificationData = {
      id: notification._id.toString(),
      message: notification.message,
      timestamp: notification.timestamp.toISOString(),
      isRead: notification.isRead,
      role: notification.role,
    };

    io.to("global").emit("updateOrder", {
      _id: updatedOrder._id,
      customername: updatedOrder.customername,
      orderId: updatedOrder.orderId,
      notification: notificationData,
    });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error("Error in editEntry:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message,
    });
  }
};
// Delete an order
const DeleteData = async (req, res) => {
  try {
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

    if (
      req.user.role === "Sales" &&
      order.createdBy.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to delete this order" });
    }

    // Delete the order
    await Order.findByIdAndDelete(req.params.id);

    // Create and save notification
    const notification = createNotification(req, order, "Order deleted");
    await notification.save();

    // Emit notification
    io.to("global").emit("deleteOrder", {
      _id: order._id,
      customername: order.customername,
      orderId: order.orderId,
      notification,
    });

    res
      .status(200)
      .json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

// Parse date strings
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(String(dateStr).trim());
  return isNaN(date.getTime()) ? null : date;
};

// Bulk upload orders
const bulkUploadOrders = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const orders = [];
    const validDispatchLocations = [
      "Patna",
      "Bareilly",
      "Ranchi",
      "Morinda",
      "Lucknow",
      "Delhi",
      "Jaipur",
      "Rajasthan",
    ];

    for (const row of jsonData) {
      const products = [
        {
          productType: row["Product Type"] || "",
          size: row["Size"] || "N/A",
          spec: row["Specification"] || "N/A",
          qty: Number(row["Quantity"]) || 0,
          unitPrice: Number(row["Unit Price"]) || 0,
          gst: row["GST"] || "18",
          modelNos: row["Model Nos"]
            ? String(row["Model Nos"])
                .split(",")
                .map((m) => m.trim())
            : [],
          brand: row["Brand"] || "",
          warranty:
            row["Warranty"] ||
            (row["Order Type"] === "B2G"
              ? "As Per Tender"
              : row["Product Type"] === "IFPD" && row["Brand"] === "Promark"
              ? "3 Years"
              : "1 Year"),
        },
      ];

      // Validate products
      for (const product of products) {
        if (
          !product.productType ||
          !product.qty ||
          !product.unitPrice ||
          !product.gst ||
          !product.warranty
        ) {
          return res.status(400).json({
            success: false,
            error: `Invalid product data in row: ${JSON.stringify(row)}`,
          });
        }
        if (
          isNaN(Number(product.qty)) ||
          Number(product.qty) <= 0 ||
          isNaN(Number(product.unitPrice)) ||
          (product.gst !== "including" && isNaN(Number(product.gst)))
        ) {
          return res.status(400).json({
            success: false,
            error: `Invalid product data in row: ${JSON.stringify(row)}`,
          });
        }
        if (
          product.productType === "IFPD" &&
          (!product.modelNos || !product.brand)
        ) {
          return res.status(400).json({
            success: false,
            error: `Model Numbers and Brand are required for IFPD products in row: ${JSON.stringify(
              row
            )}`,
          });
        }
      }

      // Calculate total
      const calculatedTotal =
        products.reduce((sum, product) => {
          const qty = Number(product.qty) || 0;
          const unitPrice = Number(product.unitPrice) || 0;
          const gstRate =
            product.gst === "including" ? 0 : Number(product.gst) || 0;
          return sum + qty * unitPrice * (1 + gstRate / 100);
        }, 0) +
        Number(row["Freight Charges"] || 0) +
        Number(row["Installation Charges"] || 0);

      const calculatedPaymentDue =
        calculatedTotal - Number(row["Payment Collected"] || 0);

      // Validate dispatchFrom
      if (
        row["Dispatch From"] &&
        !validDispatchLocations.includes(row["Dispatch From"])
      ) {
        return res.status(400).json({
          success: false,
          error: `Invalid dispatchFrom value in row: ${JSON.stringify(row)}`,
        });
      }

      // Create order object
      const order = {
        soDate: row["SO Date"] ? new Date(row["SO Date"]) : new Date(),
        dispatchFrom: row["Dispatch From"] || "",
        name: row["Contact Person Name"] || "",
        city: row["City"] || "",
        state: row["State"] || "",
        pinCode: row["Pin Code"] || "",
        contactNo: row["Contact No"] || "",
        alterno: row["Alternate No"] || "",
        customerEmail: row["Customer Email"] || "",
        customername: row["Customer Name"] || "",
        products,
        total: calculatedTotal,
        gstno: row["GST No"] || "",
        freightcs: row["Freight Charges"] || "",
        freightstatus: row["Freight Status"] || "Extra",
        installchargesstatus: row["Installation Charges Status"] || "Extra",
        installation: row["Installation Charges"] || "N/A",
        report: row["Reporting Manager"] || "",
        salesPerson: row["Sales Person"] || "",
        company: row["Company"] || "Promark",
        orderType: row["Order Type"] || "B2C",
        shippingAddress: row["Shipping Address"] || "",
        billingAddress: row["Billing Address"] || "",
        sameAddress: row["Same Address"] === "Yes" || false,
        paymentCollected: String(row["Payment Collected"] || ""),
        paymentMethod: row["Payment Method"] || "",
        paymentDue: String(calculatedPaymentDue),
        neftTransactionId: row["NEFT Transaction ID"] || "",
        chequeId: row["Cheque ID"] || "",
        remarks: row["Remarks"] || "",
        gemOrderNumber: row["GEM Order Number"] || "",
        deliveryDate: row["Delivery Date"]
          ? new Date(row["Delivery Date"])
          : null,
        paymentTerms: row["Payment Terms"] || "",
        creditDays: row["Credit Days"] || "",
        createdBy: req.user.id,
      };

      orders.push(order);
    }

    // Save orders
    const savedOrders = await Order.insertMany(orders);

    // Emit newOrder events
    savedOrders.forEach((order) => {
      io.emit("newOrder", {
        _id: order._id,
        customername: order.customername,
        orderId: order.orderId,
      });
    });

    res.status(201).json({
      success: true,
      message: "Orders uploaded successfully",
      data: savedOrders,
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
    res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message,
    });
  }
};

// Export orders to Excel
const exportentry = async (req, res) => {
  try {
    const { role, id } = req.user;
    let orders;

    if (role === "Admin" || role === "SuperAdmin") {
      orders = await Order.find().lean();
    } else if (role === "Sales") {
      // For Sales users, get their own orders plus their team members' orders
      const teamMembers = await User.find({ assignedToLeader: id }).select(
        "_id"
      );
      const teamMemberIds = teamMembers.map((member) => member._id);
      const allUserIds = [id, ...teamMemberIds];

      orders = await Order.find({
        $or: [
          { createdBy: { $in: allUserIds } },
          { assignedTo: { $in: allUserIds } },
        ],
      }).lean();
    } else {
      orders = await Order.find().lean();
    }

    if (!Array.isArray(orders) || orders.length === 0) {
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

    // Format entries for Excel
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
                brand: "",
              },
            ];

      return products.map((product, index) => {
        const entryData = {
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
          alterno: entry.alterno || "",
          customerEmail: entry.customerEmail || "",
          customername: entry.customername || "",
        };

        const productData = {
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
          brand: product.brand || "",
        };

        const conditionalData =
          index === 0
            ? {
                total: entry.total || 0,
                paymentCollected: entry.paymentCollected || "",
                paymentMethod: entry.paymentMethod || "",
                paymentDue: entry.paymentDue || "",
                neftTransactionId: entry.neftTransactionId || "",
                chequeId: entry.chequeId || "",
                freightcs: entry.freightcs || "",
                freightstatus: entry.freightstatus || "",
                installchargesstatus: entry.installchargesstatus || "",
                gstno: entry.gstno || "",
                orderType: entry.orderType || "Private",
                installation: entry.installation || "N/A",
                installationStatus: entry.installationStatus || "Pending",
                remarksByInstallation: entry.remarksByInstallation || "",
                dispatchStatus: entry.dispatchStatus || "Not Dispatched",
                salesPerson: entry.salesPerson || "",
                report: entry.report || "",
                company: entry.company || "Promark",
                transporter: entry.transporter || "",
                transporterDetails: entry.transporterDetails || "",
                docketNo: entry.docketNo || "",
                shippingAddress: entry.shippingAddress || "",
                billingAddress: entry.billingAddress || "",
                invoiceNo: entry.invoiceNo || "",
                fulfillingStatus: entry.fulfillingStatus || "Pending",
                remarksByProduction: entry.remarksByProduction || "",
                remarksByAccounts: entry.remarksByAccounts || "",
                paymentReceived: entry.paymentReceived || "Not Received",
                billNumber: entry.billNumber || "",
                piNumber: entry.piNumber || "",
                remarksByBilling: entry.remarksByBilling || "",
                verificationRemarks: entry.verificationRemarks || "",
                billStatus: entry.billStatus || "Pending",
                completionStatus: entry.completionStatus || "In Progress",
                remarks: entry.remarks || "",
                sostatus: entry.sostatus || "Pending for Approval",
              }
            : {
                total: "",
                paymentCollected: "",
                paymentMethod: "",
                paymentDue: "",
                neftTransactionId: "",
                chequeId: "",
                freightcs: "",
                freightstatus: "",
                installchargesstatus: "",
                gstno: "",
                orderType: "",
                installation: "",
                installationStatus: "",
                remarksByInstallation: "",
                dispatchStatus: "",
                salesPerson: "",
                report: "",
                company: "",
                transporter: "",
                transporterDetails: "",
                docketNo: "",
                shippingAddress: "",
                billingAddress: "",
                invoiceNo: "",
                fulfillingStatus: "",
                remarksByProduction: "",
                remarksByAccounts: "",
                paymentReceived: "",
                billNumber: "",
                piNumber: "",
                remarksByBilling: "",
                verificationRemarks: "",
                billStatus: "",
                completionStatus: "",
                remarks: "",
                sostatus: "",
              };

        const dateData = {
          receiptDate: entry.receiptDate
            ? new Date(entry.receiptDate).toISOString().slice(0, 10)
            : "",
          invoiceDate: entry.invoiceDate
            ? new Date(entry.invoiceDate).toISOString().slice(0, 10)
            : "",
          fulfillmentDate: entry.fulfillmentDate
            ? new Date(entry.fulfillmentDate).toISOString().slice(0, 10)
            : "",
        };

        return {
          ...entryData,
          ...productData,
          ...conditionalData,
          ...dateData,
        };
      });
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
    console.error("Error in exportentry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export orders",
      error: error.message,
    });
  }
};

// Fetch finished goods orders
const getFinishedGoodsOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      fulfillingStatus: "Fulfilled",
      dispatchStatus: { $ne: "Delivered" },
    }).populate("createdBy", "username email");
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getFinishedGoodsOrders:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch finished goods orders",
      error: error.message,
    });
  }
};
// Fetch verification orders
const getVerificationOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      paymentTerms: { $in: ["100% Advance", "Partial Advance"] },
      sostatus: { $nin: ["Accounts Approved", "Approved"] },
    }).populate("createdBy", "username email");
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getVerificationOrders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification orders",
      error: error.message,
    });
  }
};
// Fetch bill orders
const getBillOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      sostatus: "Approved",
      billStatus: { $ne: "Billing Complete" },
    }).populate("createdBy", "username email");
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getBillOrders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bill orders",
      error: error.message,
    });
  }
};
// Fetch installation orders

const getInstallationOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      dispatchStatus: "Delivered",
      installationStatus: {
        $in: ["Pending", "In Progress", "Site Not Ready", "Hold"],
      },
    }).populate("createdBy", "username email");

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getInstallationOrders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch installation orders",
      error: error.message,
    });
  }
};

// Fetch accounts orders
const getAccountsOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      installationStatus: "Completed",
      paymentReceived: { $ne: "Received" }, // Not equal to "Received"
    }).populate("createdBy", "username email");

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getAccountsOrders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch accounts orders",
      error: error.message,
    });
  }
};
// Fetch production approval orders
const getProductionApprovalOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { sostatus: "Accounts Approved" }, // Include all orders with sostatus "Accounts Approved"
        {
          $and: [
            { sostatus: "Pending for Approval" }, // Include orders with sostatus "Pending for Approval"
            { paymentTerms: "Credit" }, // Only if paymentTerms is "Credit"
          ],
        },
      ],
    }).populate("createdBy", "username email");
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in getProductionApprovalOrders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production approval orders",
      error: error.message,
    });
  }
};

// Fetch production orders
const getProductionOrders = async (req, res) => {
  try {
    const dispatchFromOptions = [
      "Patna",
      "Bareilly",
      "Ranchi",
      "Lucknow",
      "Delhi",
      "Jaipur",
      "Rajasthan",
    ];

    const orders = await Order.find({
      sostatus: "Approved",
      dispatchFrom: { $nin: dispatchFromOptions },
      fulfillingStatus: { $ne: "Fulfilled" },
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

// Notifictions

const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }
    console.log("Fetching notifications for user:", req.user.id);
    const notifications = await Notification.find({ role: "All" })
      .sort({ timestamp: -1 })
      .limit(50);
    console.log("Notifications found:", notifications.length);
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Error in getNotifications:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Mark notifications as read
const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ role: "All" }, { isRead: true });
    res
      .status(200)
      .json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    console.error("Error in markNotificationsRead:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};

// Clear notifications
const clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ role: "All" });
    res.status(200).json({ success: true, message: "Notifications cleared" });
  } catch (error) {
    console.error("Error in clearNotifications:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to clear notifications",
      error: error.message,
    });
  }
};

// Assign user to team (fixed notification usage)
const getCurrentUser = async (req, res) => {
  try {
    console.log("Attempting to fetch user with ID:", req.user.id); // Debug log
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch current user",
      error: error.message,
    });
  }
};

// Fixed fetchAvailableUsers function
const fetchAvailableUsers = async (req, res) => {
  try {
    console.log("Fetching available users for role Sales and Admin"); // Debug log
    const users = await User.find({
      assignedToLeader: null,
      _id: { $ne: req.user.id }, // Changed from req.user.userId
      role: { $in: ["Sales", "Admin", "SuperAdmin"] }, // Modified to include both Sales and Admin roles
    }).select("username email");
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching available users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available users",
      error: error.message,
    });
  }
};

// Fixed fetchMyTeam function
const fetchMyTeam = async (req, res) => {
  try {
    console.log("Fetching team members for leader ID:", req.user.id); // Debug log
    const team = await User.find({ assignedToLeader: req.user.id })
      .select("username email assignedToLeader")
      .populate("assignedToLeader", "username");
    res.json({ success: true, data: team });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
      error: error.message,
    });
  }
};

// Fixed assignUser function
const assignUser = async (req, res) => {
  const { userId } = req.body;
  try {
    console.log("Assigning user ID:", userId, "by leader ID:", req.user.id); // Debug log
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (targetUser.assignedToLeader) {
      return res
        .status(400)
        .json({ success: false, message: "User already assigned to a team" });
    }
    if (targetUser._id.equals(req.user.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot assign yourself" });
    }
    targetUser.assignedToLeader = req.user.id;
    await targetUser.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("teamUpdate", {
        userId: targetUser._id,
        leaderId: req.user.id,
        action: "assign",
      });
    }

    res.json({ success: true, message: "User assigned successfully" });
  } catch (error) {
    console.error("Error assigning user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign user",
      error: error.message,
    });
  }
};

// Fixed unassignUser function
const unassignUser = async (req, res) => {
  const { userId } = req.body;
  try {
    console.log("Unassigning user ID:", userId, "by leader ID:", req.user.id); // Debug log
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (
      !targetUser.assignedToLeader ||
      !targetUser.assignedToLeader.equals(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not the leader of this user",
      });
    }
    targetUser.assignedToLeader = null;
    await targetUser.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("teamUpdate", {
        userId: targetUser._id,
        leaderId: req.user.id,
        action: "unassign",
      });
    }

    res.json({ success: true, message: "User unassigned successfully" });
  } catch (error) {
    console.error("Error unassigning user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unassign user",
      error: error.message,
    });
  }
};
module.exports = {
  initSocket,
  unassignUser,
  assignUser,
  fetchMyTeam,
  fetchAvailableUsers,
  getAllOrders,
  createOrder,
  editEntry,
  DeleteData,
  bulkUploadOrders,
  exportentry,
  getCurrentUser,
  getFinishedGoodsOrders,
  getVerificationOrders,
  getProductionApprovalOrders,
  getBillOrders,
  getInstallationOrders,
  getAccountsOrders,
  getProductionOrders,
  getNotifications,
  markNotificationsRead,
  clearNotifications,
};
