const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');

const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(compression());
app.use(cors());
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(morgan('dev'));

// Health check + APIs under /api
app.use('/api', apiRoutes);

// 404 for any other route
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

module.exports = app;

