const { Router } = require('express');
const authController = require('../controllers/authController');
const { checkUser, checkAdmin } = require('../middleware/authMiddleware');
const { isResetTokenValid } = require('../middleware/resetTokenMiddleware')
const router = Router();
const multer = require('multer');
const storage = multer.diskStorage({});

const fileFilter = (req, file, cb) => {
  if(file.mimetype.startsWith('image')) //checking file is image file or not
  {
    cb(null, true);
  } 
  else
  {
    cb('invalid image file!', false);
  }
}

const uploads = multer({storage, fileFilter})

router.post('/signup', authController.signup_post);
router.post('/login', authController.login_post);
router.post('/logout', authController.logout_post);
router.post('/addsubject', checkUser, authController.addsubject_post);
router.post('/getsubjects', checkUser, authController.getsubjects_post);
router.post('/addquestion', checkUser, authController.addquestion_post);
router.post('/getquestions', checkUser, authController.getquestions_post);
router.post('/gettopicquestions', checkUser, authController.gettopicquestions_post);
router.post('/removequestion', checkUser, authController.removequestion_post);
router.post('/getstudentsubjects', checkUser, authController.getstudentsubjects_post);
router.post('/uploadimage', checkUser, uploads.single('image'), authController.uploadimage_post);
router.post('/blankquestion', checkUser, authController.blankquestion_post);
router.post('/customquestion', checkUser, authController.customquestion_post);
router.post('/verifyEmail', authController.verifyEmail_post);
router.post('/forgotPassword', authController.forgotPassword_post);
router.post('/reset-password', isResetTokenValid, authController.resetPassword_post);
router.get('/reset-password',isResetTokenValid,  authController.resetPassword_get);
router.get('/reset-password-success', authController.resetPasswordSuccess_get);
router.post('/createquiz', checkUser, authController.createquiz_post);
router.post('/storeresult', checkUser, authController.storeresult_post);
router.get('/getquizes', checkUser, authController.getquizes_get);
router.post('/storequestions', checkUser, authController.storequestions_post);
router.post('/removequizquestion', checkUser, authController.removequizquestion_post);
router.post('/getquizquestions', checkUser, authController.getquizquestions_post);
router.get('/getstudentquizes', checkUser, authController.getstudentquizes_get);
router.post('/getresult', checkUser, authController.getresult_post);
router.post('/removequiz', checkUser, authController.removequiz_post);
router.post('/adminlogin', authController.adminlogin_post);
router.get('/adminlogin', authController.adminlogin_get);
router.get('/adminlogout', checkAdmin, authController.adminlogout_get);
router.get('/firstyear', checkAdmin, authController.firstYear_get);
router.get('/secondyear', checkAdmin, authController.secondYear_get);
router.get('/thirdyear', checkAdmin, authController.thirdYear_get);
router.get('/finalyear', checkAdmin, authController.finalYear_get);
// router.get('/home', checkAdmin, authController.home_get);
router.post('/requestUpgrade', checkUser, authController.requestUpgrade_post);
router.post('/changeYear', checkAdmin, authController.changeYear_post);
router.post('/declineRequest', checkAdmin, authController.declineRequest_post);

module.exports = router;