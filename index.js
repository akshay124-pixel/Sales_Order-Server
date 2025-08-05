require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const multer = require("multer");
const SignupRoute = require("./Router/SignupRoute");
const LoginRoute = require("./Router/LoginRoute");
const dbconnect = require("./utils/dbconnect");
const Routes = require("./Router/Routes");
const Controller = require("./Controller/Logic");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
Controller.initSocket(server);

// CORS configuration
const corsOptions = {
  origin: `${process.env.API_URL}`,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ["Content-Type", "Authorization"],
};
// Serve uploaded files statically (optional, for accessing uploaded files)
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));

// Routes
app.use("/api", Routes);
app.use("/auth", LoginRoute);
app.use("/user", SignupRoute);
// Error handling middleware for Multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: `Multer error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  next();
});
// Start server after DB connection
const PORT = process.env.PORT || 5000;
dbconnect()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`App listening on port ${PORT}!`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
