const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  quizName: {
    type: String,
    required: true,
  },
  subjectName: {
    type: String,
    required: [true, "Please enter the subject name"],
  },
  year: {
    type: String,
    require: true
  },
  email: {
    type: String,
    require: true,
  },
  passcode: {
    type: String,
    required: true,
  },
  questions: [
    String
  ],
  starttime: {
    type: Date,
    required: true,
  },
  endtime: {
    type: Date,
    required: true,
  },
  duration: {
      type: String,
      required: true,
  }
});

const Quiz = mongoose.model("quiz", quizSchema);

module.exports = Quiz;
