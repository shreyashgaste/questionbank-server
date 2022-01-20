const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  questionName:{
    question: {
      type: String,
      required: [true, "Please enter name of the subject"],
    },
    questionImage: {
      type: String,
    }
  },
  subjectName: {
    type: String,
    required: [true, "Please enter the subject name"],
  },
  choices: [
    {
      choice: {
          type: String,
        },
        optionImage: {
          type: String,
        }
    }
  ],
  answerName: {
    answer: {
      type: String,
    },
    answerImage: {
      type: String,
    }
  }
});

const Question = mongoose.model("question", questionSchema);

module.exports = Question;
