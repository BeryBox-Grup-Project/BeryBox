const path = require('path');

if(process.env.NODE_ENV !== 'production') {  
  require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const router = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { isAllowedOrigin } = require('./helpers/origins');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    const error = new Error('Forbidden');
    error.status = 403;
    return callback(error);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(router);
app.use((req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
});
app.use(errorHandler);

module.exports = app;
