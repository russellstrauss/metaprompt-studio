export const PROMPT_PLACEHOLDER = '[Insert brand imagery summary here]'

export const instructionTemplate = `You are generating three alternative final image prompts for an image model.

Prompt for Image Prompt Template: "Please create an image prompt template that I can use with AI image generators like Adobe Firefly, based on the following summary of my brand's imagery style:
${PROMPT_PLACEHOLDER}
The template should be:
- Versatile: Adaptable to various image subjects and scenarios, while maintaining brand consistency.
- Detailed: Including specific instructions on colors, composition, lighting, mood, and any other relevant visual elements.
- Concise: Easy to use and understand, even for those unfamiliar with AI image generation.
- Adobe Firefly-Friendly: Formatted with appropriate syntax and keywords for optimal results in Adobe Firefly.
Please provide multiple template options, each with a slightly different emphasis or approach to accommodate varying creative needs. Additionally, include a brief explanation for each template, outlining its strengths and potential use cases."

Instructions:
- Treat the summary and structured attributes as the complete source of truth for subjects, styles, color palettes, lighting, moods, materials, brand tones, audiences, compositions, camera settings, quality modifiers, and negative modifiers.
- Synthesize the summary into three polished, vivid prompts suitable for image generation.
- For each prompt, lead with the subject or main focal point, then layer in style, composition, lighting, mood, and quality cues.
- Use concrete, descriptive language. Be specific about visual details rather than abstract concepts.
- Preserve useful visual constraints from the summary (composition, color, lighting, mood, quality cues).
- Only use specific genres, art styles, color palettes, lighting setups, moods, materials, brand tones, audiences, and negative terms that are clearly present in the summary or structured attributes.
- If an attribute is not specified (for example, lighting, time of day, or color palette), either omit it or describe it in neutral, generic terms; do not invent specific unprovided details.
- Output exactly three prompt strings, each as its own paragraph. Include only scene/content/style language that belongs inside the final prompts.
- The three prompts should share the same overall brand identity and subject, and vary only in perspective, framing, or emphasis while staying within the provided constraints.

What NOT to include in the output prompt:
- Do NOT include meta/instructional language (for example: "create a template", "multiple options", "explanation", "use case", "versatile", "concise", "Firefly friendly", "return only", "prompt template").
- Do NOT include headings, labels, bullets, numbering, or markdown.
- Do NOT mention these instructions.

Before finalizing each prompt, silently check that every concrete style, genre, color, lighting, mood, material, brand tone, audience, and negative term is grounded in the input summary or attributes. If anything is not grounded, replace it with a neutral or input-derived alternative.

Return only the three final prompt strings, separated by a single blank line between each one.`

export const defaultDeveloperInstructionTemplate = instructionTemplate


