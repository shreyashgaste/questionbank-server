const User = require("../models/User");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const cloudinary = require("../helper/imageUpload");
const {
  generateOTP,
  mailTransport,
  generateEmailTemplate,
  plainEmailTemplate,
  generatePasswordResetTemplate,
  awsConfiguration,
} = require("../utils/mail");
const VerificationToken = require("../models/verificationToken");
const ResetToken = require("../models/resetToken");
const { isValidObjectId } = require("mongoose");
const crypto = require("crypto");
const { createRandomBytes } = require("../utils/commonHelper");
const Quiz = require("../models/Quiz");
const Result = require("../models/Result");
const upgradeYear = require("../models/upgradeYear");
const AWS = require("aws-sdk");

// handle errors
const handleErrors = (err) => {
  let errors = { email: "", password: "" };

  // incorrect email
  if (err.message === "incorrect email") {
    errors.email = "Email is not registered";
  }

  // incorrect password
  if (err.message === "incorrect password") {
    errors.password = "Password is incorrect";
  }

  // duplicate email error
  if (err.code === 11000) {
    errors.email = "Email is already registered";
    return errors;
  }

  // validation errors
  if (err.message.includes("User validation failed")) {
    Object.values(err.errors).forEach(({ properties }) => {
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

// create json web token
const maxAge = 3 * 24 * 60 * 60;
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.SECRET_KEY, {
    expiresIn: maxAge,
  });
};

// controller actions

module.exports.signup_post = async (req, res) => {
  const { name, email, phone, work, password, role, yearOfStudy } = req.body;
  if (!name || !email || !phone || !work || !password || !role)
    return res.json({ error: "Please provide all the details." });
  try {
    const isexist = await User.findOne({ email });
    if (isexist) {
      if (isexist.verified) {
        return res.json({ message: "User already registered, please login!" });
      } else {
        const deleteUser = await User.findOneAndDelete({ email });
      }
    }
    const user = new User({
      name,
      email,
      phone,
      work,
      password,
      role,
      yearOfStudy,
    });

    const OTP = generateOTP();
    const verificationToken = new VerificationToken({
      owner: user._id,
      token: OTP,
    });
    await verificationToken.save();
    await user.save();
    // mailTransport().sendMail({
    //   from: process.env.USER,
    //   to: user.email,
    //   subject: "Verify your email account",
    //   html: generateEmailTemplate(OTP, `${user.name}`),
    // });
    awsConfiguration();
    const ses = new AWS.SES({ region: "ap-south-1" });
    const params = {
      Destination: { ToAddresses: [user.email] },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: generateEmailTemplate(OTP, `${user.name}`),
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Verify your email account",
        },
      },
      Source: process.env.USER,
    };
    ses
      .sendEmail(params)
      .promise()
      .then((val) => {
        console.log(val);
      })
      .catch((err) => {
        console.log(err);
      });
    res.status(201).json({ message: "User registered succesfully", user });
  } catch (err) {
    const errors = handleErrors(err);
    res.status(400).json({ errors });
  }
};

