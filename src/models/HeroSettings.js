const mongoose = require('mongoose');

const heroSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'home-hero'
    },
    imageUrl: {
      type: String,
      default: '/hero-main.jpg'
    },
    title: {
      type: String,
      default: 'Glow Like Never Before'
    },
    subtitle: {
      type: String,
      default: 'Premium Beauty Products'
    },
    shopButtonText: {
      type: String,
      default: 'Shop Now'
    },
    exploreButtonText: {
      type: String,
      default: 'Explore'
    },
    buttonColor: {
      type: String,
      default: '#FF4D8D'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('HeroSettings', heroSettingsSchema);
