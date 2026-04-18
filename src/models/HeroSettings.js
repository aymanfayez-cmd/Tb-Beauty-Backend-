const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    shopButtonText: { type: String, default: '' },
    buttonColor: { type: String, default: '#FF4D8D' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

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
    },
    slides: {
      type: [heroSlideSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('HeroSettings', heroSettingsSchema);
