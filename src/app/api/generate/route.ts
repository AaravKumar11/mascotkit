import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { ACCESSORIES, BACKGROUNDS, MOODS, NOSES, OUTLINES, SPECIES, sanitizeConfig } from '@/mascot/config';

const MascotSchema = z.object({
  name: z.string().describe('A short, friendly mascot name'),
  species: z.enum(SPECIES),
  mood: z.enum(MOODS),
  accessory: z.enum(ACCESSORIES),
  background: z.enum(BACKGROUNDS),
  color: z.string().describe('Body color as #rrggbb'),
  accent: z.string().describe('Accent color for ears, snout, accessories, as #rrggbb'),
  ink: z.string().describe('Dark line color for eyes and mouth, as #rrggbb'),
  bgColor: z.string().describe('Soft background color as #rrggbb'),
  cheeks: z.boolean(),
  mouth: z.boolean(),
  nose: z.enum(NOSES),
  outline: z.enum(OUTLINES),
});

const SYSTEM = `You design app mascots from a short description, using a fixed kit of parts.
Pick the species, mood, accessory and colors that best match the description and the app it is for.
Colors must be #rrggbb hex. Keep body colors soft and friendly, the accent a deeper shade of a related hue,
the ink very dark, and the background a pale tint that contrasts with the body.`;

export async function POST(req: Request) {
  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 300) {
    return Response.json({ error: 'Describe your mascot in 300 characters or less.' }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(MascotSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return Response.json({ error: 'Could not design a mascot for that description. Try another.' }, { status: 422 });
    }

    const { name, ...config } = response.parsed_output;
    return Response.json({ name, config: sanitizeConfig(config) });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: 'AI generation needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local.' },
        { status: 501 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'Too many requests. Try again in a moment.' }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: 'The AI service returned an error. Try again.' }, { status: 502 });
    }
    if (err instanceof Error && /api key|apiKey|authToken/i.test(err.message)) {
      return Response.json(
        { error: 'AI generation needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local.' },
        { status: 501 },
      );
    }
    throw err;
  }
}