module.exports.verifyEmail_post = async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp.trim())
    return res.json({ error: "Invalid request, missing parameters!" });

  if (!isValidObjectId(userId)) return res.json({ error: "Invalid user id!" });
  try {
    const user = await User.findById(userId);
    if (!user) return res.json({ error: "Sorry, user not found!" });

    if (user.verified)
      return res.json({ error: "This account is already verified!" });

    const token = await VerificationToken.findOne({ owner: user._id });
    if (!token) {
      const deleteUser = await User.findByIdAndDelete(userId);
      return res.json({ error: "Sorry, user not found!" });
    }

    const isMatched = await token.compareToken(otp.trim());
    if (!isMatched) return res.json({ error: "Please provide a valid token!" });

    user.verified = true;
    await VerificationToken.findByIdAndDelete(token._id);
    await user.save();

    // mailTransport().sendMail({
    //   from: process.env.USER,
    //   to: user.email,
    //   subject: "Welcome Email",
    // html: plainEmailTemplate(
    //   `${user.name}`,
    //   "Email Verified Successfully. Thanks for connecting with us!"
    // ),
    // });
    awsConfiguration();
    const ses = new AWS.SES({ region: "ap-south-1" });
    const params = {
      Destination: { ToAddresses: [user.email] },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: plainEmailTemplate(
              `${user.name}`,
              "Email Verified Successfully. Thanks for connecting with us!"
            ),
          },
        },
        Subject: { Charset: "UTF-8", Data: "Welcome Email" },
      },
      Source: process.env.USER,
    };
    ses
      .sendEmail(params)
      .promise()
      .then((val) => {
        console.log(val);
      })
      .catch((err) => {
        console.log(err);
      });
    res.json({ success: true, message: "Your email is verified.", user });
  } catch (error) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.forgotPassword_post = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: "Please provide a valid email." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found, invalid request!" });

    if (user) {
      if (!user.verified) {
        const deleteUser = await User.findOneAndDelete({ email });
        console.log(deleteUser, "deleted");
        return res.json({ error: "User is not registered, please sign-up!" });
      }
    }
    const token = await ResetToken.findOne({ owner: user._id });
    if (token)
      return res.json({
        error: "Only after 10 minutes you can request for another token.",
      });

    const randombytes = await createRandomBytes();
    const resetToken = new ResetToken({ owner: user._id, token: randombytes });
    await resetToken.save();

    // mailTransport().sendMail({
    //   from: process.env.USER,
    //   to: user.email,
    //   subject: "Password Reset",
    // html: generatePasswordResetTemplate(
    //   `https://testmate.herokuapp.com/reset-password?token=${randombytes}&id=${user._id}`
    //   // `http://localhost:5000/reset-password?token=${randombytes}&id=${user._id}`
    // ),
    // });
    awsConfiguration();
    const ses = new AWS.SES({ region: "ap-south-1" });
    const params = {
      Destination: { ToAddresses: [user.email] },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: generatePasswordResetTemplate(
              // `https://testmate.herokuapp.com/reset-password?token=${randombytes}&id=${user._id}`
              `https://testmate.onrender.com/reset-password?token=${randombytes}&id=${user._id}`
              // `http://localhost:5000/reset-password?token=${randombytes}&id=${user._id}`
            ),
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Password Reset",
        },
      },
      Source: process.env.USER,
    };
    ses
      .sendEmail(params)
      .promise()
      .then((val) => {
        console.log(val);
      })
      .catch((err) => {
        console.log(err);
      });
    res.json({
      success: true,
      message: "Password reset link is sent to your email.",
    });
  } catch (error) {
    console.log(error);
    res.json(error);
  }
};

module.exports.resetPassword_post = async (req, res) => {
  const { password } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.json({ error: "User not found!" });

    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword)
      return res.json({ error: "New password must be different." });

    if (password.trim().length < 7 || password.trim().length > 16)
      return res.json({ error: "Password must be 7 to 16 characters long!" });

    user.password = password.trim();
    await user.save();

    await ResetToken.findOneAndDelete({ owner: user._id });

    // mailTransport().sendMail({
    //   from: process.env.USER,
    //   to: user.email,
    //   subject: "Password Reset Success",
    //   html: plainEmailTemplate(
    //     `${user.name}`,
    //     "Password Reset Successfully. Now you can login to your account with your new password!"
    //   ),
    // });

    awsConfiguration();
    const ses = new AWS.SES({ apiVersion: "2010-12-01" });
    const params = {
      Destination: user.email,
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: plainEmailTemplate(
              `${user.name}`,
              "Password Reset Successfully. Now you can login to your account with your new password!"
            ),
          },
        },
        Subject: "Password Reset Success",
      },
      Source: process.env.USER,
    };
    ses
      .sendEmail(params)
      .promise()
      .then((val) => {
        console.log(val);
      })
      .catch((err) => {
        console.log(err);
      });

    res.json({ success: true, message: "Password reset successfully!" });
  } catch (error) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.resetPassword_get = async (req, res) => {
  res.render("reset-password");
};

module.exports.resetPasswordSuccess_get = async (req, res) => {
  res.render("reset-password-success");
};

