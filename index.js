const express = require("express");
const cors = require("cors");
const SignupRoute = require("./Router/SignupRoute");
const LoginRoute = require("./Router/LoginRoute");
const dbconnect = require("./utils/dbconnect");
const Routes = require("./Router/Routes"); // Import the orders routes

const app = express();

// CORS configuration
const port = 5000; // Or 5000, depending on your setup

const corsOptions = {
  origin: "https://sales-order-app-eight.vercel.app",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// Routes
app.use("/api", Routes); // Use the orders routes for /api/orders
app.use("/auth", LoginRoute);
app.use("/user", SignupRoute);

// Start server after DB connection
dbconnect()
  .then(() => {
    app.listen(port, () => {
      console.log(`App listening on port ${port}!`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
