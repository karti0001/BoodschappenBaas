const mongoose = require('mongoose');

const listItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    category: { type: String, default: 'Overig' },
    notes: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const listSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedToken: { type: String, index: true },
    storePreference: { type: [String], default: [] },
    items: { type: [listItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('List', listSchema);
