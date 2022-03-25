const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const cookieParser = require('cookie-parser');
const { requireAuth, checkUser } = require("./middleware/authMiddleware");
const cors = require("cors");

const app = express();

dotenv.config({ path: "./config.env" });
require("./db/conn");

const PORT = process.env.PORT || 5000;

// middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// view engine
app.set('view engine', 'ejs');

// routes
app.use(authRoutes);

app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});
