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

export interface Template {
  id: string;
  name: string;
  category: string;
  r2_key: string;
  created_at: number;
  schema?: TemplateSchema;
}

export interface Site {
  id: string;
  template_id: string;
  name: string;
  slug: string;
  cf_pages_project: string | null;
  cf_deployment_id: string | null;
  created_at: number;
  updated_at: number;
  template_name?: string;
  category?: string;
  content?: Record<string, string> | null;
}
