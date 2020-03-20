const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed Login!',
  successRedirect: '/',
  successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
  req.logout();
  req.flash('success', 'You are now logged out! 👋🏼');
  res.redirect('/');
}

// Check Login Middlware
exports.isLoggedIn = (req, res, next) => {
  // Checks if user is logged in (to enable add store)
  if (req.isAuthenticated()) {
    next(); // Carry on! Logged in!
    return;
  }
  req.flash('error', 'Oops, you must be logged in!');
  res.redirect('/login');
};

exports.forgot = async (req, res) => {
  // 1. See if user exists (email)
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash('error', 'No account with that emial exists');
    return res.redirect('/login');
  }
  // 2. Set reset tokens and expiry on account 
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hr from now 
  await user.save();
  // 3. Send an email with token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user, 
    filename: 'password-reset',
    subject: 'Password Reset',
    resetURL
  });
  req.flash('success', `You have been emailed a password reset link. `);
  // 4. redirect to login page 
  res.redirect('/login');
};

exports.reset = async (req, res) => {
  // find user
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  // If the token was wrong || the token expired 
  if (!user) {
    req.flash('error', 'Password rest is invalid or has expired');
    return res.redirect('/login');
  }
  // User EXISTS, shwos reset pwd form
  res.render('reset', { title: 'Reset Your Password'});
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    next(); // keep it going
    return;
  }
  req.flash('error', 'Passwords do not match!');
  res.redirect('back');
};

exports.update = async (req, res) => {
  // find user
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  // If the token was wrong || the token expired 
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired');
    return res.redirect('/login');
  }
  // promise setpassword method
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  // clear reset properties
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updateUser = await user.save();

  await req.login(updateUser);
  req.flash('success', '💃 Nice! Your password has been reset! You are now logged in!');
  res.redirect('/');
};
