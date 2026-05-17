const express = require('express');
const cors = require('cors');

const listsRouter = require('./api/lists');
const productsRouter = require('./api/products');
const offersRouter = require('./api/offers');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/lists', listsRouter);
app.use('/api/products', productsRouter);
app.use('/api/offers', offersRouter);

app.get('/api/shared/:token', async (req, res, next) => {
  try {
    const List = require('./models/List');
    const list = await List.findOne({ sharedToken: req.params.token }).populate('items.product owner');

    if (!list) {
      return res.status(404).json({ message: 'Shared list not found' });
    }

    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.name === 'ValidationError' ? 400 : 500;
  res.status(status).json({
    message: error.message || 'Unexpected server error',
  });
});

module.exports = app;
