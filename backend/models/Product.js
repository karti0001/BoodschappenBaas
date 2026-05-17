const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: 'Overig' },
    brand: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Product', productSchema);
