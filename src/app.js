const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const RiskController = require('./controllers/riskController');

// Initialize Express app
const app = express();
const riskController = new RiskController();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug static file serving
app.use(express.static(path.join(__dirname, '../public'), {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1d',
  redirect: false,
  setHeaders: function (res, path, stat) {
    console.log('Serving static file:', path);
  }
}));

app.get('/', (req, res) => {
  console.log('Root route accessed');
  const filePath = path.join(__dirname, '../public/index.html');
  console.log('Trying to serve:', filePath);
  
  // Check if file exists
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    console.log('File exists, sending...');
    res.sendFile(filePath);
  } else {
    console.log('File does NOT exist!');
    res.status(404).send('HTML file not found');
  }
});

app.get('/health', riskController.getHealthCheck.bind(riskController));
app.post('/api/assess-risk', riskController.assessRisk.bind(riskController));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Construction Risk Assessment API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
});

module.exports = app;
