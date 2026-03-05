import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const FIREFLY_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const FIREFLY_GENERATE_URL = 'https://firefly-api.adobe.io/v3/images/generate';
const FIREFLY_SCOPE = 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis';

/** Get Adobe Firefly access token (client credentials). */
async function getFireflyAccessToken() {
  const clientId = process.env.ADOBE_FIREFLY_CLIENT_ID;
  const clientSecret = process.env.ADOBE_FIREFLY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Adobe Firefly configuration. Please set ADOBE_FIREFLY_CLIENT_ID and ADOBE_FIREFLY_CLIENT_SECRET.'
    );
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: FIREFLY_SCOPE,
  });

  const response = await axios.post(FIREFLY_TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const accessToken = response.data?.access_token;
  if (!accessToken) {
    throw new Error('Adobe Firefly token response did not contain access_token.');
  }

  return accessToken;
}

/**
 * Extract a displayable image URL from Firefly generate response.
 * Handles both URL and base64 outputs (returns data URL for base64).
 */
function getImageUrlFromFireflyResponse(data) {
  if (!data) return null;

  // Common sync response: result.outputs[0].image or result.outputs[0].image.base64
  const outputs = data.outputs ?? data.result?.outputs;
  if (Array.isArray(outputs) && outputs.length > 0) {
    const first = outputs[0];
    const img = first?.image ?? first;
    if (typeof img === 'string') {
      if (img.startsWith('data:') || img.startsWith('http')) return img;
      return `data:image/png;base64,${img}`;
    }
    if (img?.url) return img.url;
    if (img?.base64) return `data:image/png;base64,${img.base64}`;
  }

  // Fallback: top-level image
  const image = data.image ?? data.result?.image;
  if (typeof image === 'string') {
    if (image.startsWith('data:') || image.startsWith('http')) return image;
    return `data:image/png;base64,${image}`;
  }
  if (image?.url) return image.url;
  if (image?.base64) return `data:image/png;base64,${image.base64}`;

  return null;
}

/** Call Adobe Firefly Generate Image API for a single prompt. */
async function generateImageForPrompt(prompt, accessToken) {
  const clientId = process.env.ADOBE_FIREFLY_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing ADOBE_FIREFLY_CLIENT_ID.');
  }

  const response = await axios.post(
    FIREFLY_GENERATE_URL,
    {
      prompt,
      size: { width: 1024, height: 1024 },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const url = getImageUrlFromFireflyResponse(response.data);
  if (!url) {
    throw new Error(
      'Adobe Firefly image response did not contain an image URL or base64.'
    );
  }

  return url;
}

app.post('/api/generate-images', async (req, res) => {
  try {
    const { prompts } = req.body || {};

    if (!Array.isArray(prompts) || prompts.length !== 3) {
      return res.status(400).json({
        error: 'Request body must include a "prompts" array with exactly 3 items.',
      });
    }

    const trimmed = prompts.map((p) => (typeof p === 'string' ? p.trim() : ''));
    if (trimmed.some((p) => !p)) {
      return res.status(400).json({
        error: 'All prompts must be non-empty strings.',
      });
    }

    const accessToken = await getFireflyAccessToken();
    const images = await Promise.all(
      trimmed.map((p) => generateImageForPrompt(p, accessToken))
    );

    res.json({ images });
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    const message =
      body?.error_description ??
      body?.error?.message ??
      body?.message ??
      err?.message ??
      'Unknown error';
    console.error('Error generating images from Adobe Firefly:', body || err.message || err);

    res.status(status && status >= 400 && status < 600 ? status : 500).json({
      error: 'Failed to generate images.',
      details: message,
    });
  }
});

app.listen(port, () => {
  console.log(`Adobe Firefly image backend listening on http://localhost:${port}`);
});
