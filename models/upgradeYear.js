const mongoose = require("mongoose");

const upgradeYearSchema = new mongoose.Schema({
 prn: {
     type: String,
     required: true,
 },
 currentYear: {
     type: String,
     required: true,
 },
 nextYear: {
    type: String,
    required: true,
 }
});

module.exports = mongoose.model("UpgradeYear", upgradeYearSchema);

