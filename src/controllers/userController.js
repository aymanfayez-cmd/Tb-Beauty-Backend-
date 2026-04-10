const User = require('../models/User');

exports.createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'name and email are required' });
    }

    const user = await User.create({ name, email });
    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash -__v').sort({ createdAt: -1 }).lean();
    return res.status(200).json({ users });
  } catch (err) {
    return next(err);
  }
};

