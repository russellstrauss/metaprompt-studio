export const PROMPT_PLACEHOLDER = '[Insert brand imagery summary here]'

export const defaultDeveloperInstructionTemplate = `You are generating a single final image prompt for an image model.

Use this brand imagery summary only as style guidance:
${PROMPT_PLACEHOLDER}

Requirements:
- Output exactly one prompt string (one paragraph).
- Include only scene/content/style language that belongs inside the final prompt.
- Preserve useful visual constraints from the summary (composition, color, lighting, mood, medium, quality cues).
- Do NOT include meta/instructional language (for example: "create a template", "multiple options", "explanation", "use case", "versatile", "concise", "Firefly friendly", "return only", "prompt template").
- Do NOT include headings, labels, bullets, numbering, or markdown.
- Do NOT mention these instructions.

Return only the final prompt string.`
