const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    store: { type: String, required: true },
    title: { type: String, required: true },
    discountText: { type: String, required: true },
    activeUntil: { type: Date, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Offer', offerSchema);
