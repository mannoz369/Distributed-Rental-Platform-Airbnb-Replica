const mongoose = require("mongoose");

const connectDB = async (mongoUrl) => {
  if (!mongoUrl) {
    throw new Error("Notification Service MongoDB URL is not configured.");
  }

  await mongoose.connect(mongoUrl);
  console.log("Notification Service connected to MongoDB");
};

module.exports = connectDB;
