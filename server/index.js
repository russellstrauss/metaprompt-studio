import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Helper to call Azure OpenAI image generation for a single prompt
async function generateImageForPrompt(prompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Missing Azure OpenAI configuration. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_IMAGE_DEPLOYMENT.');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;

  const response = await axios.post(
    url,
    {
      prompt,
      size: '1024x1024',
      n: 1
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = response.data;
  if (!data || !data.data || !data.data[0] || !data.data[0].url) {
    throw new Error('Azure OpenAI image response did not contain an image URL.');
  }

  return data.data[0].url;
}

app.post('/api/generate-images', async (req, res) => {
  try {
    const { prompts } = req.body || {};

    if (!Array.isArray(prompts) || prompts.length !== 3) {
      return res.status(400).json({ error: 'Request body must include a \"prompts\" array with exactly 3 items.' });
    }

    const trimmed = prompts.map((p) => (typeof p === 'string' ? p.trim() : ''));
    if (trimmed.some((p) => !p)) {
      return res.status(400).json({ error: 'All prompts must be non-empty strings.' });
    }

    const images = await Promise.all(trimmed.map((p) => generateImageForPrompt(p)));

    res.json({ images });
  } catch (err) {
    console.error('Error generating images from Azure OpenAI:', err?.response?.data || err.message || err);
    res.status(500).json({
      error: 'Failed to generate images.',
      details: err?.response?.data || err.message || 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`Azure OpenAI image backend listening on http://localhost:${port}`);
});


