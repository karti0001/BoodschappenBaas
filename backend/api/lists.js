const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const List = require('../models/List');
const Product = require('../models/Product');
const Offer = require('../models/Offer');

const router = express.Router();
const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const sanitizeListUpdatePayload = (payload) => {
  const update = {};

  if (typeof payload.title === 'string') {
    update.title = payload.title;
  }

  if (Array.isArray(payload.storePreference)) {
    update.storePreference = payload.storePreference
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (payload.owner && mongoose.isValidObjectId(payload.owner)) {
    update.owner = payload.owner;
  }

  return update;
};
const sanitizeItemUpdatePayload = (payload) => {
  const update = {};

  if (typeof payload.name === 'string') {
    update.name = payload.name;
  }

  if (payload.quantity !== undefined) {
    const parsedQuantity = Number(payload.quantity);
    if (!Number.isNaN(parsedQuantity) && parsedQuantity > 0) {
      update.quantity = parsedQuantity;
    }
  }

  if (typeof payload.category === 'string') {
    update.category = payload.category;
  }

  if (typeof payload.notes === 'string') {
    update.notes = payload.notes;
  }

  return update;
};

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid list id' });
  }
  return next();
});

router.param('itemId', (req, res, next, itemId) => {
  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: 'Invalid item id' });
  }
  return next();
});

router.get('/', async (_req, res, next) => {
  try {
    const lists = await List.find().populate('owner').sort({ updatedAt: -1 });
    res.json(lists);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const list = await List.create(req.body);
    res.status(201).json(list);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id).populate('items.product owner');

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const list = await List.findOneAndUpdate({ _id: toObjectId(req.params.id) }, sanitizeListUpdatePayload(req.body), {
      new: true,
      runValidators: true,
    });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await List.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'List not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/items', async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const itemInput = { ...req.body };

    if (itemInput.product && !mongoose.isValidObjectId(itemInput.product)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    if (itemInput.product && !itemInput.name) {
      const product = await Product.findOne({ _id: toObjectId(itemInput.product) });
      if (product) {
        itemInput.name = product.name;
        itemInput.category = itemInput.category || product.category;
      }
    }

    itemInput.order = list.items.length;
    list.items.push(itemInput);
    await list.save();

    return res.status(201).json(list);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id/items/:itemId', async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const item = list.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    Object.assign(item, sanitizeItemUpdatePayload(req.body));
    await list.save();

    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const item = list.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.deleteOne();
    list.items.forEach((listItem, index) => {
      listItem.order = index;
    });

    await list.save();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    if (!list.sharedToken) {
      list.sharedToken = crypto.randomBytes(12).toString('hex');
      await list.save();
    }

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

    return res.json({
      token: list.sharedToken,
      shareUrl: `${frontendBaseUrl}/shared/${list.sharedToken}`,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/sort', async (req, res, next) => {
  try {
    const { storePreference = [] } = req.body;
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const ranking = new Map(storePreference.map((category, index) => [category.toLowerCase(), index]));

    list.storePreference = storePreference;
    list.items.sort((a, b) => {
      const rankA = ranking.has(a.category.toLowerCase()) ? ranking.get(a.category.toLowerCase()) : Number.MAX_SAFE_INTEGER;
      const rankB = ranking.has(b.category.toLowerCase()) ? ranking.get(b.category.toLowerCase()) : Number.MAX_SAFE_INTEGER;

      if (rankA === rankB) {
        return a.name.localeCompare(b.name);
      }

      return rankA - rankB;
    });

    list.items.forEach((item, index) => {
      item.order = index;
    });

    await list.save();

    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/offers', async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id).select('items');

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const productIds = list.items
      .map((item) => item.product)
      .filter(Boolean);

    const offers = await Offer.find({
      product: { $in: productIds },
      activeUntil: { $gte: new Date() },
    }).populate('product');

    return res.json(offers);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