module.exports.login_post = async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role)
    return res.json({ error: "Must provide email and password" });
  try {
    const isexist = await User.findOne({ email });
    if (isexist) {
      if (!isexist.verified) {
        const deleteUser = await User.findOneAndDelete({ email });
        if (deleteUser)
          return res.json({ error: "User is not registered, please sign-up!" });
      }
    }

    const user = await User.login(email, password, role);
    const token = createToken(user._id);

    let oldTokens = user.tokens || [];
    if (oldTokens.length) {
      oldTokens = oldTokens.filter((t) => {
        const timeDiff = (Date.now() - parseInt(t.signedAt)) / 1000;
        if (timeDiff < 259200) {
          return t;
        }
      });
    }
    await User.findByIdAndUpdate(user._id, {
      tokens: [...oldTokens, { token, signedAt: Date.now().toString() }],
    });
    res.status(201).json({ token, user });
  } catch (err) {
    const errors = handleErrors(err);
    res.json({ errors });
  }
};

module.exports.addsubject_post = async (req, res) => {
  const { name, email, code, status } = req.body;
  if (!name || !email || !code || !status)
    return res.json({ error: "Must provide all the subject details" });
  try {
    const userEmail = req.user.email;
    if (userEmail !== email)
      return res.json({ error: "Please enter your email." });
    if (await Subject.findOne({ name }))
      return res.json({ error: "This course is already registered." });
    if (await Subject.findOne({ code }))
      return res.json({
        error: "Already a course is registered with this code.",
      });

    if (await User.findOne({ email, role: "Teacher" })) {
      const subject = await Subject.create({ name, email, code, status });
      return res.status(201).json({ message: "Subject added successfully" });
    } else {
      return res.json({ error: "Email is not registered as teacher" });
    }
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getsubjects_post = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.json({ error: "Must provide email to get subject details" });
  try {
    const data = await Subject.find({ email });
    if (data.length === 0) return res.json({ error: "No subjects registered" });
    res.status(201).json(data);
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.addquestion_post = async (req, res) => {
  const { topic, questionName, subjectName, choices, answer } = req.body;
  if (!topic || !questionName || !subjectName || !choices || !answer)
    return res.json({ error: "Must provide all the question details" });
  try {
    const addTopic = topic.toLowerCase();
    const subject = await Subject.findOne({ name: subjectName });
    if (!subject) return res.json({ error: "Subject is not registered" });
    const question = await Question.create({
      topic: addTopic,
      questionName: { question: questionName },
      subjectName,
      choices,
      answerName: { answer: answer },
    });
    res.status(201).json({ message: "Question added successfully" });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getquestions_post = async (req, res) => {
  const { subjectName } = req.body;
  if (!subjectName) return res.json({ error: "Must provide subject name." });
  try {
    const data = await Question.find({ subjectName });
    if (data.length == 0) return res.json({ error: "No questions added" });
    data.reverse();
    res.status(201).json(data);
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.gettopicquestions_post = async (req, res) => {
  const { subjectName, topic } = req.body;
  if (!subjectName || !topic)
    return res.json({ error: "Must provide subject name." });
  try {
    const searchTopic = topic.toLowerCase();
    const data = await Question.find({
      subjectName,
      topic: { $regex: searchTopic },
    });
    if (data.length == 0) return res.json({ error: "No questions added" });
    data.reverse();
    res.status(201).json(data);
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.removequestion_post = async (req, res) => {
  const { _id } = req.body;
  if (!_id) return res.json({ error: "Must provide ID of question." });
  try {
    const result = await Question.findOneAndDelete({ _id });
    if (!result) return res.json({ error: "Problem while deletion." });
    res.status(201).json({ message: "Successfully deleted." });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getstudentsubjects_post = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: "Must provide email of student." });
  try {
    const user = await User.findOne({ email, role: "Student" });
    const stream = user.work;
    const teachers = await User.find({ role: "Teacher", work: stream });
    const subjects = [];
    for (let i = 0; i < teachers.length; i++) {
      const teacherEmail = teachers[i].email;
      const r = await Subject.find({ email: teacherEmail });
      if (r) {
        for (let j = 0; j < r.length; j++) {
          subjects.push(r[j].name);
        }
      }
    }
    if (subjects.length === 0)
      return res.json({ error: "No subjects registered for your stream." });
    res.status(201).json(subjects);
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.blankquestion_post = async (req, res) => {
  const { ispermission, subjectName } = req.body;
  if (!ispermission || !subjectName)
    return res.json({ error: "Must provide all the question details" });
  try {
    const subject = await Subject.findOne({ name: subjectName });
    if (!subject) return res.json({ error: "Subject is not registered" });
    const question = await Question.create({
      topic: "abc",
      questionName: { question: "abc" },
      subjectName,
      answerName: { answer: "" },
    });
    res
      .status(201)
      .json({ data: question, message: "Question blank template created." });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.uploadimage_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { title, choiceNumber, questionId, backenddata } = req.body;
  try {
    if (title === "question") {
      const { topic } = req.body;
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: `${questionId}_question`,
        width: 250,
        height: 250,
        crop: "fit",
      });
      const data = await Question.findByIdAndUpdate(questionId, {
        topic,
        questionName: { question: backenddata, questionImage: result.url },
      });
      return res.status(201).json({ data, message: "Successfully added" });
    }

    if (
      title === "choice1" ||
      title === "choice2" ||
      title === "choice3" ||
      title === "choice4" ||
      title === "choice5"
    ) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: `${questionId}_choice_${choiceNumber}`,
        width: 250,
        height: 250,
        crop: "fit",
      });
      const data = await Question.updateOne(
        { _id: questionId },
        {
          $push: { choices: { choice: backenddata, optionImage: result.url } },
        }
      );
      return res.status(201).json({ data, message: "Successfully added" });
    }
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.customquestion_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { title, questionId, backenddata, topic } = req.body;
  try {
    if (title === "question") {
      const addTopic = topic.toLowerCase();
      const data = await Question.findByIdAndUpdate(questionId, {
        topic: addTopic,
        questionName: { question: backenddata },
      });
      return res.status(201).json({ data, message: "Successfully added" });
    }

    if (
      title === "choice1" ||
      title === "choice2" ||
      title === "choice3" ||
      title === "choice4" ||
      title === "choice5"
    ) {
      const data = await Question.updateOne(
        { _id: questionId },
        {
          $push: { choices: { choice: backenddata } },
        }
      );
      return res.status(201).json({ data, message: "Successfully added" });
    }
    if (title === "answer") {
      const r = await Question.findById(questionId);
      if (r.choices[0].optionImage) {
        if (!(backenddata <= r.choices.length))
          return res.json({
            error:
              "You have images as answers, please enter the option number which should be a correct answer!",
          });
        const data = await Question.findByIdAndUpdate(questionId, {
          answerName: {
            answer: " ",
            answerImage: r.choices[backenddata - 1].optionImage,
          },
        });
        return res.status(201).json({ data, message: "Successfully added" });
      }
      const data = await Question.findByIdAndUpdate(questionId, {
        answerName: { answer: backenddata },
      });
      console.log(data);
      return res.status(201).json({ data, message: "Successfully added" });
    }
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.createquiz_post = async (req, res) => {
  const {
    quizName,
    subjectName,
    email,
    passcode,
    starttime,
    endtime,
    duration,
    year,
  } = req.body;
  if (
    !quizName ||
    !subjectName ||
    !email ||
    !passcode ||
    !starttime ||
    !endtime ||
    !duration ||
    !year
  )
    return res.json({ error: "Must provide all the question details" });
  try {
    const quiz = await Quiz.findOne({ quizName, subjectName, email });
    if (quiz)
      return res.json({ error: "Please enter some other name quiz title." });
    const newQuiz = await Quiz.create({
      quizName,
      subjectName,
      year,
      email,
      passcode,
      starttime,
      endtime,
      duration,
    });
    const quizresult = new Result({ quizId: newQuiz._id });
    await quizresult.save();
    res.status(201).json({ message: "Quiz details added successfully" });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getquizes_get = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  try {
    const data = await Quiz.find({ email: user.email });
    if (data.length == 0) return res.json({ error: "No quizes created" });
    res.status(201).json(data);
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getstudentquizes_get = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  try {
    const stream = user.work;
    const yos = user.yearOfStudy;
    console.log(yos);
    const data = await User.find({ work: stream, role: "Teacher" });
    if (data.length === 0)
      return res.json({ error: "No teachers registered with your stream." });
    let qzes = [];
    for (let i = 0; i < data.length; i++) {
      const q = await Quiz.find({
        email: data[i].email,
        year: { $in: [yos, "All Year"] },
      });
      qzes = [...qzes, ...q];
    }
    res.status(201).json(qzes);
  } catch (err) {
    console.log(err);
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.storequestions_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { email, quizId, idstoadd } = req.body;
  try {
    const quiz = await Quiz.findById(quizId);
    if (quiz.email !== email)
      return res.json({ error: "You have no authority to edit this quiz." });
    const oldquestions = quiz.questions;
    const data = await Quiz.findByIdAndUpdate(quizId, {
      questions: [...oldquestions, ...idstoadd],
    });
    res.status(201).json({ message: "Questions added successfully" });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getquizquestions_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { quizId } = req.body;
  try {
    const quiz = await Quiz.findById(quizId);
    if (quiz.questions.length === 0)
      return res.json({ error: "No questions added" });
    if (user.role === "Student") {
      const d = await Result.findOne({
        quizId,
        scores: { $elemMatch: { prn: user.phone } },
      });
      if (d) return res.json({ error: "Already attempted the quiz!" });
      const quizresult = await Result.findOne({ quizId });
      if (!quizresult) return res.json({ error: "Something went wrong!" });
      const setResult = await Result.findByIdAndUpdate(quizresult._id, {
        $push: { scores: { prn: user.phone, score: "0" } },
      });
      if (!setResult) return res.json({ error: "Something went wrong!" });
    }
    const data = await Question.find({ _id: { $in: quiz.questions } });
    res.status(201).json(data);
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.removequizquestion_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { quizId, questId } = req.body;
  try {
    const quiz = await Quiz.findById(quizId);
    if (quiz.questions.length === 0)
      return res.json({ error: "No questions added" });

    const newquestions = quiz.questions.filter((id) => {
      return id !== questId;
    });
    const data = await Quiz.findByIdAndUpdate(quizId, {
      questions: newquestions,
    });
    res.status(201).json({ message: "Successfully removed." });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.removequiz_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { _id } = req.body;
  try {
    const quizresult = await Result.findOneAndDelete({ quizId: _id });
    if (quizresult) {
      const quiz = await Quiz.findByIdAndDelete(_id);
      if (quiz)
        return res.status(201).json({ message: "Successfully removed." });
    }
    res.json({ error: "Something went wrong!" });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.storeresult_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { stuAns, quizId } = req.body;
  if (!quizId) return res.json({ error: "Something went wrong!" });
  try {
    let ids = [];
    let userScore = 0;
    for (let i = stuAns.length - 1; i >= 0; i--) {
      if (
        !ids.find((currentId) => {
          return currentId == stuAns[i].id;
        })
      ) {
        const questionId = stuAns[i].id;
        const r = await Question.findById(questionId);
        if (
          stuAns[i].choosen === r.answerName.answer ||
          stuAns[i].choosen === r.answerName.answerImage
        )
          userScore++;
        ids.push(stuAns[i].id);
      }
    }
    const quizresult = await Result.findOne({ quizId });
    if (!quizresult) return res.json({ error: "Something went wrong!" });
    // const data = await Result.findByIdAndUpdate(quizresult._id, {
    //   $push: { scores: { prn: user.phone, score: userScore } },
    // });
    const data = await Result.updateOne(
      { quizId, scores: { $elemMatch: { prn: user.phone } } },
      {
        $set: { "scores.$.score": userScore },
      }
    );
    if (!data) return res.json({ error: "Something went wrong" });
    res.status(201).json({ message: "Exam submitted successfully" });
  } catch (err) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.getresult_post = async (req, res) => {
  const { user } = req;
  if (!user)
    return res.json({ success: false, message: "unauthorized access!" });
  const { quizId } = req.body;
  try {
    const data = await Result.findOne({ quizId });
    if (!data) return res.json({ error: "Something went wrong!" });
    return res.json(data);
  } catch (error) {
    res.json({ error: "Server traffic error!" });
  }
};

module.exports.logout_post = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.json({ success: false, message: "Authorization fails" });
  if (req.headers && req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    console.log(token);
    if (!token) {
      return res.json({ success: false, message: "Authorization fails" });
    }
    try {
      const user = await User.findOne({ email });
      if (!user)
        return res.json({ success: false, message: "Authorization fails" });

      const tokens = user.tokens;
      // console.log(tokens);
      const newTokens = tokens.filter((t) => t.token !== token);
      await User.findByIdAndUpdate(user._id, { tokens: newTokens });
      res.json({ success: true, message: "Signed-out successfully!" });
    } catch (error) {
      console.log(error, "hi");
      res.json({ message: "Server traffic error!" });
    }
  }
};

module.exports.adminlogin_post = async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);
  try {
    const isexist = await User.findOne({ email });
    if (isexist) {
      if (!isexist.verified) {
        const deleteUser = await User.findOneAndDelete({ email });
        if (deleteUser)
          return res.json({ error: "User is not registered, please sign-up!" });
      }
    }
    const user = await User.login(email, password, "Admin");
    const token = createToken(user._id);
    let oldTokens = user.tokens || [];
    if (oldTokens.length) {
      oldTokens = oldTokens.filter((t) => {
        const timeDiff = (Date.now() - parseInt(t.signedAt)) / 1000;
        if (timeDiff < 259200) {
          return t;
        }
      });
    }
    await User.findByIdAndUpdate(user._id, {
      tokens: [...oldTokens, { token, signedAt: Date.now().toString() }],
    });
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.status(200).json({ user: user._id });
  } catch (err) {
    console.log(err);
    const errors = handleErrors(err);
    res.status(400).json({ errors });
  }
};

// module.exports.home_get = async (req, res) => {
//   res.render("home", {data: []});
// }

module.exports.adminlogin_get = async (req, res) => {
  res.render("adminlogin");
};
module.exports.firstYear_get = async (req, res) => {
  try {
    const data = await upgradeYear.find({ currentYear: "First Year" });
    // if (data.length === 0)
    //  return res.json({ message: "No requests for change in YoS" });
    console.log(data);
    // res.json(data);
    res.render("firstyear", { data });
  } catch (error) {
    console.log(error);
  }
};

module.exports.secondYear_get = async (req, res) => {
  try {
    const data = await upgradeYear.find({ currentYear: "Second Year" });
    // if (data.length === 0)
    // return res.json({ message: "No requests for change in YoS" });
    console.log(data);
    // res.json(data);
    res.render("secondyear", { data });
  } catch (error) {
    console.log(error);
  }
};

module.exports.thirdYear_get = async (req, res) => {
  try {
    const data = await upgradeYear.find({ currentYear: "Third Year" });
    // if (data.length === 0)
    //   return res.json({ message: "No requests for change in YoS" });
    console.log(data);
    // res.json(data);
    res.render("thirdyear", { data });
  } catch (error) {
    console.log(error);
  }
};

module.exports.finalYear_get = async (req, res) => {
  try {
    const data = await upgradeYear.find({ currentYear: "Final Year" });
    // if (data.length === 0)
    //   return res.json({ message: "No requests for change in YoS" });
    console.log(data);
    // res.json(data);
    res.render("finalyear", { data });
  } catch (error) {
    console.log(error);
  }
};

module.exports.requestUpgrade_post = async (req, res) => {
  const { prn, currentYear, nextYear } = req.body;
  const { user } = req;
  if (!prn || !currentYear || !nextYear)
    return res.json({ error: "Please provide all details!" });

  try {
    if (user.phone !== prn || user.yearOfStudy !== currentYear)
      return res.json({ error: "Please provide the correct details!" });
    const newRecord = new upgradeYear({
      prn,
      currentYear,
      nextYear,
    });
    await newRecord.save();
    res.json({ message: "Request sent." });
  } catch (error) {
    console.log(error);
  }
};

module.exports.changeYear_post = async (req, res) => {
  const { prn, changedYear } = req.body;
  if (!prn || !changedYear)
    return res.json({ error: "Please provide all details" });
  try {
    const data = await User.findOneAndUpdate(
      { phone: prn },
      {
        yearOfStudy: changedYear,
      }
    );
    if (data) {
      const del = await upgradeYear.findOneAndDelete({ prn });
      console.log(del);
      if (del) return res.json({ message: "Success" });
    } else return res.json({ error: "Error" });
  } catch (error) {
    console.log(error);
  }
};

module.exports.declineRequest_post = async (req, res) => {
  const { prn } = req.body;
  if (!prn) return res.json({ error: "Please provide all details" });
  try {
    const del = await upgradeYear.findOneAndDelete({ prn });
    if (del) return res.json({ message: "Success" });
    else return res.json({ error: "Error" });
  } catch (error) {
    console.log(error);
  }
};

module.exports.adminlogout_get = (req, res) => {
  // res.cookie("jwt", "", { maxAge: 1 });
  // res.cookie('jwt', " ", {expires: Date.now(0)});
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0),
  });
  res.status(200).send({ message: "Logged Out" });
};