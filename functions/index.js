const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(cors({ origin: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

exports.api = onRequest({ timeoutSeconds: 120, memory: '512MiB' }, app);
