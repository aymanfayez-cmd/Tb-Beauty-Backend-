const mongoose = require('mongoose');

const categoriesHeroSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'categories-hero'
    },
    imageUrl: {
      type: String,
      default: '/hero-main.jpg'
    },
    title: {
      type: String,
      default: 'Shop by Category'
    },
    subtitle: {
      type: String,
      default: 'Explore Our Collections'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CategoriesHeroSettings', categoriesHeroSettingsSchema);
