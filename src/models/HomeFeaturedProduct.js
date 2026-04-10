const mongoose = require('mongoose');

const homeFeaturedProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('HomeFeaturedProduct', homeFeaturedProductSchema);
