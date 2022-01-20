const mongoose = require("mongoose");
const { isEmail } = require("validator");

const subjectSchema = new mongoose.Schema({
  name:{
    type: String,
    required: [true, "Please enter name of the subject"],
    unique: true
  },
  email: {
    type: String,
    required: [true, "Please enter an email"],
    lowercase: true,
    validate: [isEmail, "Please enter a valid email"],
  },
  code: {
    type: String,
    required: [true, "Please enter this field"],
    unique: true
  },
  status: {
      type: Boolean,
      required: true,
  }
});

const Subject = mongoose.model("subject", subjectSchema);

module.exports = Subject;
