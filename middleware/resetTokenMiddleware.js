const User = require('../models/User');
const ResetToken = require('../models/resetToken')
const { isValidObjectId } = require("mongoose");

exports.isResetTokenValid = async (req, res, next) => {
    const { token, id } = req.query;
    if(!token || !id) return res.json({ error: "Invalid request!" });

    if(!isValidObjectId(id)) return res.json({ error: "Invalid user!" });
    
    const user = await User.findById(id)
    if(!user) return res.json({error: "User not found!"});
 
    const resetToken = await ResetToken.findOne({owner: user._id})
    if(!resetToken) return res.json({ error: "Reset token not found!" });

    const isValid = await resetToken.compareToken(token);
    if(!isValid) return res.json({ error: "Reset token is invalid." })

    req.user = user;    
    next();
}