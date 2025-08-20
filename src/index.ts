import express from 'express';
import { config } from './config';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.listen(config.port, () => {
  console.log(`✅ Server is running on port ${config.port}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
});