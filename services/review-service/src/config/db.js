const mongoose = require("mongoose");

const connectDB = async (mongoUrl) => {
  await mongoose.connect(mongoUrl);
};

module.exports = connectDB;
