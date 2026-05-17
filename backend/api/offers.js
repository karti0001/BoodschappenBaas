const express = require('express');
const Offer = require('../models/Offer');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const offers = await Offer.find().populate('product').sort({ activeUntil: 1 });
    res.json(offers);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const offer = await Offer.create(req.body);
    const populated = await offer.populate('product');
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
