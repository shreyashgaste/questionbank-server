const jwt = require('jsonwebtoken');
const User = require("../models/User");
 
const checkUser = (req, res, next) => {
  const { authorization } = req.headers;
  if (authorization) {
    const token = authorization.toString().replace("Bearer ", "");
    jwt.verify(token, process.env.SECRET_KEY, async (err, decodedToken) => {
      if (err) {
        return res.send({error : "You must be logged in"});
      } else {
        const { userId } = decodedToken;
        let user = await User.findById(userId);
        req.user = user;
        next();
      }
    });
  } else {
    req.user = null;
    return res.status(401).send({error : "You must be logged in"});
  }
};


module.exports = { checkUser };