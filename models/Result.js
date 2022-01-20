const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true,
  },
  scores: [
    {
      prn: {
        type: String,
      },
      score: {
        type: String,
      },
    },
  ],
});

const Result = mongoose.model("result", resultSchema);

module.exports = Result;
