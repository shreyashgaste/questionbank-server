const mongoose = require("mongoose");
const { isEmail } = require("validator");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name:{
    type: String,
    required: true
  },
  email: {
    type: String,
    required: [true, "Please enter an email"],
    unique: true,
    lowercase: true,
    validate: [isEmail, "Please enter a valid email"],
  },
  phone: {
    type: String,
    required: [true, "Please enter this field"],
  },
  work: {
    type: String,
    required: [true, "Please enter this field"]
  },
  password: {
    type: String,
    required: [true, "Please enter a password"],
    minlength: [7, "Minimum password length is 7 characters"],
  },
  role: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
    required: true,
  },
  tokens: [
    {
      type: Object
    }
  ]
});

// fire a function before doc saved to db
userSchema.pre("save", async function (next) {
  if(this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);  
  }
  next();
});

// static method to login user
userSchema.statics.login = async function (email, password, role) {
  const user = await this.findOne({ email, role });
  if (user) {
    const auth = await bcrypt.compare(password, user.password);
    if (auth) {
      return user;
    }
    throw Error("incorrect password");
  }
  throw Error("incorrect email");
};

userSchema.methods.comparePassword = async function (password) {
  const result = await bcrypt.compareSync(password, this.password);
  return result;
}

const User = mongoose.model("user", userSchema);

module.exports = User;
