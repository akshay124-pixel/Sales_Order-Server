const mongoose = require("mongoose");

const URI =
  "mongodb+srv://mrakshaythakur124:Akshay0001@cluster0.mls7h5e.mongodb.net/Mangement";
const dbconnect = async () => {
  try {
    await mongoose.connect(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Database connected");
  } catch (error) {
    console.error("Error connecting to database:", error.message);
  }
};

module.exports = dbconnect;
