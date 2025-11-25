// backend/src/form/dto/applicant-form.dto.ts

export type FormFieldType =
  | 'INPUT'
  | 'NUMBER'
  | 'TEXTAREA'
  | 'SELECT'
  | 'CHECKBOX'
  | 'RADIO'
  | 'FILE'
  | 'IMAGE'
  | 'DATE'
  | 'REPEATABLE_GROUP';

export type FieldVisibility = 'PUBLIC' | 'INTERNAL';

export interface CallDTO {
  id: string;
  name: string;
  year: number;
  status: string;
}

export interface ApplicationDTO {
  id: string;
  status: string;
  submitted_at: string | null;
}

export interface FormSectionDTO {
  id: string;
  title: string;
  order: number;
  visible: boolean;
}

export interface FormFieldDTO {
  id: string;
  section_id: string | null;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  // JSONB en BD: lo tipamos como unknown para evitar any
  options: unknown;
  validation: unknown;
  help_text: string | null;
  show_if: unknown;
  order: number;
  visibility: FieldVisibility;
}

// Valor permitido en una respuesta de campo
export type ResponseScalar = string | number | boolean | null;

export interface FormResponseMap {
  [fieldId: string]: { value: ResponseScalar };
}

export interface DocumentSummary {
  id: string;
  type: string;
  filename: string;
  validation_status: string;
  is_current: boolean;
  form_field_id: string | null;
}

export interface DocumentsByField {
  [fieldId: string]: DocumentSummary[];
}

export interface ApplicantFormPayload {
  call: CallDTO;
  application: ApplicationDTO;
  sections: FormSectionDTO[];
  fields: FormFieldDTO[];
  responses: FormResponseMap;
  documentsByField: DocumentsByField;
}
