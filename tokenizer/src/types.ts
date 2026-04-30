export type FieldType = 'text' | 'textarea' | 'image' | 'url' | 'color' | 'phone' | 'email';

export interface TemplateField {
  key: string;
  type: FieldType;
  label: string;
  default: string;
}

export interface TemplateSection {
  id: string;
  label: string;
  fields: TemplateField[];
}

export interface TemplateSchema {
  template_id: string;
  name: string;
  category: string;
  sections: TemplateSection[];
}

export interface TokenizeResult {
  html: string;
  css_files: Array<{ filename: string; content: string }>;
  schema: TemplateSchema;
}

export interface ProcessingLog {
  template_id: string;
  status: 'success' | 'error';
  timestamp: string;
  duration_ms: number;
  fields_count?: number;
  sections_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  error?: string;
}
