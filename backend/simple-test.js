const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8081;

app.use(cors());
app.use(express.json());

app.post('/test', (req, res) => {
  console.log('Test endpoint hit:', req.body);
  res.json({ received: req.body });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
