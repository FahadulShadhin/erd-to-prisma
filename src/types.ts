export interface Field {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  nullable: boolean;
  unique: boolean;
  index?: boolean;
}

export interface DiagramListItem {
  id: string;
  name: string;
}

export type UpdateFieldFn = (index: number, key: keyof Field, value: Field[keyof Field]) => void;
