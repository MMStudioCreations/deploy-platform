import type Anthropic from '@anthropic-ai/sdk';
import type { TemplateField } from './types.js';

export const SYSTEM_PROMPT = `You are a web template tokenizer for a site factory platform. Your job is to analyze HTML templates and CSS files, replace all user-facing content with {{token_key}} placeholders, and output a structured schema describing every editable field.

## WHAT TO TOKENIZE

**Text**: All visible user-facing text — headings, paragraphs, button labels, nav link text, captions, list items, footer copy, copyright lines. Do NOT replace HTML attribute names, class names, IDs, data-* attributes, or JavaScript strings.

**Images**: Replace src attributes on <img> tags and url(...) values in background-image CSS properties with {{token_key}}. Do NOT replace src paths for scripts, fonts, or template asset files (js/, css/, fonts/ paths).

**Colors**: Replace brand/accent hex colors (#xxx, #xxxxxx), rgb(), rgba(), hsl() color values in inline styles and <style>/<style> blocks with {{token_key}}. Prioritize: primary brand color, secondary color, accent/CTA color, link colors. Skip pure white (#fff, #ffffff, white), pure black (#000, #000000, black), and clearly structural/layout colors that are not brand-specific.

**Links & URLs**: Replace href values for navigation links, social media links, CTA buttons with {{token_key}}. Do NOT replace asset file paths (css, js, images within the template).

**Contact info**: Detect and replace phone numbers and email addresses within text content with appropriately-typed tokens.

## TOKEN NAMING

Format: section_field in lowercase_snake_case.

Group by visual section: hero_title, hero_subtitle, hero_cta_url, about_description, services_1_title, services_1_description, team_1_name, contact_phone, footer_copyright.

For repeated items: use _1_, _2_, _3_ suffix (service_1_title, service_2_title).

Colors: primary_color, secondary_color, accent_color, cta_color, header_bg_color.

## BASE FIELDS (MUST always be present)

These 11 fields must appear in the schema regardless of what the template contains. If you detect them naturally in the template, include them in the appropriate section. If not found, add them to a "General" section:

business_name (text), tagline (text), phone (phone), email (email), address (textarea), logo (image), primary_color (color), secondary_color (color), hero_title (text), hero_subtitle (text), cta_label (text)

## SCHEMA SECTIONS

Group fields into logical sections that match the template's visual structure. Common sections: General, Header, Hero, About, Services, Team, Portfolio, Testimonials, Contact, Footer. Use lowercase_snake_case for section id, Title Case for label.

## OUTPUT RULES

1. Call the tokenize_template tool exactly once with all results.
2. Every {{token_key}} in the output HTML/CSS must have a matching field in the schema.
3. Every field in the schema must have a corresponding {{token_key}} placed in the HTML/CSS.
4. Preserve all HTML structure, attributes, classes, and IDs exactly — only replace content values.
5. Return complete files — do not truncate or summarize.`;

// 11 required base fields that must be present in every schema
export const BASE_FIELDS: Array<TemplateField & { section_hint: string }> = [
  { key: 'business_name', type: 'text', label: 'Business Name', default: 'Your Business Name', section_hint: 'general' },
  { key: 'tagline', type: 'text', label: 'Tagline', default: 'Your Tagline Here', section_hint: 'general' },
  { key: 'phone', type: 'phone', label: 'Phone Number', default: '', section_hint: 'contact' },
  { key: 'email', type: 'email', label: 'Email Address', default: '', section_hint: 'contact' },
  { key: 'address', type: 'textarea', label: 'Address', default: '', section_hint: 'contact' },
  { key: 'logo', type: 'image', label: 'Logo', default: '', section_hint: 'general' },
  { key: 'primary_color', type: 'color', label: 'Primary Color', default: '#000000', section_hint: 'general' },
  { key: 'secondary_color', type: 'color', label: 'Secondary Color', default: '#ffffff', section_hint: 'general' },
  { key: 'hero_title', type: 'text', label: 'Hero Title', default: '', section_hint: 'hero' },
  { key: 'hero_subtitle', type: 'text', label: 'Hero Subtitle', default: '', section_hint: 'hero' },
  { key: 'cta_label', type: 'text', label: 'CTA Button Label', default: 'Get Started', section_hint: 'hero' },
];

export function buildTokenizeTool(): Anthropic.Tool {
  return {
    name: 'tokenize_template',
    description: 'Output the fully tokenized HTML, tokenized CSS files, and complete schema for the web template.',
    input_schema: {
      type: 'object' as const,
      properties: {
        html: {
          type: 'string',
          description: 'Complete tokenized HTML with {{token_key}} placeholders replacing all user-facing content.',
        },
        css_files: {
          type: 'array',
          description: 'Tokenized CSS files. Include only files that had content replaced.',
          items: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Relative path from template root, e.g. css/style.css',
              },
              content: {
                type: 'string',
                description: 'Complete tokenized CSS file content.',
              },
            },
            required: ['filename', 'content'],
          },
        },
        schema: {
          type: 'object',
          description: 'Template schema describing all editable fields.',
          properties: {
            template_id: { type: 'string' },
            name: { type: 'string', description: 'Human-readable template name derived from the template_id or content' },
            category: {
              type: 'string',
              description: 'Template category inferred from content: agency, restaurant, portfolio, corporate, salon, medical, real-estate, fitness, ecommerce, blog, etc.',
            },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'lowercase_snake_case section identifier' },
                  label: { type: 'string', description: 'Human-readable section label' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string', description: 'Unique token key matching the {{key}} placeholder' },
                        type: {
                          type: 'string',
                          enum: ['text', 'textarea', 'image', 'url', 'color', 'phone', 'email'],
                        },
                        label: { type: 'string', description: 'Human-readable field label for the editor UI' },
                        default: { type: 'string', description: 'Default value shown in the editor' },
                      },
                      required: ['key', 'type', 'label', 'default'],
                    },
                  },
                },
                required: ['id', 'label', 'fields'],
              },
            },
          },
          required: ['template_id', 'name', 'category', 'sections'],
        },
      },
      required: ['html', 'css_files', 'schema'],
    },
  };
}
