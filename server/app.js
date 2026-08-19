require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const router = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const allowedOrigins = [process.env.CLIENT_ORIGIN, process.env.CMS_ORIGIN].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('Forbidden');
    error.status = 403;
    return callback(error);
  },
}));
app.use(express.json());
app.use(router);
app.use((req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
});
app.use(errorHandler);

module.exports = app;
