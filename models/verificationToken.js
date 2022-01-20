const mongoose = require("mongoose");
const { isEmail } = require("validator");
const bcrypt = require("bcrypt");

const verificationTokenSchema = new mongoose.Schema({
 owner: {
     type: mongoose.Schema.Types.ObjectId,
     ref: 'User',
     required: true,
 },
 token: {
     type: String,
     required: true,
 },
 createdAt: {
     type: Date,
     expires: '10m',
     default: Date.now
 }
});

// fire a function before doc saved to db
verificationTokenSchema.pre("save", async function (next) {
  if(this.isModified('token')) {
    const salt = await bcrypt.genSalt(12);
    this.token = await bcrypt.hash(this.token, salt);  
  }
  next();
});

// method to compare token
verificationTokenSchema.methods.compareToken = async function (token) {
  const result = await bcrypt.compareSync(token, this.token);
  return result;
};

module.exports = mongoose.model("VerificationToken", verificationTokenSchema);

